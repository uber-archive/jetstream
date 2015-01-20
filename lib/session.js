//
// session.js
// Jetstream
// 
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

var _ = require('lodash');
var Client = require('./client');
var Errors = require('./errors');
var EventEmitter = require('events').EventEmitter;
var logger = require('./logger');
var Scope = require('./scope');
var SyncFragment = require('./sync_fragment');
var Token = require('./token');
var util = require('util');
var uuid = require('node-uuid');

var CONST = {};
CONST.DEFAULT_INACTIVITY_EXPIRY_TIMEOUT = 10 * 60 * 1000;
CONST = Object.freeze(CONST);

function Session(options) {
    options = options || {};

    if (options.clientType) {
        this.setClientType(options.clientType);
    } else {
        this.clientType = null;
    }

    this.uuid = uuid.v4();
    this.client = null;
    this.token = null;
    this.params = options.params || {};
    this.accepted = true;
    this.expired = false;
    this._nextMessageIndex = 0;
    this._scopes = [];
    this._scopeListeners = [];
    this._inactivityExpiryTimeout = null;
    this._inactivityExpiryTimeoutDuration = 
        options.inactivityExpiryTimeoutDuration ||
        CONST.DEFAULT_INACTIVITY_EXPIRY_TIMEOUT;

    // Guard to only send a public expire event once
    this.once('_expire', function() {
        this.emit('expire');
        logger.trace('Session expired', {sessionToken: this.token});
        this.client = null;
        this.expired = true;
        // Remove all active listeners for scope changes
        this._scopes.forEach(function(scope, index) {
            var scopeListener = this._scopeListeners[index];
            scope.removeListener('changes', scopeListener);
        }.bind(this));
        this._scopes = [];
        this._scopeListeners = [];
    }.bind(this));
}

util.inherits(Session, EventEmitter);

Session.CONST = CONST;

Session.prototype.getNextMessageIndex = function() {
    return this._nextMessageIndex++;
};

Session.prototype.setClientType = function(clientType) {
    if (!Client.isChildClass(clientType)) {
        throw new Error('Invalid clientType');
    }
    this.clientType = clientType;
};

Session.prototype.accept = function(clientType) {
    if (clientType) {
        this.setClientType(clientType);
    }

    this.accepted = true;

    Token.create(function(err, token) {
        if (err) {
            // TODO: log an error
            return this.deny();
        }

        this.token = token;
        var ClientType = this.clientType || Client;
        this.client = new ClientType({token: token, session: this, params: this.params});
        this._bindClientEvents();
        this.emit('accept', this, this.client);
        this._startInactivityExpiryTimeout();
    }.bind(this));
};

Session.prototype.deny = function(clientType) {
    if (clientType) {
        this.setClientType(clientType);
    }

    this.accepted = false;

    var ClientType = this.clientType || Client;
    var deniedClient = new ClientType({session: this, params: this.params});

    this.emit('deny', this, deniedClient);
};

/**
 * Explicitly expire the session if wishing to close up the client's session.
 */
Session.prototype.expire = function() {
    this.emit('_expire');
};

Session.prototype._bindClientEvents = function() {
    this.client.on('scopeFetchMessage', this._onScopeFetchMessage.bind(this));
    this.client.on('scopeSyncMessage', this._onScopeSyncMessage.bind(this));
    this.client.on('activity', this._onClientActivity.bind(this));
};

Session.prototype._onScopeFetchMessage = function(message) {
    var name = message.name;
    var params = message.params;

    this.emit('fetch', name, params, function(err, scope) {
        if (err) {
            return this.client.sendDenyFetchMessage({
                replyTo: message.index,
                error: err
            });
        }

        if (!(scope instanceof Scope)) {
            return this.client.sendDenyFetchMessage({
                replyTo: message.index,
                error: new Error('Server tried to accept with non-scope')
            });
        }

        this._addScope(scope);

        var scopeIndex = this._getScopeIndex(scope);
        this.client.sendAcceptFetchMessage({
            replyTo: message.index,
            scopeIndex: scopeIndex
        });
        this.client.sendScopeStateMessage(scope, scopeIndex);
    }.bind(this));
};

Session.prototype._onScopeSyncMessage = function(message) {
    var scope = this._scopes[message.scopeIndex];
    if (!scope) {
        return this.client.sendScopeSyncReplyMessage({
            replyTo: message.index,
            fragmentReplies: _.map(message.syncFragments, function() {
                var err = new Errors.ScopeAtIndexNotFound({index: message.scopeIndex});
                return SyncFragment.syncFragmentResult(err);
            })
        });
    }

    var options = {
        context: {client: this.client},
        atomic: message.atomic,
        procedure: message.procedure
    };
    scope.applySyncFragments(message.syncFragments, options, function(err, results) {
        if (err) {
            logger.error('Could not apply sync fragments from client scope sync message', {
                error: err
            });
            return this.client.sendScopeSyncReplyMessage({
                replyTo: message.index,
                fragmentReplies: _.map(message.syncFragments, function() {
                    var syncFragmentError = new Errors.CouldNotApplySyncMessage({reason: err.message});
                    return SyncFragment.syncFragmentResult(syncFragmentError);
                })
            });
        }

        // TODO: support additional fragments
        return this.client.sendScopeSyncReplyMessage({
            replyTo: message.index,
            fragmentReplies: results
        });
    }.bind(this));
};

Session.prototype._startInactivityExpiryTimeout = function() {
    this._inactivityExpiryTimeout = setTimeout(
        this._inactivityExpiryTimeoutFired.bind(this),
        this._inactivityExpiryTimeoutDuration);
};

Session.prototype._onClientActivity = function(message) {
    if (this._inactivityExpiryTimeout) {
        clearTimeout(this._inactivityExpiryTimeout);
    }
    this._startInactivityExpiryTimeout();
};

Session.prototype._inactivityExpiryTimeoutFired = function(message) {
    this.expire();
};

Session.prototype._addScope = function(scope) {
    var scopeListener = function(syncFragments, withOptions) {
        var index = this._getScopeIndex(scope);
        if (index !== -1) {
            this._onScopeChanges(scope, index, syncFragments, withOptions);
        }
    }.bind(this);

    scope.on('changes', scopeListener);

    this._scopes.push(scope);
    this._scopeListeners.push(scopeListener);
};

Session.prototype._removeScope = function(scope) {
    var scopeIndex = this._getScopeIndex(scope);
    var scopeListener = this._scopeListeners[scopeIndex];
    this._scopes = _.without(this._scopes, scope);
    this._scopeListeners = _.without(this._scopeListeners, scopeListener);
};

Session.prototype._getScopeIndex = function(scope) {
    return this._scopes.indexOf(scope);
};

Session.prototype._onScopeChanges = function(scope, scopeIndex, syncFragments, withOptions) {
    var context = withOptions.context;
    if (context && context.client === this.client) {
        // Don't bother sending sync fragments to originating clients
        return;
    }

    this.client.sendScopeSyncMessage(scope, scopeIndex, syncFragments);
};
