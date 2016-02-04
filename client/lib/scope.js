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

module.exports = Scope;

var _ = require('lodash');
var assert = require('assert');
var ChangeSet = require('./change-set');
var Constants = require('./constants');
var EventEmitter = require('events').EventEmitter;
var SyncFragment = require('./sync-fragment');
var util = require('util');

function Scope(options) {
  options = options || {};

  assert(typeof options.name === 'string', 'Invalid Scope name');

  this.name = options.name;
  this.root = null;

  this._applyingRemote = false;
  this._changeInterval = options.changeInterval || Constants.Scope.CHANGE_INTERVAL;
  this._changesQueued = false;
  this._syncFragments = {};
  
  this._models = {};
  this._removedModels = {};
  this._syncingModels = {};

  // Bind prototype methods
  this._onModelPropertyChanged = Scope.prototype._onModelPropertyChanged.bind(this);
  this._sendChanges = Scope.prototype._sendChanges.bind(this);
}

util.inherits(Scope, EventEmitter);

///////////////////////////////////////////////////////////////////////////////
// METHODS

Scope.prototype.addModel = function(modelObject) {
  this._models[modelObject.uuid] = modelObject;

  if (_.size(this._models) === 1) {
    this.root = modelObject;
  }

  modelObject.on(Constants.Event.MODEL_PROPERTY_CHANGED, this._onModelPropertyChanged);

  if (modelObject.hasParents()) {
    if (this._removedModels[modelObject.uuid]) {
      delete this._removedModels[modelObject.uuid];
    } else if (!this._applyingRemote) {
      this._syncFragmentWithType(Constants.SyncFragmentType.ADD, modelObject);
    }
  }
};

Scope.prototype.applyRemote = function(callback) {
  this._applyingRemote = true;
  callback();
  this._applyingRemote = false;
};

Scope.prototype.applySyncFragmentsWithRoot = function(rootUUID, syncFragments) {
  if (this.root) {
    this.updateModelUUID(this.root, rootUUID);

    var uuids = _.pluck(syncFragments, 'uuid');
    for (var uuid in this._models) {
      if (this._models.hasOwnProperty(uuid)) {
        if (uuid !== rootUUID && uuids.indexOf(uuid) !== -1) {
          this._models[uuid].detach();
        }
      }
    }

    this.applySyncFragments(syncFragments, true);
  }
};

Scope.prototype.applySyncFragments = function(syncFragments, applyDefaults) {
  var i, length = syncFragments.length;

  for (i = 0; i < length; i++) {
    var modelObject = syncFragments[i].getOrCreateModelForScope(this);
    if (modelObject) {
      this._syncingModels[modelObject.uuid] = modelObject;
    }
  }

  for (i = 0; i < length; i++) {
    syncFragments[i].applyChangesToScope(this, applyDefaults);
  }

  this._syncingModels = {};
};

Scope.prototype.clearSyncFragments = function() {
  // Remove empty change fragments
  var fragments = _.filter(this._syncFragments, function(fragment) {
    return (fragment.type !== Constants.SyncFragmentType.CHANGE || _.size(fragment.properties));
  });
  
  this._removedModels = {};
  this._syncFragments = {};
  return fragments;
};

Scope.prototype.getModelByUUID = function(uuid) {
  return this._models[uuid] || this._syncingModels[uuid] || null;
};

Scope.prototype.removeModel = function(modelObject) {
  delete this._models[modelObject.uuid];

  modelObject.removeListener(Constants.Event.MODEL_PROPERTY_CHANGED, this._onModelPropertyChanged);
  this._removedModels[modelObject.uuid] = modelObject;

  if (_.size(this._models) === 0) {
    this.root = null;
  }

  var fragment = this._syncFragments[modelObject.uuid];
  if (fragment) {
    this._removeFragment(fragment);
  }
};

Scope.prototype.updateModelUUID = function(modelObject, uuid) {
  if (this._models[modelObject.uuid]) {
    delete this._models[modelObject.uuid];
    this._models[uuid] = modelObject;
    modelObject.uuid = uuid;
  }
};

Scope.prototype._addFragment = function(fragment) {
  this._syncFragments[fragment.uuid] = fragment;
  this._setChangeTimer();
  return fragment;
};

Scope.prototype._onModelPropertyChanged = function(modelObject, key, value, previousValue) {
  if (this._applyingRemote) {
    return;
  }

  var fragment = this._syncFragmentWithType(Constants.SyncFragmentType.CHANGE, modelObject);
  if (fragment) {
    fragment.updateValueFromModel(key, value, previousValue);
  }
};

Scope.prototype._removeFragment = function(fragment) {
  delete this._syncFragments[fragment.uuid];
};

Scope.prototype._sendChanges = function() {
  if (!this._changesQueued) {
    return;
  }

  this._changesQueued = false;

  var syncFragments = this.clearSyncFragments();
  if (syncFragments.length) {
    var changeSet = new ChangeSet({
      scope: this,
      syncFragments: syncFragments
    });

    this.emit(Constants.Event.SCOPE_CHANGES, this, changeSet);
  }
};

Scope.prototype._setChangeTimer = function() {
  if (this._changesQueued) {
    return;
  }

  this._changesQueued = true;
  setTimeout(this._sendChanges, this._changeInterval);
};

Scope.prototype._syncFragmentWithType = function(type, modelObject) {
  var fragment = this._syncFragments[modelObject.uuid];
  if (fragment) {
    this._setChangeTimer();
    return fragment;
  }

  return this._addFragment(new SyncFragment({
    modelObject: modelObject,
    type: type
  }));
};
