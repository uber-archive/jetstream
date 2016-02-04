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

module.exports = BaseMessage;

var assert = require('assert');
var log = require('../log')('BaseMessage');

var _messages = {
  Ping: require('./ping-message'),
  ScopeFetch: require('./scope-fetch-message'),
  ScopeFetchReply: require('./scope-fetch-reply-message'),
  ScopeState: require('./scope-state-message'),
  ScopeSync: require('./scope-sync-message'),
  ScopeSyncReply: require('./scope-sync-reply-message'),
  SessionCreate: require('./session-create-message'),
  SessionCreateReply: require('./session-create-reply-message')
};

function BaseMessage(options) {
  assert(this.constructor !== BaseMessage, 'BaseMessage instantiation not allowed');

  options = options || {};

  assert(typeof options.index === 'number', 'Invalid BaseMessage index');

  this.index = options.index;
  this.type = this.constructor.type;
}

BaseMessage.type = 'Message';

///////////////////////////////////////////////////////////////////////////////
// METHODS

BaseMessage.prototype.toJSON = function(properties) {
  var json = {
    index: this.index,
    type: this.type
  };

  properties = properties || [];

  for (var i = 0; i < properties.length; i++) {
    var property = properties[i];
    if (typeof this[property] !== 'undefined') {
      json[property] = this[property];
    }
  }

  return json;
};

BaseMessage.parse = function(data) {
  assert(typeof data === 'object', 'Invalid BaseMessage data');
  assert(typeof data.type === 'string', 'Invalid BaseMessage type');
  
  try {
    var MessageType = _messages[data.type];

    // Initialize the message with its parse function
    if (typeof MessageType.parse === 'function') {
      return MessageType.parse(data);
    }
    
    return new MessageType(data);
  } catch(e) {
    log.error('Message parse error', e, data);
  }

  return null;
};
