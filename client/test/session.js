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

var ChangeSet = require('../lib/change-set');
var Client = require('../lib/client');
var Constants = require('../lib/constants');
var Scope = require('../lib/scope');
var ScopeFetchMessage = require('../lib/message/scope-fetch-message');
var ScopeFetchReplyMessage = require('../lib/message/scope-fetch-reply-message');
var ScopeStateMessage = require('../lib/message/scope-state-message');
var ScopeSyncMessage = require('../lib/message/scope-sync-message');
var ScopeSyncReplyMessage = require('../lib/message/scope-sync-reply-message');
var Session = require('../lib/session');
var sinon = require('sinon');
var test = require('tape');

var changeSet, client, scopeOne, scopeTwo, session;
var scopeStateMessage, scopeSyncMessage;

function setup(suite) {
  return function(name, fn) {
    suite.test(name, function(t) {
      changeSet = sinon.createStubInstance(ChangeSet);

      client = sinon.createStubInstance(Client);
      client.sendMessage.callsArg(1);

      scopeOne = sinon.createStubInstance(Scope);
      scopeOne.name = 'ScopeOne';
      scopeTwo = sinon.createStubInstance(Scope);
      scopeTwo.name = 'ScopeTwo';

      session = new Session({ client: client, token: 'token' });

      scopeStateMessage = new ScopeStateMessage({
        index: 1,
        rootUUID: 'uuid',
        scopeIndex: 0,
        syncFragments: []
      });

      scopeSyncMessage = new ScopeSyncMessage({
        index: 1,
        scopeIndex: 0,
        syncFragments: []
      });

      fn(t);
    });
  };
}

test('Session', function(suite) {
  var it = setup(suite);

  it('should throw if instantiated without a client', function(t) {
    t.throws(function() { new Session(); });
    t.end();
  });

  it('should throw if instantiated without a token', function(t) {
    t.throws(function() {
      new Session({ client: client });
    });

    t.end();
  });

  it('should initialize with a client and token', function(t) {
    var session = new Session({ client: client, token: 'token' });

    t.equal(session._client, client);
    t.equal(session._token, 'token');
    t.end();
  });
});

test('Session.prototype.close', function(suite) {
  var it = setup(suite);

  it('should stop listening to "scopeChanges" events on its scopes', function(t) {
    session._scopes = [scopeOne, scopeTwo];
    session.close();

    t.ok(scopeOne.removeListener.calledWithExactly(Constants.Event.SCOPE_CHANGES, session._onScopeChanges));
    t.ok(scopeTwo.removeListener.calledWithExactly(Constants.Event.SCOPE_CHANGES, session._onScopeChanges));
    t.end();
  });

  it('should remove all scopes and set its status to closed', function(t) {
    session._scopes = [scopeOne, scopeTwo];
    session.close();

    t.equal(session._scopes.length, 0);
    t.equal(session._closed, true);
    t.end();
  });
});

test('Session.prototype.fetch', function(suite) {
  var it = setup(suite);

  it('should not call sendMessage on its client when closed', function(t) {
    session._closed = true;

    session.fetch(scopeOne);

    t.notOk(session._client.sendMessage.called);
    t.end();
  });

  it('should call sendMessage on its client with a ScoepFetchMessage containing the scope name', function(t) {
    session.fetch(scopeOne);

    var message = session._client.sendMessage.firstCall.args[0];

    t.ok(message instanceof ScopeFetchMessage);
    t.equal(message.name, scopeOne.name);
    t.end();
  });

  it('should call sendMessage on its client and not call _onScopeAttach on an invalid ScopeFetchReplyMessage', function(t) {
    var spy = sinon.spy(session, '_onScopeAttach');

    session._client.sendMessage.callsArg(1);
    session.fetch(scopeOne);

    t.ok(session._client.sendMessage.called);
    t.notOk(spy.called);
    t.end();
  });

  it('should call sendMessage on its client and not call _onScopeAttach on a ScopeFetchReplyMessage with an error', function(t) {
    var spy = sinon.spy(session, '_onScopeAttach');
    var message = new ScopeFetchReplyMessage({
      error: true,
      index: 0,
      replyTo: 0,
      scopeIndex: 0
    });

    session._client.sendMessage.callsArgWith(1, message);
    session.fetch(scopeOne);

    t.ok(session._client.sendMessage.called);
    t.notOk(spy.called);
    t.end();
  });

  it('should call sendMessage on its client and call _onScopeAttach on a valid ScopeFetchReplyMessage', function(t) {
    var spy = sinon.spy(session, '_onScopeAttach');
    var message = new ScopeFetchReplyMessage({
      index: 0,
      replyTo: 0,
      scopeIndex: 0
    });

    session._client.sendMessage.callsArgWith(1, message);
    session.fetch(scopeOne);

    t.ok(session._client.sendMessage.called);
    t.ok(spy.calledWithExactly(scopeOne, message.scopeIndex));
    t.end();
  });
});

test('Session.prototype.onMessage', function(suite) {
  var it = setup(suite);

  it('should not call _onScopeStateMessage on a ScopeStateMessage when closed', function(t) {
    session._closed = true;

    var spy = sinon.spy(session, '_onScopeStateMessage');
    session.onMessage(scopeStateMessage);

    t.notOk(spy.called);
    t.end();
  });

  it('should not call _onScopeSyncMessage on a ScopeSyncMessage when closed', function(t) {
    session._closed = true;

    var spy = sinon.spy(session, '_onScopeSyncMessage');
    session.onMessage(scopeSyncMessage);

    t.notOk(spy.called);
    t.end();
  });

  it('should not set serverIndex if the message index is equal or lower', function(t) {
    session.serverIndex = 10;
    scopeStateMessage.index = 9;

    session.onMessage(scopeStateMessage);

    t.notEqual(session.serverIndex, scopeStateMessage.index);
    t.equal(session.serverIndex, 10);
    t.end();
  });

  it('should not set serverIndex if the message index is not one more than the serverIndex', function(t) {
    session.serverIndex = 10;
    scopeStateMessage.index = 12;

    session.onMessage(scopeStateMessage);

    t.notEqual(session.serverIndex, scopeStateMessage.index);
    t.equal(session.serverIndex, 10);
    t.end();
  });

  it('should call reconnect on its client if the message index is not one more than the serverIndex', function(t) {
    session.serverIndex = 10;
    scopeStateMessage.index = 12;

    session.onMessage(scopeStateMessage);

    t.ok(session._client.reconnect.called);
    t.end();
  });

  it('should set serverIndex to the next sequential message index', function(t) {
    session.onMessage(scopeStateMessage);

    t.equal(session.serverIndex, scopeStateMessage.index);
    t.end();
  });

  it('should call _onScopeStateMessage if it is not closed and it received the next sequential message index', function(t) {
    var spy = sinon.spy(session, '_onScopeStateMessage');
    session.onMessage(scopeStateMessage);

    t.ok(spy.calledWithExactly(scopeStateMessage));
    t.end();
  });

  it('should call _onScopeSyncMessage if it is not closed and it received the next sequential message index', function(t) {
    var spy = sinon.spy(session, '_onScopeSyncMessage');
    session.onMessage(scopeSyncMessage);

    t.ok(spy.calledWithExactly(scopeSyncMessage));
    t.end();
  });
});

test('Session.prototype._getNextMessageIndex', function(suite) {
  var it = setup(suite);

  it('should increment and return the next message index', function(t) {
    var index = session._nextMessageIndex;

    t.equal(session._getNextMessageIndex(), index++);
    t.equal(session._getNextMessageIndex(), index++);
    t.end();
  });
});

test('Session.prototype._onScopeAttach', function(suite) {
  var it = setup(suite);

  it('should set and listen to "scopeChanges" events when the scope is attached', function(t) {
    session._onScopeAttach(scopeOne, 0);

    t.ok(scopeOne.on.calledWithExactly(Constants.Event.SCOPE_CHANGES, session._onScopeChanges));
    t.equal(session._scopes[0], scopeOne);

    session._onScopeAttach(scopeTwo, 2);

    t.ok(scopeTwo.on.calledWithExactly(Constants.Event.SCOPE_CHANGES, session._onScopeChanges));
    t.equal(session._scopes[2], scopeTwo);

    t.end();
  });
});

test('Session.prototype._onScopeChanges', function(suite) {
  var it = setup(suite);

  it('should not call sendMessage on its client when closed', function(t) {
    session._scopes = [scopeOne];
    session._closed = true;
    session._onScopeChanges(scopeOne, changeSet);

    t.notOk(session._client.sendMessage.called);
    t.end();
  });

  it('should call sendMessage on its client and call applyFragmentReplies on the changeSet on ScopeSyncReplyMessage', function(t) {
    changeSet.syncFragments = [];
    session._scopes = [scopeOne];

    var message = new ScopeSyncReplyMessage({
      index: 0,
      fragmentReplies: [],
      replyTo: 0
    });

    session._client.sendMessage.callsArgWith(1, message);
    session._onScopeChanges(scopeOne, changeSet);

    t.ok(session._client.sendMessage.called);
    t.ok(changeSet.applyFragmentReplies.calledWithExactly(message.fragmentReplies, scopeOne));
    t.end();
  });

  it('should call sendMessage on its client and call revertOnScope on the changeSet on an invalid ScopeSyncReplyMessage', function(t) {
    changeSet.syncFragments = [];
    session._scopes = [scopeOne];

    session._client.sendMessage.callsArg(1);
    session._onScopeChanges(scopeOne, changeSet);
    
    t.ok(session._client.sendMessage.called);
    t.ok(changeSet.revertOnScope.calledWithExactly(scopeOne));
    t.end();
  });
});

test('Session.prototype._onScopeStateMessage', function(suite) {
  var it = setup(suite);

  it('should not call applyRemote nor applySyncFragmentsWithRoot on a scope without a root', function(t) {
    scopeOne.applyRemote.callsArg(0);
    session._scopes = [scopeOne];

    session._onScopeStateMessage(scopeStateMessage);

    t.notOk(scopeOne.applyRemote.called);
    t.notOk(scopeOne.applySyncFragmentsWithRoot.called);
    t.end();
  });

  it('should call applyRemote and applySyncFragmentsWithRoot on the scope at the given scopeIndex', function(t) {
    scopeOne.applyRemote.callsArg(0);
    scopeOne.root = true;
    session._scopes = [scopeOne];

    session._onScopeStateMessage(scopeStateMessage);

    t.ok(scopeOne.applyRemote.called);
    t.ok(scopeOne.applySyncFragmentsWithRoot.calledWithExactly(scopeStateMessage.rootUUID, scopeStateMessage.syncFragments));
    t.end();
  });
});

test('Session.prototype._onScopeSyncMessage', function(suite) {
  var it = setup(suite);

  it('should not call applyRemote nor applySyncFragments if the message does not have syncFragments', function(t) {
    scopeOne.applyRemote.callsArg(0);
    scopeOne.root = true;
    session._scopes = [scopeOne];

    session._onScopeSyncMessage(scopeSyncMessage);
    
    t.notOk(scopeOne.applyRemote.called);
    t.notOk(scopeOne.applySyncFragments.called);
    t.end();
  });

  it('should not call applyRemote nor applySyncFragments on a scope without a root', function(t) {
    scopeOne.applyRemote.callsArg(0);
    session._scopes = [scopeOne];

    scopeSyncMessage.syncFragments = ['test'];
    session._onScopeSyncMessage(scopeSyncMessage);

    t.notOk(scopeOne.applyRemote.called);
    t.notOk(scopeOne.applySyncFragments.called);
    t.end();
  });

  it('should call applyRemote and applySyncFragments on the scope at the given scopeIndex', function(t) {
    scopeOne.applyRemote.callsArg(0);
    scopeOne.root = true;
    session._scopes = [scopeOne];

    scopeSyncMessage.syncFragments = ['test'];
    session._onScopeSyncMessage(scopeSyncMessage);

    t.ok(scopeOne.applyRemote.called);
    t.ok(scopeOne.applySyncFragments.calledWithExactly(scopeSyncMessage.syncFragments));
    t.end();
  });
});
