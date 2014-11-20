//
// server.js
// Jetstream
// 
// Copyright (c) 2014 Uber Technologies, Inc.
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

module.exports = Server;

var bodyParser = require('body-parser');
var EventEmitter = require('events').EventEmitter;
var express = require('express');
var logger = require('./logger');
var robb = require('robb/src/robb');
var Session = require('./session');
var SessionCreateMessage = require('./message/session_create_message');
var util = require('util');
var WebsocketTransport = require('./transport/websocket_transport');

function Server(options) {
    options = options || {};

    if (options.transports !== undefined && !(options.transports instanceof Array)) {
        throw new Error('Invalid transports specified');
    }

    if (!options.transports) {
        if (robb.isInt(options.port)) {
            options.transports = Server.getDefaultTransports(options.port);
        } else {
            options.transports = Server.getDefaultTransports();
        }
    }

    this.transports = options.transports;
    this.listeners = [];
}

util.inherits(Server, EventEmitter);

Server.getDefaultTransports = function(port) {
    if (!port) {
        var defaultPortKey = '--jetstream-default-port=';
        process.argv.forEach(function(arg) {
            if (arg.length > defaultPortKey.length) {
                var prefix = arg.substring(0, defaultPortKey.length);
                if (prefix === defaultPortKey) {
                    var value = parseInt(arg.substring(defaultPortKey.length));
                    if (!isNaN(value) && value > 0) {
                        port = value;
                    }
                }
            }
        });
    }

    port = port || 3000;
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
        this.listeners.push(listener);

        var log = {transport: transport.transportName};
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
    this.emit('connection', connection);

    // If the connection was accepted listen for messages
    if (connection.accepted) {
        var messageListener;
        messageListener = function(message, connection) {
            this._onMessage(messageListener, message, connection);
        }.bind(this);

        connection.on('message', messageListener);
    }
};

Server.prototype._onMessage = function(messageListener, message, connection) {
    if (message instanceof SessionCreateMessage) {
        var session = new Session({params: message.params});

        session.once('accept', function(session, client) {
            connection.startSession(session, client);
        });

        session.once('deny', function(session, client) {
            connection.denySession(session, client);
        });

        this.emit('session', session, connection, session.params, function(err, clientType) {
            if (err) {
                return session.deny(clientType);
            }
            session.accept(clientType);
        });

        // Can unsubscribe from this connection's messages
        connection.removeListener('message', messageListener);
    }
};
