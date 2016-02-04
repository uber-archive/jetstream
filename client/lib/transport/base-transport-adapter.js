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

module.exports = BaseTransportAdapter;

var assert = require('assert');
var Constants = require('../constants');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

function BaseTransportAdapter() {
  assert(this.constructor !== BaseTransportAdapter, 'BaseTransportAdapter instantiation not allowed');

  this._status = Constants.TransportStatus.CLOSED;
}

util.inherits(BaseTransportAdapter, EventEmitter);

BaseTransportAdapter.prototype.connect = function() {
  throw new Error('BaseTransportAdapter connect not implemented');
};

BaseTransportAdapter.prototype.disconnect = function() {
  throw new Error('BaseTransportAdapter disconnect not implemented');
};

BaseTransportAdapter.prototype.reconnect = function() {
  throw new Error('BaseTransportAdapter reconnect not implemented');
};

BaseTransportAdapter.prototype.sendMessage = function() {
  throw new Error('BaseTransportAdapter sendMessage not implemented');
};

BaseTransportAdapter.prototype.setSession = function() {
  throw new Error('BaseTransportAdapter setSession not implemented');
};

BaseTransportAdapter.prototype._changeStatus = function(status) {
  if (this._status !== status) {
    this._status = status;
    this.emit(Constants.Event.TRANSPORT_ADAPTER_STATUS_CHANGED, this._status);
  }
};
