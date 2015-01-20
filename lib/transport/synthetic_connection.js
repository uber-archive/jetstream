//
// synthetic_connection.js
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

module.exports = SyntheticTransportConnection;

var _ = require('lodash');
var AbstractConnection = require('./abstract_connection');
var NetworkMessageJSONDecoder = require('./network_message_json_decoder');
var NetworkMessageJSONEncoder = require('./network_message_json_encoder');
var SessionCreateMessage = require('../message/session_create_message');
var util = require('util');

function SyntheticTransportConnection(options) {
    AbstractConnection.call(this, options);

    if (typeof options.payload !== 'string') {
        throw new Error('Invalid payload');
    }

    this.payload = options.payload;

    this._decoder = new NetworkMessageJSONDecoder();
    this._decoder.on('error', this._onError.bind(this));
    this._decoder.on('data', this._onDecodeMessage.bind(this));

    this._encoder = new NetworkMessageJSONEncoder();
    this._encoder.on('error', this._onError.bind(this));
    this._encoder.on('data', this._onEncodeMessage.bind(this));

    this._startedDecoder = false;
    this._readMessagesQueue = [];
    this._readBuffering = false;
}

util.inherits(SyntheticTransportConnection, AbstractConnection);

SyntheticTransportConnection.prototype._onError = function(err) {
    this.emit('error', err);
};

SyntheticTransportConnection.prototype._onEncodeMessage = function(data) {
    this.emit('response', data);
};

SyntheticTransportConnection.prototype._onDecodeMessage = function(message) {
    if (message instanceof SessionCreateMessage) {
        this.emit('sessionCreateMessage', message);
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

SyntheticTransportConnection.prototype._read = function() {
    this._readBuffering = false;
    if (!this._startedDecoder) {
        this._startedDecoder = true;
        this._decoder.write(this.payload);
    } else if (this._readMessagesQueue.length > 0) {
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

SyntheticTransportConnection.prototype._write = function(chunk, encoding, callback) {
    this._encoder.write(chunk, encoding, callback);
};
