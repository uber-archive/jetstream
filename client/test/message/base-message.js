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

var BaseMessage = require('../../lib/message/base-message');
var PingMessage = require('../../lib/message/ping-message');
var test = require('tape');
var util = require('util');

function TestMessage() {
  BaseMessage.apply(this, arguments);
}

TestMessage.type = 'Test';

util.inherits(TestMessage, BaseMessage);

test('BaseMessage', function(suite) {
  var it = suite.test;

  it('should throw if instantiated', function(t) {
    t.throws(function() { new BaseMessage(); });
    t.end();
  });

  it('should throw with an invalid index', function(t) {
    t.throws(function() { new TestMessage(); });
    t.end();
  });

  it('should have type Test for TestMessage', function(t) {
    var message = new TestMessage({ index: 0 });
    t.equal(message.type, 'Test');
    t.end();
  });
});

test('BaseMessage.parse', function(suite) {
  var it = suite.test;

  it('should throw without a message', function(t) {
    t.throws(function() { BaseMessage.parse(); });
    t.end();
  });

  it('should throw without a message type', function(t) {
    t.throws(function() { BaseMessage.parse(); });
    t.end();
  });

  it('should return null if the message type is not valid', function(t) {
    t.error(BaseMessage.parse({ type: 'Test' }));
    t.end();
  });

  it('should return PingMessage if the message type is Ping', function(t) {
    var message = BaseMessage.parse({ index: 0, type: 'Ping' });
    t.ok(message instanceof PingMessage);
    t.end();
  });
});
