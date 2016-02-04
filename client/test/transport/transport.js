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

var BaseTransportAdapter = require('../../lib/transport/base-transport-adapter');
var BaseMessage = require('../../lib/message/base-message');
var Constants = require('../../lib/constants');
var ReplyMessage = require('../../lib/message/reply-message');
var Transport = require('../../lib/transport/transport');
var sinon = require('sinon');
var test = require('tape');
var util = require('util');

function TestMessage() {
  BaseMessage.apply(this, arguments);
}

TestMessage.type = 'Test';

util.inherits(TestMessage, BaseMessage);

function TestReplyMessage() {
  ReplyMessage.apply(this, arguments);
}

TestReplyMessage.type = 'TestReply';

util.inherits(TestReplyMessage, ReplyMessage);

test('Transport', function(suite) {
  var it = suite.test;

  it('should throw if instantiated without an adapter', function(t) {
    t.throws(function() { new Transport(); });
    t.end();
  });

  it('should bind listeners on its adapter', function(t) {
    var adapterStub = sinon.createStubInstance(BaseTransportAdapter);
    new Transport({ adapter: adapterStub });

    t.ok(adapterStub.on.calledWith(Constants.Event.TRANSPORT_ADAPTER_MESSAGE));
    t.ok(adapterStub.on.calledWith(Constants.Event.TRANSPORT_ADAPTER_STATUS_CHANGED));
    t.end();
  });
});

test('Transport.prototype.sendMessage', function(suite) {
  var it = suite.test;

  it('should save the callback and call sendMessage on its adapter', function(t) {
    var adapterStub = sinon.createStubInstance(BaseTransportAdapter);
    var spy = sinon.spy();
    var transport = new Transport({ adapter: adapterStub });

    var index = 0;
    var message = new TestMessage({ index: index });
    transport.sendMessage(message, spy);

    t.equal(transport._callbacks[index], spy);
    t.ok(adapterStub.sendMessage.calledWith(message));
    t.end();
  });
});

test('Transport.prototype._onAdapterMessage', function(suite) {
  var it = suite.test;

  it('should emit "message" when a message is received', function(t) {
    var adapterStub = sinon.createStubInstance(BaseTransportAdapter);
    var transport = new Transport({ adapter: adapterStub });

    var index = 0;
    var message = new TestMessage({ index: index });

    transport.on(Constants.Event.TRANSPORT_MESSAGE, function(msg) {
      t.equal(msg.index, index);
      t.end();
    });

    transport._onAdapterMessage(message);
  });

  it('should call and remove the saved callback', function(t) {
    var adapterStub = sinon.createStubInstance(BaseTransportAdapter);
    var spy = sinon.spy();
    var transport = new Transport({ adapter: adapterStub });

    var index = 0;
    var message = new TestMessage({ index: index });
    var replyMessage = new TestReplyMessage({ index: index, replyTo: index });

    transport.sendMessage(message, spy);
    transport._onAdapterMessage(replyMessage);

    t.ok(spy.calledWith(replyMessage));
    t.error(transport._callbacks[index]);
    t.end();
  });
});
