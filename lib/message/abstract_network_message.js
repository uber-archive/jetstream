//
// abstract_network_message.js
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

module.exports = AbstractNetworkMessage;

var EventEmitter = require('events').EventEmitter;
var robb = require('robb/src/robb');
var util = require('util');

function AbstractNetworkMessage(options) {
    options = options || {};

    if (!robb.isUnsignedInt(options.index)) {
        throw new Error('Message requires to be reliably sent with an index');
    }

    this.index = options.index;

    if (typeof options.replyCallback === 'function') {
        this.replyCallback = options.replyCallback;
    } else {
        this.replyCallback = null;
    }
}

util.inherits(AbstractNetworkMessage, EventEmitter);

AbstractNetworkMessage.type = 'Abstract';

AbstractNetworkMessage.prototype.toJSON = function() {
    var type = Object.getPrototypeOf(this).constructor.type;
    if (type === AbstractNetworkMessage.type) {
        throw new Error('Cannot call toJSON on an AbstractNetworkMessage');
    }
    return {
        type: type,
        index: this.index
    };
};
