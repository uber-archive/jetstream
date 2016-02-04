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

module.exports = ModelCollection;

var _ = require('lodash');
var assert = require('assert');
var ModelObject = require('./model-object');
var ModelProperty = require('./model-property');

function ModelCollection(options) {
  options = options || {};

  assert(options.owner instanceof ModelObject, 'Invalid ModelCollection owner');
  assert(options.property instanceof ModelProperty, 'Invalid ModelCollection property');
  assert(options.property.isCollection, 'Invalid ModelCollection property is not a collection');

  this._owner = options.owner;
  this._property = options.property;
  this._values = [];
}

///////////////////////////////////////////////////////////////////////////////
// PROPERTIES

Object.defineProperty(ModelCollection.prototype, 'length', {
  get: function() {
    return this._values.length;
  }
});

///////////////////////////////////////////////////////////////////////////////
// METHODS

ModelCollection.prototype.at = function(index) {
  return this._values[index];
};

ModelCollection.prototype.filter = function() {
  return this._values.filter.apply(this._values, arguments);
};

ModelCollection.prototype.forEach = function() {
  return this._values.forEach.apply(this._values, arguments);
};

ModelCollection.prototype.indexOf = function() {
  return this._values.indexOf.apply(this._values, arguments);
};

ModelCollection.prototype.map = function() {
  return this._values.map.apply(this._values, arguments);
};

ModelCollection.prototype.pop = function() {
  return this._onRemove(this._values.pop());
};

ModelCollection.prototype.push = function() {
  var values = Array.prototype.slice.call(arguments);
  this._property.validate(values);

  this._values.push.apply(this._values, values);
  for (var i = 0; i < values.length; i++) {
    this._onAdd(values[i]);
  }

  return values;
};

ModelCollection.prototype.reset = function(values) {
  var previousValues = this._values;
  var i;

  this._property.validate(values);
  this._values = values;

  var added = _.difference(this._values, previousValues);
  var removed = _.difference(previousValues, this._values);

  for (i = 0; i < added.length; i++) {
    this._onAdd(added[i]);
  }

  for (i = 0; i < removed.length; i++) {
    this._onRemove(removed[i]);
  }

  return this._values;
};

ModelCollection.prototype.shift = function() {
  return this._onRemove(this._values.shift());
};

ModelCollection.prototype.slice = function() {
  return this._values.slice.apply(this._values, arguments);
};

ModelCollection.prototype.splice = function() {
  var added = Array.prototype.slice.call(arguments, 2);
  var i;

  this._property.validate(added);
  var removed = this._values.splice.apply(this._values, arguments);

  for (i = 0; i < added.length; i++) {
    this._onAdd(added[i]);
  }

  for (i = 0; i < removed.length; i++) {
    this._onRemove(removed[i]);
  }

  return removed;
};

ModelCollection.prototype.unshift = function() {
  var values = Array.prototype.slice.call(arguments);
  this._property.validate(values);

  this._values.unshift.apply(this._values, values);
  for (var i = 0; i < values.length; i++) {
    this._onAdd(values[i]);
  }

  return values;
};

ModelCollection.prototype._onAdd = function(value) {
  this._owner.onCollectionAdd(this._property.key, value);
  return value;
};

ModelCollection.prototype._onRemove = function(value) {
  this._owner.onCollectionRemove(this._property.key, value);
  return value;
};
