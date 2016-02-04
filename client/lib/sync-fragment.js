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

module.exports = SyncFragment;

var _ = require('lodash');
var assert = require('assert');
var Constants = require('./constants');
var ModelObject = require('./model-object');
var ModelProperty = require('./model-property');

function SyncFragment(options) {
  options = options || {};

  assert(_.contains(Constants.SyncFragmentType, options.type), 'Invalid SyncFragment type');

  var modelObject = options.modelObject;
  if (modelObject) {
    this.clsName = modelObject.clsName;
    this.properties = {};
    this.uuid = modelObject.uuid.toLowerCase();

    if (options.type === Constants.SyncFragmentType.ADD) {
      this._applyPropertiesFromModel(modelObject);
    }
  } else {
    assert(typeof options.clsName === 'string', 'Invalid SyncFragment clsName');
    assert(typeof options.uuid === 'string', 'Invalid SyncFragment uuid');

    this.clsName = options.clsName;
    this.properties = options.properties || {};
    this.uuid = options.uuid.toLowerCase();
  }

  this.originalProperties = {};
  this.type = options.type;
}

///////////////////////////////////////////////////////////////////////////////
// METHODS

SyncFragment.prototype.applyChangesToScope = function(scope, applyDefaults) {
  if (!scope.root) {
    return;
  }

  var modelObject;
  if (this.type === Constants.SyncFragmentType.ADD) {
    modelObject = this.getOrCreateModelForScope(scope);
  } else if (this.type === Constants.SyncFragmentType.CHANGE) {
    modelObject = scope.getModelByUUID(this.uuid);
  }

  if (modelObject) {
    this._applyPropertiesToModel(modelObject, scope, applyDefaults);
  }
};

SyncFragment.prototype.getOrCreateModelForScope = function(scope) {
  if (this.type === Constants.SyncFragmentType.ADD) {
    var modelObject = scope.getModelByUUID(this.uuid);
    if (modelObject) {
      return modelObject;
    } else if (this.clsName) {
      var ModelObjectClass = ModelObject.models[this.clsName];
      if (ModelObjectClass) {
        return new ModelObjectClass({ uuid: this.uuid });
      }
    }
  }

  return null;
};

SyncFragment.prototype.toJSON = function() {
  return {
    clsName: this.clsName,
    properties: this.properties,
    type: this.type,
    uuid: this.uuid
  };
};

SyncFragment.prototype.updateValueFromModel = function(key, value, previousValue) {
  if (typeof this.originalProperties[key] === 'undefined') {
    this.originalProperties[key] = typeof previousValue === 'undefined' ? null : previousValue;
  }

  this.properties[key] = ModelProperty.serialize(value);
};

SyncFragment.prototype._applyPropertiesFromModel = function(modelObject) {
  var properties = modelObject.properties;
  for (var key in properties) {
    if (properties.hasOwnProperty(key)) {
      this.properties[key] = ModelProperty.serialize(modelObject.get(key));
    }
  }
};

SyncFragment.prototype._applyPropertiesToModel = function(modelObject, scope, applyDefaults) {
  var key;

  if (applyDefaults) {
    // Set default values from the model property if it does not already exist
    for (key in modelObject.properties) {
      if (modelObject.properties.hasOwnProperty(key) && typeof this.properties[key] === 'undefined') {
        this.properties[key] = modelObject.properties[key].defaultValue;
      }
    }
  }

  // Set fragment values on the model
  for (key in this.properties) {
    if (this.properties.hasOwnProperty(key)) {
      var value = this.properties[key];
      var property = modelObject.properties[key];
      modelObject.set(key, ModelProperty.unserialize(value, property, scope));
    }
  }
};
