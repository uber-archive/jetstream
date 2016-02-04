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

module.exports = ScopeStateMessage;

var assert = require('assert');
var BaseMessage = require('./base-message');
var SyncFragment = require('../sync-fragment');
var util = require('util');

function ScopeStateMessage(options) {
  options = options || {};

  BaseMessage.call(this, options);

  assert(typeof options.scopeIndex === 'number', 'Invalid ScopeStateMessage scopeIndex');
  assert(typeof options.rootUUID === 'string', 'Invalid ScopeStateMessage rootUUID');
  assert(options.syncFragments instanceof Array, 'Invalid ScopeStateMessage syncFragments');

  this.rootUUID = options.rootUUID;
  this.scopeIndex = options.scopeIndex;
  this.syncFragments = options.syncFragments;
}

util.inherits(ScopeStateMessage, BaseMessage);

ScopeStateMessage.type = 'ScopeState';

///////////////////////////////////////////////////////////////////////////////
// METHODS

ScopeStateMessage.prototype.toJSON = function() {
  var json = BaseMessage.prototype.toJSON.call(this, ['rootUUID', 'scopeIndex']);

  json.fragments = this.syncFragments.map(function(fragment) {
    return fragment.toJSON();
  });

  return json;
};

ScopeStateMessage.parse = function(data) {
  assert(typeof data.rootUUID === 'string', 'Invalid ScopeStateMessage rootUUID');
  assert(data.fragments instanceof Array, 'Invalid ScopeStateMessage syncFragments');

  data.syncFragments = data.fragments.map(function(fragment) {
    return new SyncFragment(fragment);
  });

  return new ScopeStateMessage(data);
};
