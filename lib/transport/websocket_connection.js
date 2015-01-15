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

module.exports = WebsocketTransportConnection;

var AbstractConnection = require('./abstract_connection');
var Errors = require('../errors');
var util = require('util');
var WebsocketTransport = require('./websocket_transport');
var ws = require('ws');

function WebsocketTransportConnection(options) {
    AbstractConnection.call(this, options);

    if (!(options.websocket instanceof ws)) {
        throw new Error('Invalid websocket');
    }

    this.websocket = options.websocket;
}

util.inherits(WebsocketTransportConnection, AbstractConnection);

WebsocketTransportConnection.prototype.accept = function() {
    AbstractConnection.prototype.accept.call(this);
    // Noop, hold onto connection
};

WebsocketTransportConnection.prototype.deny = function(error) {
    error = AbstractConnection.prototype.deny.call(this, error);
    var response;

    if (error) {
        response = Errors.jsonify(error);
    } else {
        response = Errors.jsonify(new Errors.Rejected());
    }

    var code = WebsocketTransport.CONST.CODE_DENIED_CONNECTION;
    // TODO send error properly as part of a message or similar
    this.websocket.close(code, JSON.stringify(response));
};
