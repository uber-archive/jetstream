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

module.exports = SyntheticTransport;

var _ = require('lodash');
var AbstractTransport = require('./abstract_transport');
var logger = require('../logger');
var maybeCallback = require('maybe-callback');
var NetworkMessageParser = require('../message/network_message_parser');
var SyntheticTransportConnection = require('./synthetic_connection');
var SyntheticTransportListener = require('./synthetic_transport_listener');
var util = require('util');

var debug = logger.debug.bind(logger.debug, 'transport:syntheticTransport');

function SyntheticTransport(options) {
    AbstractTransport.call(this, options);

    this._clientIndex = 0;
    this._activePendingSendImmediate = null;
    this._pendingSends = [];
    this._sending = false;
    this._outOfOrderMessages = [];
    this.setConnection(options.connection);
}

util.inherits(SyntheticTransport, AbstractTransport);

SyntheticTransport.activeListener = null;

SyntheticTransport.configure = AbstractTransport.configure.bind(SyntheticTransport);

SyntheticTransport.listen = function(options) {
    if (SyntheticTransport.activeListener !== null) {
        throw new Error('The synthetic transport is already listening');
    }
    SyntheticTransport.activeListener = new SyntheticTransportListener(options);
    return SyntheticTransport.activeListener;
};

SyntheticTransport.incomingConnection = function(connection) {
    if (connection instanceof SyntheticTransportConnection) {
        if (SyntheticTransport.activeListener) {
            SyntheticTransport.activeListener.incomingConnection(connection);
        } else {
            throw new Error('The synthetic transport has not been setup');
        }
    } else {
        throw new Error('Connection is not a SyntheticTransportConnection');
    }
};

SyntheticTransport.prototype.setConnection = function(connection) {
    if (!(connection instanceof SyntheticTransportConnection)) {
        throw new Error('Invalid connection');
    }

    this._onData(connection.payload);
    this.connection = connection;
};  

SyntheticTransport.prototype.resumeWithConnection = function(connection) {
    // Setting connection will parse the payload of incoming messages
    this.setConnection(connection);
};

SyntheticTransport.prototype.transportMessage = function(message, callback) {
    var entry = {message: message, callback: callback};

    if (!this.connection) {
        // Need to send on next time we have a connection
        return this._pendingSends.push(entry);
    }

    if (this._activePendingSendImmediate) {
        // We already started trying to transport on this IO frame, queue up for send
        return this._pendingSends.push(entry);
    }

    // Queue up and start the immediate for action from this IO frame
    this._pendingSends.push(entry);
    this._activePendingSendImmediate = setImmediate(this._transportAllPendingMessages.bind(this));
};

SyntheticTransport.prototype.close = function(callback) {
    this.connection = null;
    this.removeAllListeners();
    maybeCallback(callback)();
};

SyntheticTransport.prototype._transportAllPendingMessages = function() {
    if (this._activePendingSendImmediate) {
        clearImmediate(this._activePendingSendImmediate);
        this._activePendingSendImmediate = null;
    }

    if (!this.connection) {
        // We lost the connection during the immediate
        return;
    }

    if (this._pendingSends.length < 1) {
        // Queue was gutted
        return;
    }

    if (this._sending) {
        // Messages arrived during transportation, resend after the current send attempt
        return this.once('sendAttempt', this._transportAllPendingMessages.bind(this));
    }

    this._sending = true;

    var messages = _.pluck(this._pendingSends, 'message');
    var callbacks = _.filter(_.pluck(this._pendingSends, 'callback'), _.isFunction);
    var done = function() {
        this._sending = false;
        this.emit('sendAttempt');
    }.bind(this);

    NetworkMessageParser.composeAsJSON(messages, function(err, json) {
        if (!this.connection) {
            // We lost the connection during the parsing
            return done();
        }

        if (err) {
            callbacks.forEach(function(callback) {
                try {
                    callback(err);
                } catch(exc) {}
            });
            return done();
        }

        try {
            this.connection.emit('response', json);
            this._pendingSends = [];
        } catch (exc) {
            callbacks.forEach(function(callback) {
                try {
                    callback(err);
                } catch(innerExc) {}
            });
            return done();
        }

        callbacks.forEach(function(callback) {
            try {
                callback(null);
            } catch (exc) { }
        });

        done();
    }.bind(this));
};

SyntheticTransport.prototype._messageReceived = function(message) {
    if (message.index !== 0 && message.index <= this._clientIndex) {
        return debug('Client resent already received message', {
            clientIndex: this._clientIndex,
            messageIndex: message.index
        });
    }

    if (message.index !== 0) {
        if (message.index > (this._clientIndex + 1)) {
            this._outOfOrderMessages.push(message);
        } else {
            this._clientIndex = message.index;
            this.emit('message', message);

            var pending = this._outOfOrderMessages;
            pending.sort(function(a, b) {
                return a.index - b.index;
            });

            while (pending.length > 0 && pending[0].index === (this._clientIndex + 1)) {
                var nextInOrderMessage = pending.shift();
                this._clientIndex = nextInOrderMessage.index;
                this.emit('message', nextInOrderMessage);
            }
        }
    } else {
        this.emit('message', message);
    }
};
