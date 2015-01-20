//
// server.js
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

module.exports = Server;

var bodyParser = require('body-parser');
var EventEmitter = require('events').EventEmitter;
var express = require('express');
var logger = require('./logger');
var once = require('once');
var robb = require('robb/src/robb');
var Session = require('./session');
var util = require('util');
var WebsocketTransport = require('./transport/websocket_transport');

var CONST = {};
CONST.DEFAULT_TRANSPORTS_PORT = 3000;
CONST = Object.freeze(CONST);

function Server(options) {
    options = options || {};

    if (options.transports !== undefined && !Array.isArray(options.transports)) {
        throw new Error('Invalid transports specified');
    }

    if (!options.transports) {
        if (robb.isUnsignedInt(options.port)) {
            options.transports = Server.getDefaultTransports(options.port);
        } else {
            options.transports = Server.getDefaultTransports();
        }
    }

    this.transports = options.transports;
    this.transportListeners = [];
}

util.inherits(Server, EventEmitter);

Server.CONST = CONST;

Server.getDefaultTransports = function(port) {
    port = port || CONST.DEFAULT_TRANSPORTS_PORT;
    var app = express();
    app.use(bodyParser.json());
    app.server = app.listen(port);
    return [
        WebsocketTransport.configure({server: app.server})
    ];
};

Server.prototype.start = function() {
    logger.info('Starting server');

    this.transports.forEach(function(transport) {
        var listener = transport.listen();
        listener.on('connection', this._onConnection.bind(this));
        this.transportListeners.push(listener);

        var log = {
            transportListener: Object.getPrototypeOf(listener).constructor.name
        };
        try {
            log.address = listener.app.server.address();
        } catch (err) { }
        try {
            log.address = listener.server.options.server.address();
        } catch (err) { }
        logger.info('Listening with transport', log);
    }.bind(this));
};

Server.prototype._onConnection = function(connection) {
    var onAcceptOrDenyOnce = once(onAcceptOrDeny);
    connection.once('accept', onAcceptOrDenyOnce.bind(null, 'accept'));
    connection.once('deny', onAcceptOrDenyOnce.bind(null, 'deny'));

    if (this.listeners('connection').length > 0) {
        this.emit('connection', function(err) {
            if (err) {
                return connection.deny(err);
            }
            connection.accept();
        });
    } else {
        connection.accept();
    }

    var self = this;
    function onAcceptOrDeny(type, onSessionCreateMessage) {
        if (type === 'accept') {
            connection.once('sessionCreateMessage', function(message) {
                self._onSessionCreateMessage(message, connection);
            });
            // First message for a new connection should always be a `SessionCreateMessage`,
            // reading a message will trigger the 'sessionCreateMessage' event if valid connection
            connection.read();
        }
    }
};

Server.prototype._onSessionCreateMessage = function(message, connection) {
    var session = new Session({params: message.params});

    var onAcceptOrDenyOnce = once(onAcceptOrDeny);
    session.once('accept', onAcceptOrDenyOnce.bind(null, 'accept'));
    session.once('deny', onAcceptOrDenyOnce.bind(null, 'deny'));

    if (this.listeners('session').length > 0) {
        this.emit('session', session, connection, session.params, function(err, clientType) {
            if (err) {
                return session.deny(clientType);
            }
            session.accept(clientType);
        });
    } else {
        session.accept();
    }

    function onAcceptOrDeny(type, session, client) {
        if (type === 'accept') {
            connection.startSession(session, client);
        } else {
            connection.denySession(session, client);
        }
    }
};
