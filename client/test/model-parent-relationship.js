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

var ModelObject = require('../lib/model-object');
var ModelParentRelationship = require('../lib/model-parent-relationship');
var sinon = require('sinon');
var test = require('tape');
var TestModel = require('./test/model');

var model;

function setup(suite) {
  return function(name, fn) {
    suite.test(name, function(t) {
      model = new TestModel();
      fn(t);
    });
  };
}

test('ModelParentRelationship', function(suite) {
  var it = setup(suite);

  it('should throw if instantiated without a key', function(t) {
    t.throws(function() { new ModelParentRelationship({ parent: model }); });
    t.end();
  });

  it('should throw if instantiated without a parent', function(t) {
    t.throws(function() { new ModelParentRelationship({ key: 'key' }); });
    t.end();
  });

  it('should initialize with a key and parent', function(t) {
    var parentRelationship = new ModelParentRelationship({ key: 'key', parent: model });
    t.equal(parentRelationship.key, 'key');
    t.equal(parentRelationship.parent, model);
    t.end();
  });
});
