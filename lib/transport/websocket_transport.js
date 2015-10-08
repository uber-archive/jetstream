// Copyright (c) 2015 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
'use strict';

module.exports = WebsocketTransport;

var _ = require('lodash');
var AbstractTransport = require('./abstract_transport');
var logger = require('../logger');
var maybeCallback = require('maybe-callback');
var NetworkMessageParser = require('../message/network_message_parser');
var PingMessage = require('../message/ping_message');
var util = require('util');
var WebsocketConnection = require('./websocket_connection');
var WebsocketTransportListener = require('./websocket_transport_listener');
var ws = require('ws');

var debug = logger.debug.bind(logger.debug, 'transport:websocket');

var CONST = {};
CONST.WEBSOCKET_CODE_OFFSET  = 4096;
CONST.CODE_DENIED_CONNECTION = 0 + CONST.WEBSOCKET_CODE_OFFSET;
CONST.CODE_CLOSED_CONNECTION = 1 + CONST.WEBSOCKET_CODE_OFFSET;
CONST.INACTIVITY_PING_INTERVAL = 10 * 1000;
CONST.INACTIVITY_PING_INTERVAL_VARIANCE = 2 * 1000;
CONST = Object.freeze(CONST);

function WebsocketTransport(options) {
    AbstractTransport.call(this, options);

    this._clientIndex = 0;
    this._activePendingSendImmediate = null;
    this._pendingSends = [];
    this._nonAckedSends = [];
    this._sending = false;
    this._pingTimeout = null;
    this._inactivityPingInterval = options.inactivityPingInterval || 
        CONST.INACTIVITY_PING_INTERVAL;
    this._inactivityPingIntervalVariance = options.inactivityPingIntervalVariance || 
        CONST.INACTIVITY_PING_INTERVAL_VARIANCE;

    this.setConnection(options.connection);
}

util.inherits(WebsocketTransport, AbstractTransport);

WebsocketTransport.CONST = CONST;

WebsocketTransport.configure = AbstractTransport.configure.bind(WebsocketTransport);

WebsocketTransport.listen = function(options) {
    return new WebsocketTransportListener(options);
};

WebsocketTransport.prototype.setConnection = function(connection) {
    if (!(connection instanceof WebsocketConnection)) {
        throw new Error('Invalid connection');
    }

    if (connection.websocket.readyState !== ws.OPEN) {
        throw new Error('Websocket connection is not open');
    }

    // If the connection ever dies we want to ensure we don't keep a reference
    connection.websocket.on('close', function() {
        this.connection = null;
    }.bind(this));

    connection.websocket.on('message', this._onData.bind(this));

    this.connection = connection;

    // Start inactivity ping timeout
    this._setPingTimeoutWithVariance();
};

WebsocketTransport.prototype.resumeWithConnection = function(connection) {
    this.setConnection(connection);
};

WebsocketTransport.prototype.transportMessage = function(message, callback) {
    var entry = {message: message, callback: callback};

    if (!this.connection) {
        // Need to send on next time we have a connection
        if (message.index !== 0) {
            this._nonAckedSends.push(message);
        }
        return this._pendingSends.push(entry);
    }

    if (this._activePendingSendImmediate) {
        // We already started trying to transport on this IO frame, queue up for send
        if (message.index !== 0) {
            this._nonAckedSends.push(message);
        }
        return this._pendingSends.push(entry);
    }

    // Queue up and start the immediate for action from this IO frame
    if (message.index !== 0) {
        this._nonAckedSends.push(message);
    }
    this._pendingSends.push(entry);
    this._activePendingSendImmediate = setImmediate(this._transportAllPendingMessages.bind(this));
};

WebsocketTransport.prototype.close = function(callback) {
    var connection = this.connection;
    this.connection = null;
    this.removeAllListeners();

    var websocket = connection && connection.websocket;
    if (websocket && websocket.readyState !== ws.CLOSED) {
        websocket.close(CONST.CODE_CLOSED_CONNECTION);
        websocket.once('close', maybeCallback(callback)());
    } else {
        maybeCallback(callback)();
    }
};

WebsocketTransport.prototype._transportAllPendingMessages = function() {
    if (this._activePendingSendImmediate) {
        clearImmediate(this._activePendingSendImmediate);
        this._activePendingSendImmediate = null;
    }

    if (!this.connection) {
        // We lost the connection during the immediate
        return debug('no connection for transportAllPendingMessages');
    }

    if (this._pendingSends.length < 1) {
        // Queue was gutted
        return debug('no messages to send for transportAllPendingMessages');
    }

    if (this._sending) {
        // Messages arrived during transportation, resend after the current send attempt
        debug('already sending on transportAllPendingMessages');
        return this.once('sendAttempt', this._transportAllPendingMessages.bind(this));
    }

    this._sending = true;

    var messages = _.pluck(this._pendingSends, 'message');
    var callbacks = _.filter(_.pluck(this._pendingSends, 'callback'), _.isFunction);
    this._pendingSends = [];

    var done = function(err) {
        if (err) {
            // Push unsent messages back on the queue
            var args = [0, 0].concat(messages.map(function(message) {
                return {message: message};
            }));
            this._pendingSends.splice.apply(this._pendingSends, args);
        }

        this._sending = false;
        this.emit('sendAttempt');

        callbacks.forEach(function(callback) {
            try {
                callback(err);
            } catch (exc) {
                debug('callback raised error', exc);
            }
        });
    }.bind(this);

    NetworkMessageParser.composeAsJSON(messages, function(err, json) {
        if (err) {
            return done(err);
        }

        if (!this.connection) {
            // We lost the connection during the parsing
            return done(new Error('Lost connection during initial send'));
        }

        var str;
        try {
            str = JSON.stringify(json);
        } catch (err) {
            return done(err);
        }

        this.connection.websocket.send(str, done);
    }.bind(this));
};

WebsocketTransport.prototype._messageReceived = function(message) {
    if (message.index !== 0 && message.index <= this._clientIndex) {
        return debug(
            'client resent already received message, clientIndex: ',
             this._clientIndex, ', messageIndex: ', message.index);
    }

    if (message.index !== 0) {
        this._clientIndex = message.index;
    }

    if (message instanceof PingMessage) {
        this._pingMessageReceived(message);
    }

    this.emit('message', message);
};

WebsocketTransport.prototype._pingMessageReceived = function(pingMessage) {
    // Remove all acked messages
    if (this._nonAckedSends.length > 0) {
        this._nonAckedSends = _.filter(this._nonAckedSends, function(message) {
            return message.index > pingMessage.ack; 
        });
    }

    // Check if client has outstanding messages not seen yet and requests resend
    if (pingMessage.resendMissing) {
        // Already sending, let's queue up our slicing
        if (this._sending) {
            return this.once('sendAttempt', this._recoverMissingMessages.bind(this));
        } else {
            this._recoverMissingMessages();
        }
    }
};

WebsocketTransport.prototype._recoverMissingMessages = function() {
    var resendMissingPingMessage = new PingMessage({
        index: 0,
        ack: this._clientIndex,
        resendMissing: true
    });
    if (this._nonAckedSends.length < 1) {
        this._pendingSends = [{message: resendMissingPingMessage}];
    } else {
        // Fire all current callbacks as failed, we are delivering new instances of these sends
        var callbacks = _.filter(_.pluck(this._pendingSends, 'callback'), _.isFunction);
        callbacks.forEach(function(callback) {
            try {
                callback(new Error('Message being resent due to Ping resend request'));
            } catch (exc) {
                debug('callback raised error', exc);
            }
        });

        this._pendingSends = _.map(this._nonAckedSends, function(message) {
            return {message: message};
        });
        this._pendingSends.unshift({message: resendMissingPingMessage});
    }
    this._transportAllPendingMessages();
};

WebsocketTransport.prototype._setPingTimeoutWithVariance = function() {
    if (this._pingTimeout) {
        clearTimeout(this._pingTimeout);
        this._pingTimeout = null;
    }

    var varianceLowerBound = this._inactivityPingInterval - (this._inactivityPingIntervalVariance / 2);
    var randomVariance = Math.random() * this._inactivityPingIntervalVariance;
    var delay = varianceLowerBound + randomVariance;
    this._pingTimeout = setTimeout(this._sendInactivityPing.bind(this), delay);
};

WebsocketTransport.prototype._sendInactivityPing = function() {
    if (this.connection) {
        this.sendMessage(new PingMessage({
            index: 0,
            ack: this._clientIndex
        }));
        this._setPingTimeoutWithVariance();
    }
};
