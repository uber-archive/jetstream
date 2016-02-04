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

module.exports = ChangeSet;

var _ = require('lodash');
var assert = require('assert');
var Constants = require('./constants');
var EventEmitter = require('events').EventEmitter;
var log = require('./log')('ChangeSet');
var Scope = require('./scope');
var util = require('util');

function ChangeSet(options) {
  options = options || {};

  assert(options.scope instanceof Scope, 'Invalid ChangeSet scope');
  assert(options.syncFragments instanceof Array, 'Invalid ChangeSet syncFragments');

  this.atomic = !!options.atomic;
  this.changeSetQueue = null;
  this.syncFragments = options.syncFragments;
  this.touches = {};

  this._state = Constants.ChangeSetState.SYNCING;

  this._updateTouches(options.scope);
}

util.inherits(ChangeSet, EventEmitter);

///////////////////////////////////////////////////////////////////////////////
// METHODS

ChangeSet.prototype.applyFragmentReplies = function(fragmentReplies, scope) {
  if (fragmentReplies.length !== this.syncFragments.length) {
    log.error('Fragment mismatch, reverting ChangeSet');
    return this.revertOnScope(scope);
  }

  var error = false;
  for (var i = 0; i < fragmentReplies.length; i++) {
    var syncFragment = this.syncFragments[i];
    var modelObject = scope.getModelByUUID(syncFragment.uuid);
    var reply = fragmentReplies[i];
    var key;

    if (!reply.accepted) {
      error = true;

      if (modelObject) {
        if (syncFragment.type !== Constants.SyncFragmentType.CHANGE) {
          continue;
        }

        // Apply original properties from the fragment
        for (key in syncFragment.properties) {
          if (syncFragment.properties.hasOwnProperty(key)) {
            var touch = this.touches[modelObject.uuid];
            if (touch) {
              this._updateValueOnModel(modelObject, key, touch.properties[key]);
            }
          }
        }
      }
    }

    var modifications = reply.modifications;
    if (modifications) {
      // Apply modifications to the model
      for (key in modifications) {
        if (modifications.hasOwnProperty(key)) {
          this._updateValueOnModel(modelObject, key, modifications[key]);
        }
      }
    }
  }

  if (!error) {
    this._changeState(Constants.ChangeSetState.COMPLETED);
    this.emit(Constants.Event.CHANGE_SET_COMPLETE);
  } else {
    // Check if some fragments were successfully applied
    if (_.some(fragmentReplies, 'accepted')) {
      this._changeState(Constants.ChangeSetState.PARTIALLY_REVERTED);
    } else {
      this._changeState(Constants.ChangeSetState.REVERTED);
    }

    this.emit(Constants.Event.CHANGE_SET_ERROR);
  }
};

ChangeSet.prototype.rebaseOnChangeSet = function(changeSet) {
  for (var rebaseUUID in changeSet.touches) {
    if (changeSet.touches.hasOwnProperty(rebaseUUID)) {
      for (var uuid in this.touches) {
        if (this.touches.hasOwnProperty(uuid)) {
          if (uuid !== rebaseUUID) {
            continue;
          }

          var rebaseProperties = changeSet.touches[rebaseUUID].properties;
          for (var key in rebaseProperties) {
            if (rebaseProperties.hasOwnProperty(key)) {
              this.touches[uuid].properties[key] = rebaseProperties[key];
            }
          }
        }
      }
    }
  }
};

ChangeSet.prototype.revertOnScope = function(scope) {
  for (var uuid in this.touches) {
    if (this.touches.hasOwnProperty(uuid)) {
      var touch = this.touches[uuid];
      var modelObject = touch.modelObject;
      var properties = touch.properties;

      for (var key in properties) {
        if (properties.hasOwnProperty(key)) {
          this._updateValueOnModel(modelObject, key, properties[key]);
        }
      }
    }
  }

  this._changeState(Constants.ChangeSetState.REVERTED);
  this.emit(Constants.Event.CHANGE_SET_ERROR);
};

ChangeSet.prototype._changeState = function(state) {
  if (this._state !== state) {
    this._state = state;
    this.emit(Constants.Event.CHANGE_SET_STATE_CHANGED, this, this._state);
  }
};

ChangeSet.prototype._pendingChangesTouchModel = function(modelObject, key) {
  if (this.changeSetQueue) {
    var index = this.changeSetQueue.changeSets.indexOf(this);
    if (index !== -1) {
      var pendingChangeSets = this.changeSetQueue.changeSets.slice(index + 1);
      return _.reduce(pendingChangeSets, function(touches, changeSet) {
        return touches || changeSet._touchesModel(modelObject, key);
      }, false);
    }
  }

  return false;
};

ChangeSet.prototype._touchesModel = function(modelObject, key) {
  var touch = this.touches[modelObject.uuid];
  if (touch) {
    var properties = touch.properties;
    return properties && typeof properties[key] !== 'undefined';
  }

  return false;
};

ChangeSet.prototype._updateTouches = function(scope) {
  for (var i = 0; i < this.syncFragments.length; i++) {
    var fragment = this.syncFragments[i];
    if (fragment.type !== Constants.SyncFragmentType.CHANGE) {
      continue;
    }

    var modelObject = scope.getModelByUUID(fragment.uuid);
    if (modelObject) {
      var touch = this.touches[modelObject.uuid];
      var properties = (touch && touch.properties) || {};
      var fragmentProperties = fragment.properties || {};

      for (var key in fragmentProperties) {
        if (fragmentProperties.hasOwnProperty(key)) {
          var value = fragment.originalProperties[key];
          properties[key] = typeof value === 'undefined' ? null : value;
        }
      }

      this.touches[modelObject.uuid] = {
        modelObject: modelObject,
        properties: properties
      };
    }
  }
};

ChangeSet.prototype._updateValueOnModel = function(modelObject, key, value) {
  if (!this._pendingChangesTouchModel(modelObject, key)) {
    modelObject.set(key, typeof value === 'undefined' ? null : value);
  }
};
