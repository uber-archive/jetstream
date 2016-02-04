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

module.exports = ModelEnumeration;

var _ = require('lodash');
var assert = require('assert');
var util = require('util');

var _types = {};

function ModelEnumeration(options) {
  options = options || {};

  var type = options.type;
  var values = options.values;
  var value;

  assert(type === String || type === Number, 'ModelEnumeration type must be String or Number');

  if (type === String) {
    assert(values instanceof Array, 'String ModelEnumeration values must be an array');
    assert(values.length > 0, 'String ModelEnumeration values must not be empty');
    
    for (var i = 0; i < values.length; i++) {
      value = values[i];
      assert(typeof value === 'string', 'String ModelEnumeration values must be strings');

      this[value] = value;
    }
  } else {
    assert(values instanceof Object, 'Number ModelEnumeration values must be an object of strings to integers');
    assert(_.size(values) > 0, 'Number ModelEnumeration values must not be empty');

    for (var key in values) {
      if (values.hasOwnProperty(key)) {
        value = values[key];
        assert(
          typeof key === 'string' && (typeof value === 'number' && value % 1 === 0),
          'Number ModelEnumeration values must be an object of strings to integers'
        );

        this[key] = value;
      }
    }
  }
}

///////////////////////////////////////////////////////////////////////////////
// STATIC

ModelEnumeration.create = function(name, type, values) {
  // Support options as an object as the first parameter
  if (typeof name === 'object') {
    type = name.type;
    values = name.values;
    name = name.name;
  }

  assert(typeof name === 'string', 'Invalid ModelEnumeration name');
  assert(!_types[name], util.format('ModelEnumeration \'%s\' already defined', name));

  var ModelEnumerationType = function() {
    ModelEnumeration.apply(this, arguments);
  };

  util.inherits(ModelEnumerationType, ModelEnumeration);

  var enumeration = new ModelEnumerationType({
    type: type,
    values: values
  });

  ModelEnumerationType.prototype._name = name;
  ModelEnumerationType.prototype._type = type;

  // Set keys and values
  var _keys, _values;
  if (type === String) {
    _keys = values;
    _values = values;
  } else {
    _keys = [];
    _values = [];

    for (var key in values) {
      if (values.hasOwnProperty(key)) {
        _keys.push(key);
        _values.push(values[key]);
      }
    }
  }

  ModelEnumerationType.prototype._keys = _keys;
  ModelEnumerationType.prototype._values = _values;

  // Save enumeration type
  _types[name] = enumeration;

  return enumeration;
};

///////////////////////////////////////////////////////////////////////////////
// METHODS

ModelEnumeration.prototype.getKeys = function() {
  return this._keys;
};

ModelEnumeration.prototype.getValues = function() {
  return this._values;
};

ModelEnumeration.prototype.validate = function(value) {
  return this._values.indexOf(value) !== -1;
};
