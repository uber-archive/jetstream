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

var Constants = require('../lib/constants');
var ModelCollection = require('../lib/model-collection');
var ModelObject = require('../lib/model-object');
var ModelProperty = require('../lib/model-property');
var sinon = require('sinon');
var test = require('tape');
var TestModel = require('./test/model');

var model, collection;
var values = [1, 2, 3, 4];

function setup(suite) {
  return function(name, fn) {
    suite.test(name, function(t) {
      model = new TestModel();

      collection = model.get('numbers');
      collection._values = values.slice(0);

      fn(t);
    });
  };
}

test('ModelCollection', function(suite) {
  var it = setup(suite);

  it('should throw if instantiated without an owner', function(t) {
    t.throws(function() { new ModelCollection({ property: model.properties.number }); });
    t.end();
  });

  it('should throw if instantiated without a property', function(t) {
    t.throws(function() { new ModelCollection({ owner: model }); });
    t.end();
  });

  it('should throw if instantiated with a property that is not a collection', function(t) {
    t.throws(function() { new ModelCollection({ owner: model, property: model.properties.number }); });
    t.end();
  });

  it('should initialize with an empty values array', function(t) {
    var collection = new ModelCollection({ owner: model, property: model.properties.numbers });
    t.ok(collection._values instanceof Array);
    t.equal(collection.length, 0);
    t.end();
  });
});

test('ModelCollection.prototype.at', function(suite) {
  var it = setup(suite);

  it('should return the value at the given index', function(t) {
    t.equal(collection.at(0), 1);
    t.end();
  });
});

test('ModelCollection.prototype.filter', function(suite) {
  var it = setup(suite);

  it('should return filtered values', function(t) {
    function _filter(value) {
      return value % 2 === 0;
    }

    t.deepEqual(collection.filter(_filter), values.filter(_filter));
    t.end();
  });
});

test('ModelCollection.prototype.forEach', function(suite) {
  var it = setup(suite);

  it('should execute a callback for each value', function(t) {
    var spy = sinon.spy();
    collection.forEach(spy);

    for (var i = 0; i < values.length; i++) {
      t.ok(spy.withArgs(values[i]).calledOnce);
    }

    t.equal(spy.callCount, values.length);
    t.end();
  });
});

test('ModelCollection.prototype.indexOf', function(suite) {
  var it = setup(suite);

  it('should return the index of the given value', function(t) {
    t.equal(collection.indexOf(0), values.indexOf(0));
    t.equal(collection.indexOf(2), values.indexOf(2));
    t.end();
  });
});

test('ModelCollection.prototype.map', function(suite) {
  var it = setup(suite);

  it('should execute a callback on each value', function(t) {
    function _map(value) {
      return value * 2;
    }

    t.deepEqual(collection.map(_map), values.map(_map));
    t.end();
  });
});

test('ModelCollection.prototype.pop', function(suite) {
  var it = setup(suite);

  it('should remove the last value', function(t) {
    var removed = collection.pop();
    t.equal(removed, values[values.length - 1]);
    t.equal(collection.length, values.length - 1);
    t.end();
  });

  it('should call _onRemove with the removed value', function(t) {
    var spy = sinon.spy(collection, '_onRemove');
    var removed = collection.pop();

    t.ok(spy.withArgs(removed).calledOnce);
    t.end();
  });
});

test('ModelCollection.prototype.push', function(suite) {
  var it = setup(suite);

  it('should throw on invalid values', function(t) {
    t.throws(function() { collection.push('invalid'); });
    t.end();
  });

  it('should add values to the end of the values array', function(t) {
    collection.push(5, 6);

    t.equal(collection.length, values.length + 2);
    t.equal(collection.at(values.length), 5);
    t.equal(collection.at(values.length + 1), 6);
    t.end();
  });

  it('should call _onAdd with the added values', function(t) {
    var spy = sinon.spy(collection, '_onAdd');
    var value = 7;
    collection.push(value);

    t.ok(spy.withArgs(value).calledOnce);
    t.end();
  });
});

test('ModelCollection.prototype.reset', function(suite) {
  var it = setup(suite);

  it('should throw on invalid values', function(t) {
    t.throws(function() { collection.reset('invalid'); });
    t.throws(function() { collection.reset(['invalid']); });
    t.end();
  });

  it('should replace and return its values array', function(t) {
    var expected = [5, 6];
    var actual = collection.reset(expected);

    t.deepEqual(collection._values, expected);
    t.deepEqual(actual, expected);
    t.end();
  });

  it('should call _onAdd and _onRemove for the replaced values', function(t) {
    var addSpy = sinon.spy(collection, '_onAdd');
    var removeSpy = sinon.spy(collection, '_onRemove');
    collection.reset([2, 4, 6, 8, 10, 12]);

    t.equal(addSpy.callCount, 4);
    t.equal(removeSpy.callCount, 2);
    t.end();
  });
});

test('ModelCollection.prototype.shift', function(suite) {
  var it = setup(suite);

  it('should remove the first value', function(t) {
    var removed = collection.shift();
    
    t.equal(removed, values[0]);
    t.equal(collection.length, values.length - 1);
    t.end();
  });

  it('should call _onRemove with the removed value', function(t) {
    var spy = sinon.spy(collection, '_onRemove');
    var removed = collection.shift();

    t.ok(spy.withArgs(removed).calledOnce);
    t.end();
  });
});

test('ModelCollection.prototype.slice', function(suite) {
  var it = setup(suite);

  it('should return a copy of a portion of the values array', function(t) {
    t.deepEqual(collection.slice(0), values.slice(0));
    t.deepEqual(collection.slice(2), values.slice(2));
    t.end();
  });
});

test('ModelCollection.prototype.splice', function(suite) {
  var it = setup(suite);

  it('should remove values from the values array', function(t) {
    collection.splice(0, 1);
    t.equal(collection.length, values.length - 1);
    
    collection.splice(0, 100);
    t.equal(collection.length, 0);
    
    t.end();
  });

  it('should call _onRemove for the removed values', function(t) {
    var spy = sinon.spy(collection, '_onRemove');

    var removed = collection.splice(0, 2);
    t.ok(spy.callCount, removed.length);
    t.end();
  });

  it('should throw on invalid values', function(t) {
    t.throws(function() { collection.splice(0, 0, 'invalid'); });
    t.end();
  });

  it('should replace values from the values array', function(t) {
    var length = collection.length;
    var value = 0;

    collection.splice(0, 1, value);
    t.equal(collection.at(0), value);
    t.equal(collection.length, length);
    t.end();
  });

  it('should call _onAdd for the added values', function(t) {
    var spy = sinon.spy(collection, '_onAdd');
    var value = 0;

    collection.splice(0, 1, value);
    t.ok(spy.withArgs(value).calledOnce);
    t.end();
  });
});

test('ModelCollection.prototype.unshift', function(suite) {
  var it = setup(suite);

  it('should throw on invalid values', function(t) {
    t.throws(function() { collection.unshift('invalid'); });
    t.end();
  });

  it('should add values to the start of the values array', function(t) {
    collection.unshift(5, 6);

    t.equal(collection.length, values.length + 2);
    t.equal(collection._values[0], 5);
    t.equal(collection._values[1], 6);
    t.end();
  });

  it('should call _onAdd with the added values', function(t) {
    var spy = sinon.spy(collection, '_onAdd');
    var value = 7;
    collection.unshift(value);

    t.ok(spy.withArgs(value).calledOnce);
    t.end();
  });
});
