//
// websocket_transport_listener.js
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

module.exports = WebsocketTransportListener;

var AbstractTransportListener = require('./abstract_transport_listener');
var Errors = require('../errors');
var EventEmitter = require('events').EventEmitter;
var express = require('express');
var logger = require('../logger');
var NetworkMessageParser = require('../message/network_message_parser');
var querystring = require('querystring');
var robb = require('robb/src/robb');
var SessionCreateMessage = require('../message/session_create_message');
var util = require('util');
var WebsocketConnection = require('./websocket_connection');
var WebsocketTransport = require('./websocket_transport');
var ws = require('ws');

var debug = logger.debug.bind(logger, 'transport:websocketTransportListener');

var CONST = {};
CONST.DEFAULT_ESTABLISH_SESSION_TIMEOUT = 10000;
CONST.HEADER_PARAM_PREFIX = 'x-jetstream-';
CONST = Object.freeze(CONST);

function WebsocketTransportListener(options) {
    options = options || {};

    if (!options.server && !options.port) {
        throw new Error('Requires server or port');
    } else if (options.server && options.port) {
        throw new Error('Can only specify server or port');
    } else if (options.server && !(options.server instanceof EventEmitter)) {
        throw new Error('Invalid server');
    } else if (options.port && !robb.isUnsignedInt(options.port)) {
        throw new Error('Invalid port');
    }

    this.clientsBySessionToken = {};
    if (robb.isUnsignedInt(options.establishSessionTimeout)) {
        this.establishSessionTimeout = options.establishSessionTimeout;
    } else {
        this.establishSessionTimeout = CONST.DEFAULT_ESTABLISH_SESSION_TIMEOUT;
    }

    if (options.server) {
        debug('constructed with server');
        this.server = new ws.Server({server: options.server});
    } else {
        debug('constructed with port', {port: options.port});
        var app = express();
        var server = app.listen(options.port);
        this.server = new ws.Server({server: server});
    }

    this._configure();
}

util.inherits(WebsocketTransportListener, AbstractTransportListener);

WebsocketTransportListener.CONST = CONST;

WebsocketTransportListener.prototype._configure = function() {
    this.server.on('connection', this._onConnection.bind(this));
    debug('configured connection handler');
};

WebsocketTransportListener.prototype._onConnection = function(websocket) {
    var params = {};
    var req = websocket.upgradeReq;

    // Extract params
    if (typeof req.headers === 'object') {
        this._paramsExtract(req.headers, params);
    }
    // Express will not parse the query string into 
    // req.query automagically for UPGRADE requests
    if (req.url && req.url.indexOf('?') !== -1) {
        var query = req.url.substring(req.url.indexOf('?')+1);
        var queryParams = querystring.parse(query);
        this._paramsExtract(queryParams, params);
    }

    var connection = new WebsocketConnection({
        params: params, 
        websocket: websocket
    });

    if (!params.sessiontoken) {
        // If no session token this must be first connection.
        this._onNewSession(connection);
    } else {
        // Re-establish session
        this._onResumeSession(connection, params.sessiontoken);
    }
};

WebsocketTransportListener.prototype._paramsExtract = function(object, params) {
    var minimumKeyLength = CONST.HEADER_PARAM_PREFIX.length;
    for (var key in object) {
        if (typeof key === 'string' && key.length > minimumKeyLength) {
            var prefix = key.substring(0, minimumKeyLength).toLowerCase();

            if (prefix === CONST.HEADER_PARAM_PREFIX) {
                var paramKey = key.substring(minimumKeyLength);
                params[paramKey] = object[key];
            }
        }
    }
};

WebsocketTransportListener.prototype._onNewSession = function(connection) {
    this.emit('connection', connection);

    if (!connection.accepted) {
        // Middleware/application already denied this connection
        return;
    }

    var timedOut = false;
    var timeout = null;

    connection.websocket.once('message', function(data) {
        if (timedOut) {
            return;
        }

        // Clear the timeout we started for this incoming connection 
        // to send their SessionCreate message
        clearTimeout(timeout);

        // Must send SessionCreate as first and only message
        NetworkMessageParser.parseAsRaw(data, function (err, message) {
            if (err) {
                debug('failed to parse new session payload', err);
                return connection.deny(err);
            }

            if (!(message instanceof SessionCreateMessage)) {
                debug('first message of new session was not session create');
                return connection.deny(new Errors.ConnectionHandshakeUnrecognized());
            }

            connection.once('session', this._onAcceptNewSession.bind(this));
            connection.once('sessionDenied', this._onDenyNewSession.bind(this));
            connection.emit('message', message, connection);
        }.bind(this));
    }.bind(this));

    timeout = setTimeout(function() {
        debug('timed out establishing new session');
        timedOut = true;
        if (connection.websocket.readyState === ws.OPEN) {
            connection.deny(new Errors.ConnectionSessionEstablishTimeout());
        }
    }.bind(this), this.establishSessionTimeout);
};

WebsocketTransportListener.prototype._onAcceptNewSession = function(connection, session, client, response) {
    this.clientsBySessionToken[session.token] = client;

    // Ensure when the session expires we remove it
    session.once('expire', this._onSessionExpire.bind(this, session));

    var transport = new WebsocketTransport({client: client, connection: connection});
    client.setTransport(transport);
    client.sendAcceptSessionMessage(response);
};

WebsocketTransportListener.prototype._onDenyNewSession = function(connection, session, client, response) {
    var transport = new WebsocketTransport({client: client, connection: connection});
    client.setTransport(transport);
    client.sendDenySessionMessage(response);
};

WebsocketTransportListener.prototype._onResumeSession = function(connection, sessionToken) {
    var client = this.clientsBySessionToken[sessionToken];

    if (!client) {
        // Bad token or session already expired
        return connection.deny(new Errors.ConnectionSessionTokenUnrecognized());
    }

    client.transport.resumeWithConnection(connection);
};

WebsocketTransportListener.prototype._onSessionExpire = function(session) {
    delete this.clientsBySessionToken[session.token];
};
