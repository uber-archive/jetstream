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

var ModelEnumeration = require('../lib/model-enumeration');
var sinon = require('sinon');
var test = require('tape');
var TestEnumeration = require('./test/enumeration');

function setup(suite) {
  return function(name, fn) {
    suite.test(name, function(t) {
      fn(t);
    });
  };
}

test('ModelEnumeration', function(suite) {
  var it = setup(suite);

  it('should throw if instantiated without a valid type', function(t) {
    t.throws(function() { new ModelEnumeration({ values: ['a'] }); });
    t.throws(function() { new ModelEnumeration({ type: Boolean, values: ['a'] }); });
    t.throws(function() { new ModelEnumeration({ type: Date, values: ['a'] }); });

    t.end();
  });

  it('should throw if instantiated without valid type values', function(t) {
    t.throws(function() { new ModelEnumeration({ type: String, values: 'a' }); });
    t.throws(function() { new ModelEnumeration({ type: String, values: { a: 1 } }); });
    t.throws(function() { new ModelEnumeration({ type: String, values: [] }); });
    t.throws(function() { new ModelEnumeration({ type: String, values: ['a', 1] }); });
    t.doesNotThrow(function() { new ModelEnumeration({ type: String, values: ['a'] }); });

    t.throws(function() { new ModelEnumeration({ type: Number, values: 1 }); });
    t.throws(function() { new ModelEnumeration({ type: Number, values: ['a'] }); });
    t.throws(function() { new ModelEnumeration({ type: Number, values: {} }); });
    t.throws(function() { new ModelEnumeration({ type: Number, values: { a: 'a' } }); });
    t.throws(function() { new ModelEnumeration({ type: Number, values: { a: 1, b: 'b' } }); });
    t.doesNotThrow(function() { new ModelEnumeration({ type: Number, values: { a: 1 } }); });

    t.end();
  });

  it('should initialize with values', function(t) {
    var enumOne = new ModelEnumeration({ type: String, values: ['a', 'b', 'c'] });
    t.equal(enumOne.a, 'a');
    t.equal(enumOne.b, 'b');
    t.equal(enumOne.c, 'c');

    var enumTwo = new ModelEnumeration({ type: Number, values: { a: 1, b: 2, c: 3 } });
    t.equal(enumTwo.a, 1);
    t.equal(enumTwo.b, 2);
    t.equal(enumTwo.c, 3);

    t.end();
  });
});

test('ModelEnumeration.create', function(suite) {
  var it = setup(suite);

  it('should throw if instantiated without a name', function(t) {
    t.throws(function() { ModelEnumeration.create({ type: String, values: ['a'] }); });
    t.end();
  });

  it('should throw if a ModelEnumeration already exists with the same name', function(t) {
    t.throws(function() {
      ModelEnumeration.create('TestDuplicateEnumeration', String, ['a']);
      ModelEnumeration.create('TestDuplicateEnumeration', String, ['a']);
    });

    t.end();
  });

  it('should support object and parameter instantiation', function(t) {
    var TestObjectEnumeration = ModelEnumeration.create({ name: 'TestObjectEnumeration', type: String, values: ['a'] });
    var TestParameterEnumeration = ModelEnumeration.create('TestParameterEnumeration', String, ['a']);

    t.equal(TestObjectEnumeration._name, 'TestObjectEnumeration');
    t.equal(TestParameterEnumeration._name, 'TestParameterEnumeration');
    t.end();
  });

  it('should return a ModelEnumeration instance', function(t) {
    var TestEnumerationInstance = ModelEnumeration.create('TestEnumerationInstance', String, ['a']);
    t.ok(TestEnumerationInstance instanceof ModelEnumeration);
    t.equal(TestEnumerationInstance._type, String);
    t.end();
  });
});

test('ModelEnumeration.getKeys', function(suite) {
  var it = setup(suite);

  it('should return enumeration keys', function(t) {
    t.deepEqual(TestEnumeration.getKeys(), ['a', 'b', 'c']);
    t.end();
  });
});

test('ModelEnumeration.getValues', function(suite) {
  var it = setup(suite);

  it('should return enumeration values', function(t) {
    t.deepEqual(TestEnumeration.getValues(), [1, 2, 3]);
    t.end();
  });
});

test('ModelEnumeration.validate', function(suite) {
  var it = setup(suite);
  var StringEnumeration = ModelEnumeration.create('TestStringEnumeration', String, ['a', 'b', 'c']);

  it('should return false for invalid String enumeration values', function(t) {
    t.equal(StringEnumeration.validate(1), false);
    t.equal(StringEnumeration.validate('d'), false);
    t.equal(StringEnumeration.validate(new Date()), false);
    t.end();
  });

  it('should return true for valid String enumeration values', function(t) {
    t.equal(StringEnumeration.validate('a'), true);
    t.equal(StringEnumeration.validate('b'), true);
    t.equal(StringEnumeration.validate('c'), true);
    t.end();
  });

  it('should return false for invalid Number enumeration values', function(t) {
    t.equal(TestEnumeration.validate(4), false);
    t.equal(TestEnumeration.validate('a'), false);
    t.equal(TestEnumeration.validate(new Date()), false);
    t.end();
  });

  it('should return true for valid Number enumeration values', function(t) {
    t.equal(TestEnumeration.validate(1), true);
    t.equal(TestEnumeration.validate(2), true);
    t.equal(TestEnumeration.validate(3), true);
    t.end();
  });
});
