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

var km = require('keymirror');

module.exports = Object.freeze({

  ChangeSetState: km({
    COMPLETED: null,
    PARTIALLY_REVERTED: null,
    REVERTED: null,
    SYNCING: null
  }),

  ClientStatus: km({
    OFFLINE: null,
    ONLINE: null
  }),

  Error: km({
    SCOPE_FETCH_ERROR: null,
    SESSION_CLOSED_ERROR: null
  }),

  Event: {
    CHANGE_SET_ADDED: 'changeSetAdded',
    CHANGE_SET_COMPLETE: 'changeSetComplete',
    CHANGE_SET_ERROR: 'changeSetError',
    CHANGE_SET_REMOVED: 'changeSetRemoved',
    CHANGE_SET_STATE_CHANGED: 'changeSetStateChanged',
    CLIENT_SESSION: 'session',
    CLIENT_SESSION_DENIED: 'sessionDenied',
    CLIENT_STATUS_CHANGED: 'statusChanged',
    MODEL_PROPERTY_CHANGED: 'propertyChanged',
    MODEL_SCOPE_ATTACHED: 'scope',
    MODEL_SCOPE_DETACHED: 'scopeDetached',
    MODEL_TREE_CHANGED: 'treeChanged',
    SCOPE_CHANGES: 'changes',
    TRANSPORT_ADAPTER_MESSAGE: 'message',
    TRANSPORT_ADAPTER_STATUS_CHANGED: 'statusChanged',
    TRANSPORT_MESSAGE: 'message',
    TRANSPORT_STATUS_CHANGED: 'statusChanged'
  },

  Scope: {
    CHANGE_INTERVAL: 10
  },

  SyncFragmentType: {
    ADD: 'add',
    CHANGE: 'change'
  },

  Transport: {
    INACTIVITY_PING_INTERVAL: 10 * 1000,
    INACTIVITY_PING_INTERVAL_VARIANCE: 2 * 1000
  },

  TransportStatus: km({
    CLOSED: null,
    CONNECTED: null,
    CONNECTING: null
  }),

  Version: '0.1.0'

});
