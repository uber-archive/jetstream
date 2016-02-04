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

var WebSocketTransportAdapter = require('../../lib/transport/websocket-transport-adapter');
var Constants = require('../../lib/constants');
var test = require('tape');

test('WebSocketTransportAdapter', function(suite) {
  var it = suite.test;
  var url = 'ws://localhost:3000';

  it('should throw if instantiated without a url', function(t) {
    t.throws(function() { new WebSocketTransportAdapter(); });
    t.end();
  });

  it('should set the url', function(t) {
    var adapter = new WebSocketTransportAdapter({ url: url });
    t.equal(adapter.url, url);
    t.end();
  });

  it('should initialize with status CLOSED', function(t) {
    var adapter = new WebSocketTransportAdapter({ url: url });
    t.equal(adapter._status, Constants.TransportStatus.CLOSED);
    t.end();
  });

  it('should not create a socket if its status is not CLOSED', function(t) {
    var adapter = new WebSocketTransportAdapter({ url: url });
    adapter._status = Constants.TransportStatus.CONNECTED;
    adapter.connect();

    t.error(adapter._socket);
    t.end();
  });

  it('should set the socket and change status to CONNECTING', function(t) {
    var adapter = new WebSocketTransportAdapter({ url: url });
    adapter.connect();

    t.ok(adapter._socket);
    t.equal(adapter._status, Constants.TransportStatus.CONNECTING);
    t.end();
  });

  it('should change status to CONNECTING on connect', function(t) {
    var adapter = new WebSocketTransportAdapter({ url: url });
    adapter.connect();

    t.equal(adapter._status, Constants.TransportStatus.CONNECTING);
    t.end();
  });

  it('should change status to CONNECTED on socket open', function(t) {
    var adapter = new WebSocketTransportAdapter({ url: url });
    adapter.connect();
    
    adapter.on(Constants.Event.TRANSPORT_ADAPTER_STATUS_CHANGED, function() {
      t.equal(adapter._status, Constants.TransportStatus.CONNECTED);
      t.end();
    });
  });

  it('should change status to CLOSED on socket close', function(t) {
    var adapter = new WebSocketTransportAdapter({ url: url });
    adapter.connect();
    adapter.disconnect();

    t.equal(adapter._status, Constants.TransportStatus.CLOSED);
    t.end();
  });
});

test('WebSocketTransportAdapter.prototype._onSocketMessage', function(suite) {
  var it = suite.test;
  var url = 'ws://localhost:3000';

  it('should emit "message" when a message is received', function(t) {
    var adapter = new WebSocketTransportAdapter({ url: url });
    adapter.connect();

    var index = 0;
    adapter.on(Constants.Event.TRANSPORT_ADAPTER_MESSAGE, function(message) {
      t.equal(message.index, index);
      t.end();
    });

    var data = JSON.stringify({ index: index, type: 'Ping' });
    adapter._onSocketMessage({ data: data });
  });

  it('should emit multiple "message" events when messages are received', function(t) {
    var data = [
      { index: 0, type: 'Ping' },
      { index: 1, type: 'Ping' },
      { index: 2, type: 'Ping' }
    ];

    t.plan(data.length);

    var adapter = new WebSocketTransportAdapter({ url: url });
    adapter.connect();

    adapter.on(Constants.Event.TRANSPORT_ADAPTER_MESSAGE, t.pass);
    adapter._onSocketMessage({ data: JSON.stringify(data) });
  });
});
