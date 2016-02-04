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

module.exports = ModelObject;

var _ = require('lodash');
var assert = require('assert');
var Constants = require('./constants');
var EventEmitter = require('events').EventEmitter;
var log = require('./log')('ModelObject');
var ModelCollection = require('./model-collection');
var ModelParentRelationship = require('./model-parent-relationship');
var ModelProperty = require('./model-property');
var util = require('util');
var uuid = require('node-uuid');

var _models = {};

function ModelObject(options) {
  options = options || {};

  if (typeof options.uuid === 'string') {
    this.uuid = options.uuid;
  } else {
    this.uuid = uuid.v4();
  }

  this._parentRelationships = [];
  this._treeInvalidated = false;

  this._initPropertyValues();
  this._initPropertyListeners();
}

util.inherits(ModelObject, EventEmitter);

///////////////////////////////////////////////////////////////////////////////
// STATIC

ModelObject.create = function(name, definition, methods) {
  // Support options as an object as the first parameter
  if (typeof name === 'object') {
    definition = name.definition;
    methods = name.methods;
    name = name.name;
  } else {
    // Support methods without a definition
    if (typeof definition === 'object') {
      methods = definition;
      definition = null;
    }
  }

  assert(typeof name === 'string', 'Invalid ModelObject name');
  assert(!_models[name], util.format('ModelObject \'%s\' already defined', name));

  var ModelObjectClass = function() {
    ModelObject.apply(this, arguments);
  };

  util.inherits(ModelObjectClass, ModelObject);

  ModelObjectClass.clsName = name;
  ModelObjectClass.has = ModelObject.has;
  ModelObjectClass.prototype.clsName = name;
  ModelObjectClass.prototype.properties = {};

  // Call model definition
  if (typeof definition === 'function') {
    definition.call(ModelObjectClass);
  }

  // Set model instance methods
  if (typeof methods === 'object') {
    for (var key in methods) {
      if (methods.hasOwnProperty(key)) {
        ModelObjectClass.prototype[key] = methods[key];
      }
    }
  }

  // Save model class
  _models[name] = ModelObjectClass;

  return ModelObjectClass;
};

ModelObject.has = function(key, type, options) {
  options = options || {};
  options.key = key;
  options.type = type;

  this.prototype.properties[key] = new ModelProperty(options);
};

ModelObject.models = _models;

///////////////////////////////////////////////////////////////////////////////
// METHODS

ModelObject.prototype.detach = function() {
  this._parentRelationships.forEach(this._removeParent, this);
};

ModelObject.prototype.get = function(key) {
  return this._values[key];
};

ModelObject.prototype.hasParents = function() {
  return this._parentRelationships.length > 0;
};

ModelObject.prototype.off = function(eventName, callback) {
  var events = eventName.split(/\s+/);

  for (var i = 0; i < events.length; i++) {
    var eventNames = events[i].split(':');
    var action = eventNames[0];
    var key = eventNames[1];

    if (action === 'change' || action === 'add' || action === 'remove') {
      var property = this.properties[key];

      // Check if the property exists
      if (!property) {
        log.error(util.format('Invalid property \'%s\' to stop listening to on ModelObject \'%s\'', key, this.clsName));
        continue;
      }

      // Check if the property is a collection
      if (action !== 'change' && !property.isCollection) {
        log.error(util.format('Invalid collection property \'%s\' to stop listening to on ModelObject \'%s\'', key, this.clsName));
        continue;
      }

      this._listeners[key][action] = _.without(this._listeners[key][action], callback);
    } else {
      // Remove the bound events using the original events module
      EventEmitter.prototype.removeListener.call(this, eventName, callback);
    }
  }
};

ModelObject.prototype.on = function(eventName, callback) {
  assert(
    typeof callback === 'function',
    util.format('Invalid function callback on ModelObject \'%s\' event \'%s\'', this.clsName, eventName)
  );

  var events = eventName.split(/\s+/);

  for (var i = 0; i < events.length; i++) {
    var eventNames = events[i].split(':');
    var action = eventNames[0];
    var key = eventNames[1];

    if (action === 'change' || action === 'add' || action === 'remove') {
      var property = this.properties[key];

      // Check if the property exists
      if (!property) {
        log.error(util.format('Invalid property \'%s\' to listen to on ModelObject \'%s\'', key, this.clsName));
        continue;
      }

      // Check if the property is a collection
      if (action !== 'change' && !property.isCollection) {
        log.error(util.format('Invalid collection property \'%s\' to listen to on ModelObject \'%s\'', key, this.clsName));
        continue;
      }

      this._listeners[key][action].push(callback);
    } else {
      // Bind the event using the original events module
      EventEmitter.prototype.on.call(this, eventName, callback);
    }
  }
};

ModelObject.prototype.onCollectionAdd = function(key, value) {
  if (value instanceof ModelObject) {
    value._addParent(key, this);
  }

  this._keyChanged(key, this.get(key));

  // Execute add listeners for the changed property
  var callbacks = this._listeners[key].add;
  for (var i = 0; i < callbacks.length; i++) {
    callbacks[i](value);
  }
};

ModelObject.prototype.onCollectionRemove = function(key, value) {
  if (value instanceof ModelObject) {
    value._removeParent(key, this);
  }

  this._keyChanged(key, this.get(key));

  // Execute remove listeners for the changed property
  var callbacks = this._listeners[key].remove;
  for (var i = 0; i < callbacks.length; i++) {
    callbacks[i](value);
  }
};

ModelObject.prototype.set = function(key, value) {
  var properties = {};
  
  // Construct properties from `"key", value` or `{ key: value }` parameters
  if (typeof key === 'object') {
    properties = key;
  } else {
    properties[key] = value;
  }

  for (key in properties) {
    if (properties.hasOwnProperty(key)) {
      if (!this.properties.hasOwnProperty(key)) {
        log.error(util.format('Invalid set property \'%s\' on ModelObject \'%s\'', key, this.clsName));
        continue;
      }

      try {
        var previousValue = this._values[key];
        var property = this.properties[key];

        // Validate property values
        value = property.validate(properties[key]);

        if (property.isCollection) {
          this._values[key].reset(value || []);
        } else {
          this._values[key] = value;

          // Remove the parent on the previous ModelObject value
          if (previousValue instanceof ModelObject) {
            previousValue._removeParent(key, this);
          }

          // Add the parent on the ModelObject value
          if (value instanceof ModelObject) {
            value._addParent(key, this);
          }

          if (!_.isEqual(previousValue, value)) {
            this._keyChanged(key, value, previousValue);
          }
        }
      } catch(e) {
        log.error(e);
      }
    }
  }
};

ModelObject.prototype.setScope = function(scope) {
  if (this.scope === scope) {
    return;
  }

  var previousScope = this.scope;

  // Remove from previous scope
  if (previousScope) {
    previousScope.removeModel(this);
    this.emit(Constants.Event.MODEL_SCOPE_DETACHED, this, previousScope);
  }

  // Add to scope
  if (scope) {
    scope.addModel(this);
    this.emit(Constants.Event.MODEL_SCOPE_ATTACHED, this, scope);
  }

  // Update scope on child models
  var childModels = this._getChildModels();
  for (var i = 0; i < childModels.length; i++) {
    childModels[i].setScope(scope);
  }

  this.scope = scope;
};

ModelObject.prototype.setScopeAndMakeRootModel = function(scope) {
  this.detach();
  this.setScope(scope);
};

ModelObject.prototype.toJSON = function() {
  return _.clone(this._values);
};

ModelObject.prototype._addParent = function(key, parent) {
  assert(parent instanceof ModelObject, 'Invalid ModelObject parent');
  assert(!this.scope || !parent.scope || this.scope === parent.scope, 'ModelObject can only be attached to one scope');

  this._parentRelationships.push(new ModelParentRelationship({
    key: key,
    parent: parent
  }));

  if (this._parentRelationships.length === 1) {
    this.setScope(parent.scope);
  }
};

ModelObject.prototype._getChildModels = function() {
  var childModels = [];

  for (var key in this.properties) {
    if (this.properties.hasOwnProperty(key)) {
      var property = this.properties[key];
      if (!property.isModelObjectType()) {
        continue;
      }

      var value = this._values[key];
      if (property.isCollection) {
        childModels = childModels.concat(value.slice());
      } else if (value) {
        childModels.push(value);
      }
    }
  }

  return childModels;
};

ModelObject.prototype._initPropertyValues = function() {
  this._values = _.reduce(this.properties, function(result, property, key) {
    if (property.isCollection) {
      result[key] = new ModelCollection({
        owner: this,
        property: property
      });
    } else {
      result[key] = property.defaultValue;
    }

    return result;
  }.bind(this), {});
};

ModelObject.prototype._initPropertyListeners = function() {
  this._listeners = _.reduce(this.properties, function(result, property, key) {
    var listeners = { change: [] };

    if (property.isCollection) {
      listeners.add = [];
      listeners.remove = [];
    }

    result[key] = listeners;

    return result;
  }, {});
};

ModelObject.prototype._keyChanged = function(key, value, previousValue) {
  this.emit(Constants.Event.MODEL_PROPERTY_CHANGED, this, key, value, previousValue);
      
  // Execute listeners for the changed property
  var callbacks = this._listeners[key].change;
  for (var i = 0; i < callbacks.length; i++) {
    callbacks[i](this, value, previousValue);
  }

  this._setTreeInvalidated(true);
};

ModelObject.prototype._removeChildAtKey = function(key, child) {
  var property = this.properties[key];
  var value = this.get(key);

  if (property.isCollection) {
    var index = value.indexOf(child);
    if (index !== -1) {
      value.splice(index, 1);
    }
  } else if (value === child) {
    this.set(key, null);
  }
};

ModelObject.prototype._removeParent = function(key, parent) {
  var parentRelationship;

  // Support the parentRelationship as the first parameter
  if (key instanceof ModelParentRelationship) {
    parentRelationship = key;
    key = parentRelationship.key;
  } else {
    parentRelationship = _.findWhere(this._parentRelationships, {
      key: key,
      parent: parent
    });
  }

  if (parentRelationship) {
    this._parentRelationships = _.without(this._parentRelationships, parentRelationship);
    parentRelationship.parent._removeChildAtKey(parentRelationship.key, this);

    if (!this.hasParents()) {
      this.setScope(null);
    }
  } else {
    log.error(util.format('Invalid parent at key \'%s\' to remove on ModelObject \'%s\'', key, this.clsName));
  }
};

ModelObject.prototype._setTreeInvalidated = function(treeInvalidated) {
  if (this._treeInvalidated === treeInvalidated) {
    return;
  }

  this._treeInvalidated = treeInvalidated;

  if (this._treeInvalidated) {
    _.defer(function() {
      this._setTreeInvalidated(false);
      this.emit(Constants.Event.MODEL_TREE_CHANGED, this);
    }.bind(this));

    for (var i = 0; i < this._parentRelationships.length; i++) {
      this._parentRelationships[i].parent._setTreeInvalidated(true);
    }
  }
};
