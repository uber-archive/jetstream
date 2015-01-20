//
// client.js
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

module.exports = Client;

var AbstractNetworkMessage = require('./message/abstract_network_message');
var AbstractTransport = require('./transport/abstract_transport');
var async = require('async');
var callbackOrEmitError = require('callback-or-emit-error');
var EventEmitter = require('events').EventEmitter;
var logger = require('./logger');
var maybeCallback = require('maybe-callback');
var PingMessage = require('./message/ping_message');
var Scope = require('./scope');
var ScopeFetchMessage = require('./message/scope_fetch_message');
var ScopeFetchReplyMessage = require('./message/scope_fetch_reply_message');
var ScopeStateMessage = require('./message/scope_state_message');
var ScopeSyncMessage = require('./message/scope_sync_message');
var ScopeSyncReplyMessage = require('./message/scope_sync_reply_message');
var Session = require('./session');
var SessionCreateReplyMessage = require('./message/session_create_reply_message');
var SyncFragment = require('./sync_fragment');
var util = require('util');

var debug = logger.debug.bind(logger, 'core:client');

function Client(options) {
    options = options || {};

    if (!(options.session instanceof Session)) {
        throw new Error('Invalid session');
    }

    this.session = options.session;
    this.transport = null;
    this._partialSessionToken = this.session.token ? this.session.token.substring(0, 12) : '';
    this._bindSessionEvents();
}

util.inherits(Client, EventEmitter);

Client.baseType = Client;

Client.isChildClass = function(cls) {
    if (!cls || !cls.baseType) {
        return false;
    }
    return cls.baseType === this.baseType;
};

Client.prototype._bindSessionEvents = function() {
    this.session.once('expire', this._onSessionExpire.bind(this));
};

Client.prototype._traceLogWithMessage = function(str, message) {
    str = '<' + this._partialSessionToken + '> ' + str;

    // Only perform toJSON when trace which actually be emitted, perform on toString
    var messageDescriber = function() {};
    messageDescriber.toString = function() {
        return JSON.stringify(message.toJSON());
    };
    logger.trace(str, {
        sessionToken: this.session.token,
        message: messageDescriber
    });
};

Client.prototype.setTransport = function(transport) {
    if (!(transport instanceof AbstractTransport)) {
        throw new Error('Invalid transport');
    }

    var transportName = Object.getPrototypeOf(transport).constructor.name;
    transport.on('data', this._onMessage.bind(this));
    transport.on('error', function(err) {
        logger.error('Client ' + transportName + ' error occurred', {
            error: err
        });
    });

    this.transport = transport;
};

Client.prototype.sendMessage = function(message, callback) {
    this.transport.write(message, function(err) {
        if (err) {
            debug('Failed to send message due to error', err);
            return callbackOrEmitError(this, callback, err);
        }

        this._traceLogWithMessage('Sent message', message);
        maybeCallback(callback)();
    }.bind(this));
};

Client.prototype.sendAcceptSessionMessage = function(callback) {
    var message = new SessionCreateReplyMessage({
        index: this.session.getNextMessageIndex(),
        sessionToken: this.session.token
    });
    this.sendMessage(message, callback);
};

Client.prototype.sendDenySessionMessage = function(callback) {
    var message = new SessionCreateReplyMessage({
        index: this.session.getNextMessageIndex(),
        error: new Error('Session creation denied')
    });
    this.sendMessage(message, callback);
    // Explicitly expire the session to close up the transport and any other resources
    this.session.expire();
};

Client.prototype.sendAcceptFetchMessage = function(options, callback) {
    var message = new ScopeFetchReplyMessage({
        index: this.session.getNextMessageIndex(),
        replyTo: options.replyTo,
        scopeIndex: options.scopeIndex
    });
    this.sendMessage(message, callback);
};

Client.prototype.sendDenyFetchMessage = function(options, callback) {
    var message = new ScopeFetchReplyMessage({
        index: this.session.getNextMessageIndex(),
        replyTo: options.replyTo,
        error: options.error
    });
    this.sendMessage(message, callback);
};

Client.prototype.sendScopeSyncReplyMessage = function(options, callback) {
    var message = new ScopeSyncReplyMessage({
        index: this.session.getNextMessageIndex(),
        replyTo: options.replyTo,
        fragmentReplies: options.fragmentReplies
    });
    this.sendMessage(message, callback);
};

Client.prototype.sendScopeStateMessage = function(scope, scopeIndex, callback) {
    var err;
    if (!(scope instanceof Scope)) {
        err = new Error('Invalid scope');
        logger.error('Client cannot send full sync message for invalid scope', {
            error: err
        });
        return callbackOrEmitError(this, callback, err);
    }

    if (typeof scopeIndex !== 'number') {
        err = new Error('Invalid scopeIndex');
        logger.error('Client cannot send full sync message for scope without scopeIndex', {
            error: err
        });
        return callbackOrEmitError(this, callback, err);
    }

    async.waterfall([
        function getModelObjects(nextCallback) {
            scope.getAllModelObjects(nextCallback);
        },

        function getSyncFragments(modelObjects, nextCallback) {
            // TODO: sliced map to avoid blocking CPU
            async.map(modelObjects, function(modelObject, doneCallback) {
                var syncFragment;
                try {
                    syncFragment = modelObject.getAddSyncFragment();
                } catch (err) {
                    return doneCallback(err);
                }
                doneCallback(null, syncFragment);

            }, nextCallback);
        }

    ], function(err, syncFragments) {
        if (err) {
            logger.error('Failed to send scope state message', {
                error: err
            });
            return callbackOrEmitError(this, callback, err);
        }

        if (syncFragments.length < 1) {
            err = new Error('syncFragments for state message is empty array');
            logger.error('Scope state message is empty', {
                error: err
            });
            return callbackOrEmitError(this, callback, err);
        }

        var rootFragment = syncFragments[0];
        rootFragment.type = SyncFragment.CONST.TYPE_CHANGE;

        var message = new ScopeStateMessage({
            index: this.session.getNextMessageIndex(),
            scopeIndex: scopeIndex,
            rootUUID: rootFragment.objectUUID,
            syncFragments: syncFragments
        });
        this.sendMessage(message, callback);
    }.bind(this));
};

Client.prototype.sendScopeSyncMessage = function(scope, scopeIndex, syncFragments, callback) {
    var err;
    if (!(scope instanceof Scope)) {
        err = new Error('Invalid scope');
        logger.error('Client cannot send sync message for invalid scope', {
            error: err
        });
        return callbackOrEmitError(this, callback, err);
    }

    if (typeof scopeIndex !== 'number') {
        err = new Error('Invalid scopeIndex');
        logger.error('Client cannot send sync message for scope without scopeIndex', {
            error: err
        });
        return callbackOrEmitError(this, callback, err);
    }

    var message = new ScopeSyncMessage({
        index: this.session.getNextMessageIndex(),
        scopeIndex: scopeIndex,
        syncFragments: syncFragments
    });
    this.sendMessage(message, callback);
};

Client.prototype._onMessage = function(message) {
    if (!(message instanceof AbstractNetworkMessage)) {
        return logger.error('Client received invalid message', {
            error: new Error('Invalid message')
        });
    }

    this.emit('activity');
    if (!(message instanceof PingMessage)) {
        this._traceLogWithMessage('Received message', message);
    }

    if (message instanceof ScopeFetchMessage) {
        // Trigger session request for scope
        return this.emit('scopeFetchMessage', message);
    } else if (message instanceof ScopeSyncMessage) {
        // Trigger persisting and sending out sync messages
        return this.emit('scopeSyncMessage', message);
    }
};

Client.prototype._onSessionExpire = function() {
    if (!this.transport) {
        return;
    }

    var sessionToken = this.session.token;
    this.transport.end(function(err) {
        if (err) {
            logger.error('Failed to close up transport after client session expired', {
                error: err,
                sessionToken: sessionToken
            });
        }
    });

    this.session = null;
    this.transport = null;
};
