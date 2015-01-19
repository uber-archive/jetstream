//
// abstract_transport.js
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

module.exports = AbstractTransport;

var _ = require('lodash');
var AbstractNetworkMessage = require('../message/abstract_network_message');
var callbackOrEmitError = require('callback-or-emit-error');
var Client = require('../client');
var EventEmitter = require('events').EventEmitter;
var logger = require('../logger');
var NetworkMessageParser = require('../message/network_message_parser');
var util = require('util');

var debug = logger.debug.bind(logger, 'transport:abstractTransport');

function AbstractTransport(options) {
    options = options || {};

    if (!(options.client instanceof Client)) {
        throw new Error('Invalid client specified');
    }

    this._pendingData = [];
}

util.inherits(AbstractTransport, EventEmitter);

/**
 * Allows pre-configuration of a transport when passing the type
 *
 * @param options {Object}
 * @api public
 */ 
AbstractTransport.configure = function(options) {
    var currentListen = this.listen;
    this.listen = currentListen.bind(this, options);
    return this;
};

AbstractTransport.prototype.sendMessage = function(message, callback) {
    if (!(message instanceof AbstractNetworkMessage)) {
        return callbackOrEmitError(this, callback, new Error('Invalid message'));
    }
    this.transportMessage(message, callback);
};

AbstractTransport.prototype.transportMessage = function() {
    throw new Error('Not implemented');
};

AbstractTransport.prototype.close = function(callback) {
    throw new Error('Not implemented');
};

AbstractTransport.prototype._onData = function(data) {
    if (!data) {
        return;
    }

    // Protect against parseAsRaw returning out of order
    var entry = {data: data, result: null};
    this._pendingData.push(entry);

    NetworkMessageParser.parseAsRaw(data, function(err, result) {
        if (err) {
            debug('failed to parse incoming data', err, data);
            this._pendingData = _.without(this._pendingData, entry);
        } else {
            entry.result = Array.isArray(result) ? result : [result];
        }

        while (this._pendingData.length && this._pendingData[0].result) {
            var completedResult = this._pendingData.shift().result;
            for (var i = 0; i < completedResult.length; i++) {
                this._messageReceived(completedResult[i]);
            }
        }
    }.bind(this));
};

/**
 * This is the spout for messages appearing on the transport.  To do 
 * any preprocessing before emitting override this method and emit the 
 * messages yourself.
 *
 * @param message {AbstractNetworkMessage}
 */
AbstractTransport.prototype._messageReceived = function(message) {
    this.emit('message', message);
};
