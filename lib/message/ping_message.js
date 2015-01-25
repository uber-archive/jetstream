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

module.exports = PingMessage;

var AbstractNetworkMessage = require('./abstract_network_message');
var robb = require('robb/src/robb');
var util = require('util');

function PingMessage(options) {
    options = options || {};
    AbstractNetworkMessage.call(this, options);

    if (!robb.isUnsignedInt(options.ack)) {
        throw new Error('Invalid ack');
    }

    this.ack = options.ack;
    if (options.resendMissing === true) {
        this.resendMissing = true;
    } else {
        this.resendMissing = false;
    }
}

util.inherits(PingMessage, AbstractNetworkMessage);

PingMessage.type = 'Ping';

PingMessage.parseAsJSON = function(json, callback) {
    if (!json || json.type !== this.type) {
        return callback(new Error('Message type was not \'' + this.type + '\''));
    }

    var message;
    try {
        message = new PingMessage(json);
    } catch (err) {
        return callback(err);
    }
    
    callback(null, message);
};

PingMessage.prototype.toJSON = function() {
    var json = AbstractNetworkMessage.prototype.toJSON.call(this);
    json.ack = this.ack;
    json.resendMissing = this.resendMissing;
    return json;
};
