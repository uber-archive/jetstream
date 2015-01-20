//
// synthetic_transport_listener.js
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

module.exports = SyntheticTransportListener;

var AbstractTransportListener = require('./abstract_transport_listener');
var Errors = require('../errors');
var logger = require('../logger');
var once = require('once');
var SyntheticTransport = require('./synthetic_transport');
var util = require('util');

var debug = logger.debug.bind(logger, 'transport:syntheticTransportListener');

function SyntheticTransportListener() {
    this.clientsBySessionToken = {};
}

util.inherits(SyntheticTransportListener, AbstractTransportListener);

/**
 * Handles an incoming connection.
 * 
 * @param {SyntheticConnection} connection The incoming connection.
 * @api public
 */ 
SyntheticTransportListener.prototype.incomingConnection = function(connection) {
    debug('received connection', connection);

    var params = connection.params;
    if (!params.hasOwnProperty('sessionToken')) {
        // If no session token this must be first connection.
        debug('creating new session for connection', connection);
        this._onNewSession(connection);
    } else {
        // Re-establish session
        debug('re-establishing existing session for connection', connection);
        this._onResumeSession(connection, params.sessionToken);
    }
};

SyntheticTransportListener.prototype._onNewSession = function(connection) {
    var onSessionOrDeniedOnce = once(onSessionOrDenied);
    connection.once('session', onSessionOrDeniedOnce.bind(null, 'session'));
    connection.once('sessionDenied', onSessionOrDeniedOnce.bind(null, 'sessionDenied'));

    this.emit('connection', connection);

    var self = this;
    function onSessionOrDenied(type, connection, session, client) {
        if (type === 'session') {
            self._onAcceptNewSession(connection, session, client);
        } else {
            self._onDenyNewSession(connection, session, client);
        }
    }
};

SyntheticTransportListener.prototype._onAcceptNewSession = function(connection, session, client) {
    this.clientsBySessionToken[session.token] = client;

    // Ensure when the session expires we remove it
    session.once('expire', this._onSessionExpire.bind(this, session));

    var transport = new SyntheticTransport({connection: connection});
    client.setTransport(transport);
    client.sendAcceptSessionMessage();
};

SyntheticTransportListener.prototype._onDenyNewSession = function(connection, session, client) {
    var transport = new SyntheticTransport({connection: connection});
    client.setTransport(transport);
    client.sendDenySessionMessage();
};

SyntheticTransportListener.prototype._onResumeSession = function(connection, sessionToken) {
    var client = this.clientsBySessionToken[sessionToken];

    if (!client) {
        // Bad token or session already expired
        return connection.deny(new Errors.ConnectionSessionTokenUnrecognized());
    }

    client.transport.resumeWithConnection(connection);
};

SyntheticTransportListener.prototype._onSessionExpire = function(session) {
    delete this.clientsBySessionToken[session.token];
};
