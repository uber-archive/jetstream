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

module.exports = AbstractConnection;

var EventEmitter = require('events').EventEmitter;
var util = require('util');

function AbstractConnection(options) {
    options = options || {};

    this.params = options.params || {};
    this.accepted = true;
    this.session = null;
}

util.inherits(AbstractConnection, EventEmitter);

AbstractConnection.prototype.accept = function() {
    this.emit('accept');
};

AbstractConnection.prototype.deny = function(error) {
    this.accepted = false;
    if (typeof error === 'string') {
        error = new Error(error);
    }
    this.emit('deny', error);
    return error;
};

AbstractConnection.prototype.startSession = function(session, client) {
    this.session = session;
    this.emit('session', this, session, client);
};

AbstractConnection.prototype.denySession = function(session, client) {
    this.emit('sessionDenied', this, session, client);
};
