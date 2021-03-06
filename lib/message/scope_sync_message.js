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

module.exports = ScopeSyncMessage;

var _ = require('lodash');
var AbstractNetworkMessage = require('./abstract_network_message');
var robb = require('robb/src/robb');
var SyncFragment = require('../sync_fragment');
var util = require('util');

function ScopeSyncMessage(options) {
    options = options || {};
    AbstractNetworkMessage.call(this, options);

    if (!robb.isUnsignedInt(options.scopeIndex)) {
        throw new Error('Invalid scopeIndex');
    }

    if (!Array.isArray(options.syncFragments)) {
        throw new Error('Invalid syncFragments');
    }

    var hasAtomic = options.hasOwnProperty('atomic');
    if (hasAtomic && typeof options.atomic !== 'boolean') {
        throw new Error('Invalid atomic');
    } else if (!hasAtomic) {
        options.atomic = null;
    }

    var hasProcedure = options.hasOwnProperty('procedure');
    if (hasProcedure && typeof options.procedure !== 'string') {
        throw new Error('Invalid procedure');
    } else if (hasProcedure && !hasAtomic) {
        throw new Error('Procedure requires to be atomic');
    } else if (hasProcedure && hasAtomic && options.procedure.split('.').length !== 2) {
        throw new Error('Procedure must be of the format "ModelName.procedureName"');
    } else if (!hasProcedure) {
        options.procedure = null;
    }

    this.scopeIndex = options.scopeIndex;
    this.syncFragments = options.syncFragments;
    this.atomic = options.atomic;
    this.procedure = options.procedure;
}

util.inherits(ScopeSyncMessage, AbstractNetworkMessage);

ScopeSyncMessage.type = 'ScopeSync';

ScopeSyncMessage.parseAsJSON = function(json, callback) {
    if (!json || json.type !== this.type) {
        return callback(new Error('Message type was not \'' + this.type + '\''));
    }

    var syncFragments = [];
    try {
        if (!Array.isArray(json.fragments)) {
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
        message = new ScopeSyncMessage(_.extend(json, {
            syncFragments: syncFragments
        }));
    } catch (err) {
        return callback(err);
    }
    
    callback(null, message);
};

ScopeSyncMessage.prototype.toJSON = function() {
    var json = AbstractNetworkMessage.prototype.toJSON.call(this);
    json.scopeIndex = this.scopeIndex;
    json.fragments = this.syncFragments;
    if (this.atomic !== null) {
        json.atomic = this.atomic;
    }
    if (this.procedure !== null) {
        json.procedure = this.procedure;
    }
    return json;
};
