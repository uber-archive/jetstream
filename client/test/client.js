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

var BaseTransportAdapter = require('../lib/transport/base-transport-adapter');
var Client = require('../lib/client');
var Constants = require('../lib/constants');
var PingMessage = require('../lib/message/ping-message');
var Session = require('../lib/session');
var SessionCreateMessage = require('../lib/message/session-create-message');
var SessionCreateReplyMessage = require('../lib/message/session-create-reply-message');
var sinon = require('sinon');
var test = require('tape');

test('Client', function(suite) {
  var it = suite.test;

  it('should throw if instantiated without a transportAdapter', function(t) {
    t.throws(function() { new Client(); });
    t.end();
  });

  it('should initialize with status OFFLINE', function(t) {
    var client = new Client({
      transport: sinon.createStubInstance(BaseTransportAdapter)
    });

    t.equal(client._status, Constants.ClientStatus.OFFLINE);
    t.end();
  });
});

test('Client.prototype._onTransportMessage', function(suite) {
  var it = suite.test;

  it('should initialize a new session on SessionCreateReplyMessage', function(t) {
    var token = 'token';
    var message = new SessionCreateReplyMessage({ index: 0, sessionToken: token });
    var client = new Client({
      transport: sinon.createStubInstance(BaseTransportAdapter)
    });

    client._onTransportMessage(message);

    t.ok(client._session);
    t.equal(client._session._token, token);
    t.end();
  });

  it('should emit "sessionDenied" on SessionCreateReplyMessage without a sessionToken', function(t) {
    var message = new SessionCreateReplyMessage({ index: 0, error: true });
    var client = new Client({
      transport: sinon.createStubInstance(BaseTransportAdapter)
    });

    client.on(Constants.Event.CLIENT_SESSION_DENIED, function() {
      t.pass();
      t.end();
    });

    client._onTransportMessage(message);
  });

  it('should call onMessage on its session on messages other than SessionCreateReplyMessage', function(t) {
    var message = new PingMessage({ index: 0, sessionToken: 'token' });
    var client = new Client({
      transport: sinon.createStubInstance(BaseTransportAdapter)
    });

    client._session = sinon.createStubInstance(Session);
    client._onTransportMessage(message);

    t.ok(client._session.onMessage.calledWith(message));
    t.end();
  });
});

test('Client.prototype._onTransportStatusChanged', function(suite) {
  var it = suite.test;

  it('should have status ONLINE and emit "statusChanged" when its transport is CONNECTED', function(t) {
    var client = new Client({
      transport: sinon.createStubInstance(BaseTransportAdapter)
    });

    client.on(Constants.Event.CLIENT_STATUS_CHANGED, function() {
      t.equal(client._status, Constants.ClientStatus.ONLINE);
      t.end();
    });

    client._onTransportStatusChanged(Constants.TransportStatus.CONNECTED);
  });

  it('should have status OFFLINE when its transport is not CONNECTED', function(t) {
    var client = new Client({
      transport: sinon.createStubInstance(BaseTransportAdapter)
    });

    client._onTransportStatusChanged(Constants.TransportStatus.CLOSED);
    t.equal(client._status, Constants.ClientStatus.OFFLINE);

    client._onTransportStatusChanged(Constants.TransportStatus.CONNECTING);
    t.equal(client._status, Constants.ClientStatus.OFFLINE);

    t.end();
  });

  it('should send SessionCreateMessage when its transport is CONNECTED', function(t) {
    var adapterStub = sinon.createStubInstance(BaseTransportAdapter);
    var client = new Client({
      transport: adapterStub
    });

    client._onTransportStatusChanged(Constants.TransportStatus.CONNECTED);

    t.ok(adapterStub.sendMessage.calledOnce);
    t.ok(adapterStub.sendMessage.getCall(0).args[0] instanceof SessionCreateMessage);
    t.end();
  });
});
