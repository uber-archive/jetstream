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

module.exports = WebSocketTransportAdapter;

var assert = require('assert');
var BaseMessage = require('../message/base-message');
var BaseTransportAdapter = require('./base-transport-adapter');
var Constants = require('../constants');
var log = require('../log')('WebSocketTransportAdapter');
var PingMessage = require('../message/ping-message');
var util = require('util');

function WebSocketTransportAdapter(options) {
  options = options || {};

  assert(typeof options.url === 'string', 'Invalid WebSocketTransportAdapter url');

  BaseTransportAdapter.call(this, options);

  this.name = 'WebSocketTransport';
  this.url = options.url;

  this._explicitlyClosed = false;
  this._nonAckedMessages = [];
  this._session = null;
  this._status = Constants.TransportStatus.CLOSED;

  this._pingTimer = null;
  this._inactivityPingInterval = options.inactivityPingInterval ||
    Constants.Transport.INACTIVITY_PING_INTERVAL;
  this._inactivityPingIntervalVariance = options.inactivityPingIntervalVariance ||
    Constants.Transport.INACTIVITY_PING_INTERVAL_VARIANCE;
}

util.inherits(WebSocketTransportAdapter, BaseTransportAdapter);

WebSocketTransportAdapter.prototype.connect = function() {
  if (this._status !== Constants.TransportStatus.CLOSED) {
    return;
  }

  this._socket = new WebSocket(this.url);
  this._bindSocketEvents();

  this._changeStatus(Constants.TransportStatus.CONNECTING);
};

WebSocketTransportAdapter.prototype.disconnect = function() {
  if (this._status === Constants.TransportStatus.CLOSED) {
    return;
  }

  this._stopPing();

  this._explicitlyClosed = true;
  this._session = null;

  this._socket.close();
  this._socket = null;
};

WebSocketTransportAdapter.prototype.reconnect = function() {
  if (this._status !== Constants.TransportStatus.CONNECTED) {
    return;
  }

  this.disconnect();
};

WebSocketTransportAdapter.prototype.sendMessage = function(message) {
  try {
    // Convert the message to JSON
    var json = JSON.stringify(message.toJSON());

    if (this._session) {
      this._nonAckedMessages.push(message);
    }

    if (this._status === Constants.TransportStatus.CONNECTED) {
      log('Message sent', message);

      // Send the message JSON through the socket
      this._socket.send(json);
    }
  } catch(e) {
    log.error('Message send error', e, message);
  }
};

WebSocketTransportAdapter.prototype.setSession = function(session) {
  this._session = session;
  this._startPing();
};

WebSocketTransportAdapter.prototype._bindSocketEvents = function() {
  this._socket.onopen = this._onSocketOpen.bind(this);
  this._socket.onclose = this._onSocketClose.bind(this);
  this._socket.onmessage = this._onSocketMessage.bind(this);
};

WebSocketTransportAdapter.prototype._startPing = function() {
  this._stopPing();

  // Calculate ping delay with variance
  var varianceLowerBound = this._inactivityPingInterval - (this._inactivityPingIntervalVariance / 2);
  var randomVariance = Math.random() * this._inactivityPingIntervalVariance;
  var delay = varianceLowerBound + randomVariance;

  this._pingTimer = setTimeout(this._onPing.bind(this), delay);
};

WebSocketTransportAdapter.prototype._stopPing = function() {
  clearTimeout(this._pingTimer);
  this._pingTimer = null;
};

WebSocketTransportAdapter.prototype._onPing = function() {
  var pingMessage = new PingMessage({
    session: this._session
  });

  this.sendMessage(pingMessage);
  this._startPing();
};

WebSocketTransportAdapter.prototype._onPingMessage = function(message) {
  // Filter non-acked messages before the last ack
  this._nonAckedMessages = this._nonAckedMessages.filter(function(m) {
    return m.index > message.ack;
  });

  // Resend non-acked messages
  if (message.resendMissing) {
    this._nonAckedMessages.forEach(this.sendMessage.bind(this));
  }
};

WebSocketTransportAdapter.prototype._onSocketOpen = function() {
  this._changeStatus(Constants.TransportStatus.CONNECTED);

  // Request missing messages to be resent
  if (this._session) {
    var pingMessage = new PingMessage({
      session: this._session,
      resendMissing: true
    });

    this.sendMessage(pingMessage);
    this._startPing();
  }
};

WebSocketTransportAdapter.prototype._onSocketClose = function() {
  this._changeStatus(Constants.TransportStatus.CLOSED);
  this._stopPing();

  // Reconnect if the socket was not explicitly closed
  if (!this._explicitlyClosed) {
    this.connect();
  }
};

WebSocketTransportAdapter.prototype._onSocketMessage = function(message) {
  var messages = [];

  // Parse message JSON data
  try {
    messages = JSON.parse(message.data);
    if (!(messages instanceof Array)) {
      messages = [messages];
    }
  } catch(e) {
    log.error('Message parse error', e, message);
  }

  for (var i = 0; i < messages.length; i++) {
    message = BaseMessage.parse(messages[i]);

    log('Message received', message);

    if (message instanceof PingMessage) {
      this._onPingMessage(message);
    }

    this.emit(Constants.Event.TRANSPORT_ADAPTER_MESSAGE, message);
  }
};
