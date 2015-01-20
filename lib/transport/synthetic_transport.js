//
// synthetic_transport.js
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

module.exports = SyntheticTransport;

var _ = require('lodash');
var AbstractTransport = require('./abstract_transport');
var SyntheticTransportConnection = require('./synthetic_connection');
var SyntheticTransportListener = require('./synthetic_transport_listener');
var util = require('util');

function SyntheticTransport(options) {
    AbstractTransport.call(this, options);

    this._readMessagesQueue = [];
    this._readBuffering = false;
    this._connectionReadListener = this._onReadConnection.bind(this);
    this._writeMessagesQueue = [];

    this.setConnection(options.connection);
    this.on('finish', this._onFinish.bind(this));
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

SyntheticTransport.prototype.resumeWithConnection = function(connection) {
    // Setting connection will parse the payload of incoming messages
    this.setConnection(connection);
};

SyntheticTransport.prototype._onError = function(err) {
    this.emit('error', err);
};

SyntheticTransport.prototype._onReadConnection = function(message) {
    if (this._readBuffering) {
        this._readMessagesQueue.push(message);
    } else {
        var keepReading = this.push(message);
        if (!keepReading) {
            this._readBuffering = true;
        }
    }
};

SyntheticTransport.prototype._onFinish = function() {
    if (this.connection) {
        this.connection.removeListener('data', this._connectionReadListener);
        this.connection.end();
        this.connection = null;
    }
    this.removeAllListeners();
};

SyntheticTransport.prototype._read = function() {
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

SyntheticTransport.prototype._write = function(chunk, encoding, callback) {
    if (!this.connection) {
        this._writeMessagesQueue.push(chunk);
        return callback();
    }

    this.connection.write(chunk, encoding, callback);
};
