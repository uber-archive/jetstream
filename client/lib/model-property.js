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

module.exports = ModelProperty;

var assert = require('assert');
var Constants = require('./constants');
var ModelCollection = require('./model-collection');
var ModelEnumeration = require('./model-enumeration');
var ModelObject = require('./model-object');
var util = require('util');

function ModelProperty(options) {
  options = options || {};

  assert(typeof options.key === 'string', 'Invalid ModelProperty key');
  assert(typeof options.type !== 'undefined', 'Invalid ModelProperty type');

  this.key = options.key;
  this._setType(options.type);

  // Set the default value
  this.defaultValue = null;
  if (typeof options.defaultValue !== 'undefined') {
    this.defaultValue = this.validate(options.defaultValue);
  }
}

///////////////////////////////////////////////////////////////////////////////
// STATIC

ModelProperty.isValidType = function(type) {
  return type === Boolean ||
    type === Date ||
    type === Number ||
    type === String ||
    type instanceof ModelEnumeration ||
    type.super_ === ModelObject;
};

ModelProperty.serialize = function(value) {
  var serialized = null;

  if (value instanceof ModelCollection) {
    serialized = value.map(this.serialize);
  } else if (value instanceof ModelObject) {
    serialized = value.uuid;
  } else if (typeof value !== 'undefined') {
    serialized = value;
  }

  return serialized;
};

ModelProperty.unserialize = function(value, property, scope) {
  var unserialized = null;

  if (value instanceof Array) {
    unserialized = value.map(function(v) {
      return this.unserialize(v, property, scope);
    }, this);
  } else if (typeof value !== 'undefined') {
    if (property.isModelObjectType()) {
      unserialized = scope.getModelByUUID(value);
    } else {
      unserialized = value;
    }
  }

  return unserialized;
};

///////////////////////////////////////////////////////////////////////////////
// METHODS

ModelProperty.prototype.isModelEnumerationType = function() {
  return this._type instanceof ModelEnumeration;
};

ModelProperty.prototype.isModelObjectType = function() {
  return this._type.super_ === ModelObject;
};

ModelProperty.prototype.validate = function(value) {
  if (value !== null && value !== undefined) {
    if (this.isCollection) {
      assert(value instanceof Array, 'Invalid ModelProperty collection value \'%s\'', value);

      for (var i = 0; i < value.length; i++) {
        this._validateValue(value[i]);
      }
    } else {
      value = this._validateValue(value);
    }
  }

  return value;
};

ModelProperty.prototype._setType = function(type) {
  if (type instanceof Array) {
    this._type = type[0];

    assert(
      type.length === 1 && ModelProperty.isValidType(this._type),
      util.format('Invalid ModelProperty collection type \'%s\'', type)
    );

    this.isCollection = true;
  } else {
    this._type = type;

    assert(
      ModelProperty.isValidType(this._type),
      util.format('Invalid ModelProperty type \'%s\'', type)
    );
  }
};

ModelProperty.prototype._validateValue = function(value) {
  var returnValue = value;

  if (this._type === Boolean) {
    // Boolean
    returnValue = Boolean(value);
  } else if (this._type === Date) {
    // Date
    returnValue = value instanceof Date ? value : new Date(value);
    assert(!isNaN(returnValue.getTime()), util.format('Invalid date \'%s\' for property \'%s\'', value, this.key));
  } else if (this._type === Number) {
    // Number
    returnValue = Number(value);
    assert(!isNaN(returnValue), util.format('Invalid number \'%s\' for property \'%s\'', value, this.key));
  } else if (this._type === String) {
    // String
    returnValue = String(value);
  } else if (this.isModelEnumerationType()) {
    // ModelEnumeration
    assert(
      this._type.validate(value),
      util.format('Invalid enumeration value \'%s\' for property \'%s\'', value, this.key)
    );
  } else if (!this.isModelObjectType() || !(value instanceof this._type)) {
    // !ModelObject
    throw new Error(util.format('Invalid value \'%s\' for property \'%s\'', value, this.key));
  }

  return returnValue;
};
