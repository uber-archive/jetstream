//
// scope_state_message.js
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

module.exports = ScopeStateMessage;

var _ = require('lodash');
var AbstractNetworkMessage = require('./abstract_network_message');
var SyncFragment = require('../sync_fragment');
var util = require('util');
var robb = require('robb/src/robb');

function ScopeStateMessage(options) {
    options = options || {};
    AbstractNetworkMessage.call(this, options);

    if (!robb.isUnsignedInt(options.scopeIndex)) {
        throw new Error('Invalid scopeIndex');
    }

    if (typeof options.rootUUID !== 'string') {
        throw new Error('Invalid rootUUID');
    }

    if (!(options.syncFragments instanceof Array)) {
        throw new Error('Invalid syncFragments');
    }

    this.scopeIndex = options.scopeIndex;
    this.rootUUID = options.rootUUID;
    this.syncFragments = options.syncFragments;
}

util.inherits(ScopeStateMessage, AbstractNetworkMessage);

ScopeStateMessage.type = 'ScopeState';

ScopeStateMessage.parseAsJSON = function(json, callback) {
    if (!json || json.type !== this.type) {
        return callback(new Error('Message type was not \'' + this.type + '\''));
    }

    var syncFragments = [];
    try {
        if (!(json.fragments instanceof Array)) {
            throw new Error('SyncFragments not on `fragments`');
        }
        _.each(json.fragments, function(fragment) {
            syncFragments.push(new SyncFragment(fragment));
        });
    } catch (err) {
        return callback(err);
    }

    var message;
    try {
        message = new ScopeStateMessage(_.extend(json, {
            syncFragments: syncFragments
        }));
    } catch (err) {
        return callback(err);
    }
    
    callback(null, message);
};

ScopeStateMessage.prototype.toJSON = function() {
    var json = AbstractNetworkMessage.prototype.toJSON.call(this);
    json.scopeIndex = this.scopeIndex;
    json.rootUUID = this.rootUUID;
    json.fragments = this.syncFragments;
    return json;
};
