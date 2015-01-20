//
// websocket_transport.js
// Jetstream
// 
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
var PingMessage = require('../message/ping_message');
var util = require('util');
var WebsocketConnection = require('./websocket_connection');
var WebsocketTransportListener = require('./websocket_transport_listener');

var debug = logger.debug.bind(logger.debug, 'transport:websocketTransport');

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
    this._nonAckedSends = [];
    this._pingTimeout = null;
    this._inactivityPingInterval = options.inactivityPingInterval || 
        CONST.INACTIVITY_PING_INTERVAL;
    this._inactivityPingIntervalVariance = options.inactivityPingIntervalVariance || 
        CONST.INACTIVITY_PING_INTERVAL_VARIANCE;
    this._readMessagesQueue = [];
    this._readBuffering = false;
    this._connectionReadListener = this._onReadConnection.bind(this);
    this._writeMessagesQueue = [];

    this.setConnection(options.connection);
    this.on('finish', this._onFinish.bind(this));
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

    if (this.connection) {
        this.connection.removeListener('data', this._connectionReadListener);
    }

    this.connection = connection;

    if (connection) {
        connection.on('data', this._connectionReadListener);

        connection.once('error', onConnectionError);
        connection.once('close', onConnectionCleanup);
        connection.once('end', onConnectionCleanup);
        connection.once('finish', onConnectionCleanup);

        // Flush any queued messages
        this._writeMessagesQueue.forEach(function(message) {
            connection.write(message);
        });

        // Start inactivity ping timeout
        this._setPingTimeoutWithVariance();
    }

    var self = this;
    function onConnectionError(err) {
        if (self.connection === connection) {
            self._onError(err);
        }
        onConnectionCleanup();
    }

    function onConnectionCleanup() {
        if (self.connection === connection) {
            self.connection = null;
        }
    }
};

WebsocketTransport.prototype.resumeWithConnection = function(connection) {
    this.setConnection(connection);
};

WebsocketTransport.prototype._onError = function(err) {
    this.emit('error', err);
};

WebsocketTransport.prototype._onReadConnection = function(message) {
    if (message.index !== 0 && message.index <= this._clientIndex) {
        return debug(
            'client resent already received message, clientIndex: ',
             this._clientIndex, ', messageIndex: ', message.index);
    }

    if (message.index !== 0) {
        this._clientIndex = message.index;
    }

    if (message instanceof PingMessage) {
        this._onPingMessageReceived(message);
    }

    if (this._readBuffering) {
        this._readMessagesQueue.push(message);
    } else {
        var keepReading = this.push(message);
        if (!keepReading) {
            this._readBuffering = true;
        }
    }
};

WebsocketTransport.prototype._onFinish = function() {
    if (this.connection) {
        this.connection.removeListener('data', this._connectionReadListener);
        this.connection.end();
        this.connection = null;
    }
    this.removeAllListeners();
};

WebsocketTransport.prototype._read = function() {
    this._readBuffering = false;
    if (this._readMessagesQueue.length > 0) {
        var pushed = 0;
        _.each(this._readMessagesQueue, function(message) {
            pushed++;
            var keepReading = this.push(message);
            if (!keepReading) {
                this._readBuffering = true;
                return false;
            }
        }.bind(this));
        this._readMessagesQueue = this._readMessagesQueue.slice(pushed);
    }
};

WebsocketTransport.prototype._write = function(chunk, encoding, callback) {
    if (chunk.index !== 0) {
        this._nonAckedSends.push(chunk);
    }

    if (!this.connection) {
        this._writeMessagesQueue.push(chunk);
        return callback();
    }

    this.connection.write(chunk, encoding, callback);
};

WebsocketTransport.prototype._onPingMessageReceived = function(pingMessage) {
    // Remove all acked messages
    if (this._nonAckedSends.length > 0) {
        this._nonAckedSends = _.filter(this._nonAckedSends, function(message) {
            return message.index > pingMessage.ack; 
        });
    }

    // Check if client has outstanding messages not seen yet and requests resend
    if (pingMessage.resendMissing) {
        this._recoverMissingMessages();
    }
};

WebsocketTransport.prototype._recoverMissingMessages = function() {
    var resendMissingPingMessage = new PingMessage({
        index: 0,
        ack: this._clientIndex,
        resendMissing: true
    });
    this.write(resendMissingPingMessage);
    if (this._nonAckedSends.length > 0) {
        this._nonAckedSends.forEach(function(message) {
            this.write(message);
        }.bind(this));
    }
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
        this.write(new PingMessage({
            index: 0,
            ack: this._clientIndex
        }));
        this._setPingTimeoutWithVariance();
    }
};
