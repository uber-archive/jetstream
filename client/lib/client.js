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

module.exports = Client;

var assert = require('assert');
var BaseTransportAdapter = require('./transport/base-transport-adapter');
var Constants = require('./constants');
var EventEmitter = require('events').EventEmitter;
var log = require('./log')('Client');
var Session = require('./session');
var SessionCreateMessage = require('./message/session-create-message');
var SessionCreateReplyMessage = require('./message/session-create-reply-message');
var Transport = require('./transport/transport');
var util = require('util');

function Client(options) {
  options = options || {};

  assert(options.transport instanceof BaseTransportAdapter, 'Invalid Client transport');

  this._transport = new Transport({ adapter: options.transport });
  this._transport.on(Constants.Event.TRANSPORT_MESSAGE, this._onTransportMessage.bind(this));
  this._transport.on(Constants.Event.TRANSPORT_STATUS_CHANGED, this._onTransportStatusChanged.bind(this));

  this._session = null;
  this._status = Constants.ClientStatus.OFFLINE;
  this._version = Constants.Version;
}

util.inherits(Client, EventEmitter);

///////////////////////////////////////////////////////////////////////////////
// METHODS

Client.prototype.connect = function() {
  this._transport.connect();
};

Client.prototype.disconnect = function() {
  this._transport.disconnect();

  if (this.session) {
    this._session.close();
    this._session = null;
  }
};

Client.prototype.reconnect = function() {
  this._transport.reconnect();
};

Client.prototype.sendMessage = function(message, callback) {
  this._transport.sendMessage(message, callback);
};

Client.prototype._onTransportMessage = function(message) {
  if (message instanceof SessionCreateReplyMessage) {
    if (this._session) {
      log.error('Received SessionCreateReplyMessage with existing session');
    } else if (message.sessionToken) {
      log('Received SessionCreateReplyMessage success');

      // Initialize a new session with the sessionToken
      this._session = new Session({
        client: this,
        token: message.sessionToken
      });

      this._transport.setSession(this._session);

      this.emit(Constants.Event.CLIENT_SESSION, this._session);
    } else {
      log.error('Received SessionCreateReplyMessage error', message.error);
      this.emit(Constants.Event.CLIENT_SESSION_DENIED);
    }
  } else if (this._session) {
    this._session.onMessage(message);
  }
};

Client.prototype._onTransportStatusChanged = function(transportStatus) {
  var status = Constants.ClientStatus.OFFLINE;
  if (transportStatus === Constants.TransportStatus.CONNECTED) {
    status = Constants.ClientStatus.ONLINE;
  }

  if (this._status !== status) {
    if (status === Constants.ClientStatus.ONLINE) {
      log('Online');

      if (!this._session) {
        // Send a request to create a session when online
        var sessionCreateMessage = new SessionCreateMessage({
          version: this._version
        });
        
        this._transport.sendMessage(sessionCreateMessage);
      }
    } else {
      log('Offline');
    }

    this._status = status;
    this.emit(Constants.Event.CLIENT_STATUS_CHANGED, this._status);
  }
};
