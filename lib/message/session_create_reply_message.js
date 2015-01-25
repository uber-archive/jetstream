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

module.exports = SessionCreateReplyMessage;

var AbstractNetworkMessage = require('./abstract_network_message');
var Errors = require('../errors');
var util = require('util');

function SessionCreateReplyMessage(options) {
    options = options || {};
    AbstractNetworkMessage.call(this, options);

    if (typeof options.sessionToken === 'string') {
        this.sessionToken = options.sessionToken;
        this.error = null;
    } else if (options.error instanceof Error) {
        this.sessionToken = null;
        this.error = options.error;
    } else {
        throw new Error('Invalid sessionToken or error');
    }
}

util.inherits(SessionCreateReplyMessage, AbstractNetworkMessage);

SessionCreateReplyMessage.type = 'SessionCreateReply';

SessionCreateReplyMessage.parseAsJSON = function(json, callback) {
    if (!json || json.type !== this.type) {
        return callback(new Error('Message type was not \'' + this.type + '\''));
    }

    var message;
    try {
        message = new SessionCreateReplyMessage(json);
    } catch (err) {
        return callback(err);
    }
    
    callback(null, message);
};

SessionCreateReplyMessage.prototype.toJSON = function() {
    var json = AbstractNetworkMessage.prototype.toJSON.call(this);
    if (this.sessionToken) {
        json.sessionToken = this.sessionToken;
    }
    if (this.error) {
        json.error = Errors.jsonify(this.error);
    }
    return json;
};
