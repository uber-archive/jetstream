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

var assert = require('assert');
var BaseMessage = require('./base-message');
var SyncFragment = require('../sync-fragment');
var util = require('util');

function ScopeSyncMessage(options) {
  options = options || {};

  BaseMessage.call(this, options);

  assert(typeof options.scopeIndex === 'number', 'Invalid ScopeSyncMessage scopeIndex');
  assert(options.syncFragments instanceof Array, 'Invalid ScopeSyncMessage syncFragments');

  this.atomic = !!options.atomic;
  this.scopeIndex = options.scopeIndex;
  this.syncFragments = options.syncFragments;
}

util.inherits(ScopeSyncMessage, BaseMessage);

ScopeSyncMessage.type = 'ScopeSync';

///////////////////////////////////////////////////////////////////////////////
// METHODS

ScopeSyncMessage.prototype.toJSON = function() {
  var json = BaseMessage.prototype.toJSON.call(this, ['atomic', 'scopeIndex']);

  json.fragments = this.syncFragments.map(function(fragment) {
    return fragment.toJSON();
  });

  return json;
};

ScopeSyncMessage.parse = function(data) {
  assert(data.fragments instanceof Array, 'Invalid ScopeSyncMessage syncFragments');

  data.syncFragments = data.fragments.map(function(fragment) {
    return new SyncFragment(fragment);
  });

  return new ScopeSyncMessage(data);
};
