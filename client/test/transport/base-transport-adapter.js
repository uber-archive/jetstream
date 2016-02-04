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
var Constants = require('../../lib/constants');
var test = require('tape');
var util = require('util');

function TestTransportAdapter() {
  BaseTransportAdapter.apply(this, arguments);
}

util.inherits(TestTransportAdapter, BaseTransportAdapter);

test('BaseTransportAdapter', function(suite) {
  var it = suite.test;

  it('should throw if instantiated', function(t) {
    t.throws(function() { new BaseTransportAdapter(); });
    t.end();
  });

  it('should initialize with status CLOSED', function(t) {
    var adapter = new TestTransportAdapter();
    t.equal(adapter._status, Constants.TransportStatus.CLOSED);
    t.end();
  });

  it('should throw on unimplemented methods', function(t) {
    var adapter = new TestTransportAdapter();
    t.throws(function() { adapter.connect(); });
    t.throws(function() { adapter.disconnect(); });
    t.throws(function() { adapter.reconnect(); });
    t.throws(function() { adapter.sendMessage(); });
    t.throws(function() { adapter.setSession(); });
    t.end();
  });

  it('should emit "statusChanged" if the status has changed', function(t) {
    var adapter = new TestTransportAdapter();
    adapter.on(Constants.Event.TRANSPORT_ADAPTER_STATUS_CHANGED, function() {
      t.pass();
      t.end();
    });
    
    adapter._changeStatus(Constants.TransportStatus.CONNECTED);
  });
});
