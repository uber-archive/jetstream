//
// network_message_json_decoder.js
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

module.exports = NetworkMessageJSONDecoder;

var _ = require('lodash');
var logger = require('../logger');
var NetworkMessageParser = require('../message/network_message_parser');
var Transform = require('stream').Transform;
var util = require('util');

var debug = logger.debug.bind(logger, 'transport:networkMessageJSONDecoder');

function NetworkMessageJSONDecoder() {
    Transform.call(this, {objectMode: true});
    this._pendingRawJSONData = [];
}

util.inherits(NetworkMessageJSONDecoder, Transform);

NetworkMessageJSONDecoder.prototype._transform = function(chunk, encoding, callback) {
    // Protect against parseAsRawJSON returning out of order
    var entry = new DecodeEntry(chunk, null, callback);
    this._pendingRawJSONData.push(entry);

    NetworkMessageParser.parseAsRawJSON(chunk, function(err, result) {
        if (err) {
            debug('failed to parse incoming data', err, chunk);
            this._pendingRawJSONData = _.without(this._pendingRawJSONData, entry);
            this.emit('error', err);
            callback(err);
        } else {
            entry.result = Array.isArray(result) ? result : [result];
        }

        while (this._pendingRawJSONData.length && this._pendingRawJSONData[0].result !== null) {
            var completedEntry = this._pendingRawJSONData.shift();
            var completedResult = completedEntry.result;
            for (var i = 0; i < completedResult.length; i++) {
                this.push(completedResult[i]);
            }
            completedEntry.callback();
        }
    }.bind(this));
};

function DecodeEntry(data, result, callback) {
    this.data = data;
    this.result = result;
    this.callback = callback;
}
