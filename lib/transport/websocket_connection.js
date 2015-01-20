//
// websocket_connection.js
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

module.exports = WebsocketTransportConnection;

var _ = require('lodash');
var AbstractConnection = require('./abstract_connection');
var Errors = require('../errors');
var NetworkMessageJSONDecoder = require('./network_message_json_decoder');
var NetworkMessageJSONEncoder = require('./network_message_json_encoder');
var SessionCreateMessage = require('../message/session_create_message');
var util = require('util');
var WebsocketTransport = require('./websocket_transport');
var ws = require('ws');

function WebsocketTransportConnection(options) {
    AbstractConnection.call(this, options);

    if (!(options.websocket instanceof ws)) {
        throw new Error('Invalid websocket');
    }

    this.websocket = options.websocket;

    this._decoder = new NetworkMessageJSONDecoder();
    this._decoder.on('error', this._onError.bind(this));
    this._decoder.on('data', this._onDecodeMessage.bind(this));

    this._encoder = new NetworkMessageJSONEncoder();
    this._encoder.on('error', this._onError.bind(this));
    this._encoder.on('data', this._onEncodeMessage.bind(this));

    this._readMessagesQueue = [];
    this._readBuffering = false;

    this.websocket.on('error', this._onError.bind(this));
    this.websocket.on('message', function(data) {
        this._decoder.write(data);
    }.bind(this));
    this.websocket.on('close', function() {
        this.push(null);
    }.bind(this));
    this.on('finish', this._onFinish.bind(this));
}

util.inherits(WebsocketTransportConnection, AbstractConnection);

WebsocketTransportConnection.prototype.deny = function(error) {
    error = AbstractConnection.prototype.deny.call(this, error);
    var response;

    if (error) {
        response = Errors.jsonify(error);
    } else {
        response = Errors.jsonify(new Errors.Rejected());
    }

    var code = WebsocketTransport.CONST.CODE_DENIED_CONNECTION;
    // TODO: send error properly as part of a message or similar
    this.websocket.close(code, JSON.stringify(response));
};

WebsocketTransportConnection.prototype._onError = function(err) {
    this.emit('error', err);
};

WebsocketTransportConnection.prototype._onEncodeMessage = function(data) {
    this.websocket.send(data, function(err) {
        if (err) {
            this._onError(err);
        }
    }.bind(this));
};

WebsocketTransportConnection.prototype._onDecodeMessage = function(message) {
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

WebsocketTransportConnection.prototype._read = function() {
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

WebsocketTransportConnection.prototype._write = function(chunk, encoding, callback) {
    this._encoder.write(chunk, encoding, callback);
};

WebsocketTransportConnection.prototype._onFinish = function() {
    if (this.websocket.readyState !== ws.CLOSED) {
        this.websocket.close(WebsocketTransport.CONST.CODE_CLOSED_CONNECTION);
    }
};
