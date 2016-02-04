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

module.exports = ReplyMessage;

var assert = require('assert');
var BaseMessage = require('./base-message');
var util = require('util');

function ReplyMessage(options) {
  assert(this.constructor !== ReplyMessage, 'ReplyMessage instantiation not allowed');

  options = options || {};

  BaseMessage.call(this, options);

  assert(typeof options.replyTo === 'number', 'Invalid ReplyMessage replyTo');

  this.replyTo = options.replyTo;
}

util.inherits(ReplyMessage, BaseMessage);

ReplyMessage.type = 'Reply';

///////////////////////////////////////////////////////////////////////////////
// METHODS

ReplyMessage.prototype.toJSON = function() {
  return BaseMessage.prototype.toJSON.call(this, ['replyTo']);
};
