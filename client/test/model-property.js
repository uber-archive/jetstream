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
var ModelProperty = require('../lib/model-property');
var sinon = require('sinon');
var test = require('tape');
var TestModel = require('./test/model');

var model, childModel;

function setup(suite) {
  return function(name, fn) {
    suite.test(name, function(t) {
      model = new TestModel();
      childModel = new TestModel();
      fn(t);
    });
  };
}

test('ModelProperty', function(suite) {
  var it = setup(suite);

  it('should throw if instantiated without a key', function(t) {
    t.throws(function() { new ModelProperty({ type: Number }); });
    t.end();
  });

  it('should throw if instantiated without a type', function(t) {
    t.throws(function() { new ModelProperty({ key: 'key' }); });
    t.end();
  });

  it('should throw if instantiated with an invalid default value', function(t) {
    t.throws(function() {
      new ModelProperty({
        key: 'key',
        type: Number,
        defaultValue: 'invalid'
      });
    });

    t.end();
  });

  it('should initialize with a key and type', function(t) {
    var key = 'key';
    var type = Number;
    var property = new ModelProperty({
      key: key,
      type: type
    });

    t.equal(property.key, key);
    t.equal(property._type, type);
    t.notOk(property.isCollection);
    t.end();
  });

  it('should initialize with a collection type', function(t) {
    var type = [Number];
    var property = new ModelProperty({
      key: 'key',
      type: type
    });

    t.equal(property._type, type[0]);
    t.ok(property.isCollection);
    t.end();
  });

  it('should initialize with a default value', function(t) {
    var defaultValue = 0;
    var property = new ModelProperty({
      key: 'key',
      type: Number,
      defaultValue: defaultValue
    });

    t.equal(property.defaultValue, defaultValue);
    t.end();
  });
});

test('ModelProperty.isValidType', function(suite) {
  var it = setup(suite);

  it('should return true for valid types', function(t) {
    var validTypes = [Boolean, Date, Number, String, TestModel];
    for (var i = 0; i < validTypes.length; i++) {
      t.ok(ModelProperty.isValidType(validTypes[i]));
    }

    t.end();
  });

  it('should return false for invalid types', function(t) {
    var invalidTypes = [Function, Object, RegExp];
    for (var i = 0; i < invalidTypes.length; i++) {
      t.notOk(ModelProperty.isValidType(invalidTypes[i]));
    }

    t.end();
  });
});

test('ModelProperty.serialize', function(suite) {
  var it = setup(suite);

  it('should serialize a Number ModelCollection value as an array of numbers', function(t) {
    var collection = model.get('numbers');
    var values = [1, 2, 3, 4];
    collection.push.apply(collection, values);

    t.deepEqual(ModelProperty.serialize(collection), values);
    t.end();
  });

  it('should serialize a ModelObject ModelCollection as an array of uuids', function(t) {
    var collection = model.get('models');
    var values = [new TestModel(), new TestModel()];
    collection.push.apply(collection, values);

    t.deepEqual(ModelProperty.serialize(collection), values.map(function(value) { return value.uuid; }));
    t.end();
  });

  it('should serialize a ModelObject value as its uuid', function(t) {
    t.equal(ModelProperty.serialize(model), model.uuid);
    t.end();
  });

  it('should serialize a value as the value', function(t) {
    t.deepEqual(ModelProperty.serialize(0), 0);
    t.deepEqual(ModelProperty.serialize('test'), 'test');
    t.end();
  });
});

test('ModelProperty.unserialize', function(suite) {
  var it = setup(suite);

  it('should unserialize a Number array as an array of numbers', function(t) {
    var values = [1, 2, 3, 4];
    t.deepEqual(ModelProperty.unserialize(values, model.properties.numbers), values);
    t.end();
  });

  it('should unserialize a value as the value', function(t) {
    t.deepEqual(ModelProperty.unserialize(0, model.properties.number), 0);
    t.deepEqual(ModelProperty.unserialize('test', model.properties.number), 'test');
    t.end();
  });
});

test('ModelProperty.prototype.isModelObjectType', function(suite) {
  var it = setup(suite);

  it('should return true when it is a ModelObject type', function(t) {
    t.ok(model.properties.model.isModelObjectType());
    t.ok(model.properties.models.isModelObjectType());
    t.end();
  });

  it('should return false when it is not a ModelObject type', function(t) {
    t.notOk(model.properties.number.isModelObjectType());
    t.notOk(model.properties.string.isModelObjectType());
    t.notOk(model.properties.numbers.isModelObjectType());
    t.end();
  });
});

test('ModelProperty.prototype.validate', function(suite) {
  var it = setup(suite);

  it('should not validate null or undefined values', function(t) {
    var property = model.properties.number;
    var spy = sinon.spy(property, '_validateValue');

    property.validate(null);
    t.notOk(spy.called);

    property.validate(undefined);
    t.notOk(spy.called);

    property.validate(0);
    t.ok(spy.called);

    property.validate(false);
    t.ok(spy.called);

    t.end();
  });

  it('should validate each element of a ModelCollection value', function(t) {
    var property = model.properties.numbers;
    var spy = sinon.spy(property, '_validateValue');
    var numbers = [1, 2, 3, 4];

    property.validate(numbers);

    t.equal(spy.callCount, numbers.length);
    t.end();
  });
});

test('ModelProperty.prototype._validateValue', function(suite) {
  var it = setup(suite);

  it('should throw on invalid values', function(t) {
    t.throws(function() {
      model.properties.number._validateValue(['test']);
    });

    t.throws(function() {
      model.properties.number._validateValue('test');
    });

    t.throws(function() {
      model.properties.date._validateValue(['test']);
    });

    t.throws(function() {
      model.properties.date._validateValue('test');
    });

    t.end();
  });

  it('should not throw and returns valid values', function(t) {
    var number = 0;
    var date = new Date();

    t.doesNotThrow(function() {
      model.properties.number._validateValue(number);
    });

    t.equal(model.properties.number._validateValue(number), number);

    t.doesNotThrow(function() {
      model.properties.date._validateValue(date);
    });

    t.equal(model.properties.date._validateValue(date), date);

    t.end();
  });
});
