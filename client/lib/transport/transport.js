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

module.exports = Transport;

var assert = require('assert');
var BaseTransportAdapter = require('./base-transport-adapter');
var Constants = require('../constants');
var EventEmitter = require('events').EventEmitter;
var log = require('../log')('Transport');
var ReplyMessage = require('../message/reply-message');
var util = require('util');

function Transport(options) {
  options = options || {};

  assert(options.adapter instanceof BaseTransportAdapter, 'Invalid Transport adapter');

  this._adapter = options.adapter;
  this._adapter.on(Constants.Event.TRANSPORT_ADAPTER_MESSAGE, this._onAdapterMessage.bind(this));
  this._adapter.on(Constants.Event.TRANSPORT_ADAPTER_STATUS_CHANGED, this._onAdapterStatusChanged.bind(this));

  this._callbacks = {};
}

util.inherits(Transport, EventEmitter);

///////////////////////////////////////////////////////////////////////////////
// METHODS

Transport.prototype.connect = function() {
  this._adapter.connect();
};

Transport.prototype.disconnect = function() {
  this._adapter.disconnect();
};

Transport.prototype.reconnect = function() {
  this._adapter.reconnect();
};

Transport.prototype.sendMessage = function(message, callback) {
  if (callback) {
    this._callbacks[message.index] = callback;
  }

  this._adapter.sendMessage(message);
};

Transport.prototype.setSession = function(session) {
  this._adapter.setSession(session);
};

Transport.prototype._onAdapterMessage = function(message) {
  if (message instanceof ReplyMessage) {
    this._onReplyMessage(message);
  }

  this.emit(Constants.Event.TRANSPORT_MESSAGE, message);
};

Transport.prototype._onAdapterStatusChanged = function(status) {
  switch (status) {
    case Constants.TransportStatus.CLOSED:
      log('Closed');
      break;
    case Constants.TransportStatus.CONNECTING:
      log(util.format('Connecting to %s', this._adapter.url));
      break;
    case Constants.TransportStatus.CONNECTED:
      log('Connected');
      break;
  }

  this.emit(Constants.Event.TRANSPORT_STATUS_CHANGED, status);
};

Transport.prototype._onReplyMessage = function(message) {
  // Execute reply message callback
  var callback = this._callbacks[message.replyTo];
  if (callback) {
    callback(message);
    delete this._callbacks[message.replyTo];
  }
};
