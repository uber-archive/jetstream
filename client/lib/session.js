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

module.exports = Session;

var assert = require('assert');
var ChangeSetQueue = require('./change-set-queue');
var Client = require('./client');
var Constants = require('./constants');
var EventEmitter = require('events').EventEmitter;
var log = require('./log')('Session');
var ScopeFetchMessage = require('./message/scope-fetch-message');
var ScopeFetchReplyMessage = require('./message/scope-fetch-reply-message');
var ScopeStateMessage = require('./message/scope-state-message');
var ScopeSyncMessage = require('./message/scope-sync-message');
var ScopeSyncReplyMessage = require('./message/scope-sync-reply-message');
var util = require('util');

var _noop = function() {};

function Session(options) {
  options = options || {};

  assert(options.client instanceof Client, 'Invalid Session client');
  assert(typeof options.token === 'string', 'Invalid Session token');

  this.serverIndex = 0;

  this._changeSetQueue = new ChangeSetQueue();
  this._client = options.client;
  this._closed = false;
  this._nextMessageIndex = 1;
  this._scopes = [];
  this._token = options.token;

  // Bind prototype methods
  this._onScopeChanges = Session.prototype._onScopeChanges.bind(this);
}

util.inherits(Session, EventEmitter);

///////////////////////////////////////////////////////////////////////////////
// METHODS

Session.prototype.close = function() {
  for (var i = 0; i < this._scopes.length; i++) {
    var scope = this._scopes[i];
    if (scope) {
      scope.removeListener(Constants.Event.SCOPE_CHANGES, this._onScopeChanges);
    }
  }

  this._scopes = [];
  this._closed = true;
};

Session.prototype.fetch = function(scope, callback) {
  callback = callback || _noop;

  if (this._closed) {
    return callback(Constants.Error.SESSION_CLOSED_ERROR);
  }

  var scopeFetchMessage = new ScopeFetchMessage({
    index: this._getNextMessageIndex(),
    name: scope.name
  });

  this._client.sendMessage(scopeFetchMessage, function(message) {
    if (message instanceof ScopeFetchReplyMessage) {
      if (message.error) {
        log.error(message.error);
        return callback(message.error);
      }

      if (this._closed) {
        log.error('Received ScopeFetchReplyMessage with a closed session');
        return callback(Constants.Error.SESSION_CLOSED_ERROR);
      }

      this._onScopeAttach(scope, message.scopeIndex);
      callback();
    } else {
      log.error('Received invalid ScopeFetchReplyMessage');
      callback(Constants.Error.SCOPE_FETCH_ERROR);
    }
  }.bind(this));
};

Session.prototype.onMessage = function(message) {
  if (this._closed) {
    return;
  }

  if (message.index !== 0) {
    if (message.index <= this.serverIndex) {
      log.info('Received message already seen');
      return;
    }

    if (message.index !== this.serverIndex + 1) {
      log.error('Received message out of order');
      this._client.reconnect();
      return;
    }

    this.serverIndex = message.index;
  }

  if (message instanceof ScopeStateMessage) {
    this._onScopeStateMessage(message);
  } else if (message instanceof ScopeSyncMessage) {
    this._onScopeSyncMessage(message);
  }
};

Session.prototype._getNextMessageIndex = function() {
  return this._nextMessageIndex++;
};

Session.prototype._onScopeAttach = function(scope, scopeIndex) {
  // Bind the listener to scope changes
  scope.on(Constants.Event.SCOPE_CHANGES, this._onScopeChanges);
  this._scopes[scopeIndex] = scope;
};

Session.prototype._onScopeChanges = function(scope, changeSet) {
  if (this._closed) {
    return;
  }

  var scopeSyncMessage = new ScopeSyncMessage({
    atomic: changeSet.atomic,
    index: this._getNextMessageIndex(),
    scopeIndex: this._scopes.indexOf(scope),
    syncFragments: changeSet.syncFragments
  });

  this._changeSetQueue.addChangeSet(changeSet);
  this._client.sendMessage(scopeSyncMessage, function(message) {
    if (message instanceof ScopeSyncReplyMessage) {
      changeSet.applyFragmentReplies(message.fragmentReplies, scope);
    } else {
      changeSet.revertOnScope(scope);
    }
  });
};

Session.prototype._onScopeStateMessage = function(message) {
  var scope = this._scopes[message.scopeIndex];
  if (scope && scope.root) {
    scope.applyRemote(function() {
      scope.applySyncFragmentsWithRoot(message.rootUUID, message.syncFragments);
    });
  } else {
    log.error('Received ScopeStateMessage without a valid scope and scope root');
  }
};

Session.prototype._onScopeSyncMessage = function(message) {
  var scope = this._scopes[message.scopeIndex];
  if (scope && scope.root) {
    if (message.syncFragments.length > 0) {
      scope.applyRemote(function() {
        scope.applySyncFragments(message.syncFragments);
      });
    } else {
      log.error('Received ScopeSyncMessage without syncFragments');
    }
  } else {
    log.error('Received ScopeSyncMessage without a valid scope and scope root');
  }
};
