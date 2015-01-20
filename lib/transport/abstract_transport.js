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

var Duplex = require('stream').Duplex;
var util = require('util');

function AbstractTransport(options) {
    options = options || {};
    Duplex.call(this, {objectMode: true});
}

util.inherits(AbstractTransport, Duplex);

/**
 * Allows pre-configuration of a transport when passing the type.
 *
 * @param options {Object} The options to bind when called to listen
 * @api public
 */ 
AbstractTransport.configure = function(options) {
    var currentListen = this.listen;
    this.listen = currentListen.bind(this, options);
    return this;
};

/**
 * Return a listener to accept connections and act as a factory for
 * creating transports of this type.
 *
 * @param options {Object} The options for the listener
 * @api public 
 */
AbstractTransport.listen = function(options) {
    throw new Error('Not implemented');
};
