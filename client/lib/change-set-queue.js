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

module.exports = ChangeSetQueue;

var _ = require('lodash');
var assert = require('assert');
var Constants = require('./constants');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

function ChangeSetQueue() {
  this.changeSets = [];

  // Bind prototype methods
  this._onChangeSetStateChanged = ChangeSetQueue.prototype._onChangeSetStateChanged.bind(this);
}

util.inherits(ChangeSetQueue, EventEmitter);

///////////////////////////////////////////////////////////////////////////////
// METHODS

ChangeSetQueue.prototype.addChangeSet = function(changeSet) {
  assert(this.changeSets.indexOf(changeSet) === -1, 'ChangeSet already queued');

  changeSet.changeSetQueue = this;
  this.changeSets.push(changeSet);
  this.emit(Constants.Event.CHANGE_SET_ADDED, changeSet);

  changeSet.on(Constants.Event.CHANGE_SET_STATE_CHANGED, this._onChangeSetStateChanged);
};

ChangeSetQueue.prototype._onChangeSetStateChanged = function(changeSet, state) {
  this.emit(Constants.Event.CHANGE_SET_STATE_CHANGED, changeSet, state);
  
  if (state === Constants.ChangeSetState.COMPLETED) {
    this._removeChangeSet(changeSet);
  } else if (state === Constants.ChangeSetState.REVERTED) {
    var index = this.changeSets.indexOf(changeSet);
    if (index !== -1 && index < this.changeSets.length - 1) {
      // Rebase the next ChangeSet in the queue
      this.changeSets[index + 1].rebaseOnChangeSet(this.changeSets[0]);
    }

    this._removeChangeSet(changeSet);
  }
};

ChangeSetQueue.prototype._removeChangeSet = function(changeSet) {
  var index = this.changeSets.indexOf(changeSet);
  if (index !== -1) {
    changeSet.removeListener(Constants.Event.CHANGE_SET_STATE_CHANGED, this._onChangeSetStateChanged);

    this.changeSets.splice(index, 1);
    this.emit(Constants.Event.CHANGE_SET_REMOVED, changeSet);
  }
};
