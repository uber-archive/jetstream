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

module.exports = LateBoundSyncFragment;

var SyncFragment = require('../sync_fragment');
var util = require('util');

var CONST = {};
CONST.LATE_BOUND_UUID = 'late-bound-uuid';
CONST = Object.freeze(CONST);

function LateBoundSyncFragment(options) {
    options = options || {};
    if (!options.uuid) {
        options.uuid = CONST.LATE_BOUND_UUID;
        if (typeof options.keyPath !== 'string') {
            throw new Error('Requires keyPath from a ModelObject to bind later');
        }
    }

    SyncFragment.call(this, options);

    this.objectUUIDIsLateBound = options.uuid === CONST.LATE_BOUND_UUID;
    if (typeof options.keyPath === 'string') {
        this.keyPath = options.keyPath;
    } else {
        this.keyPath = null;
    }
    if (typeof options.propertyFilters === 'object') {
        this.propertyFilters = options.propertyFilters;
    } else {
        this.propertyFilters = null;
    }
}

util.inherits(LateBoundSyncFragment, SyncFragment);

LateBoundSyncFragment.CONST = CONST;

LateBoundSyncFragment.prototype.bindObjectUUID = function(uuid) {
    if (typeof uuid !== 'string') {
        throw new Error('Invalid UUID');
    }
    this.objectUUID = uuid;
    this.objectUUIDIsLateBound = uuid === CONST.LATE_BOUND_UUID;
};

LateBoundSyncFragment.prototype.bindClsName = function(clsName) {
    this.clsName = clsName;
};
