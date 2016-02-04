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

var _ = require('lodash');
var ChangeSet = require('../lib/change-set');
var ChangeSetQueue = require('../lib/change-set-queue');
var Constants = require('../lib/constants');
var ModelObject = require('../lib/model-object');
var Scope = require('../lib/scope');
var sinon = require('sinon');
var SyncFragment = require('../lib/sync-fragment');
var test = require('tape');
var TestModel = require('./test/model');

var changeSetQueue, model, childModel, scope;

function setup(suite) {
  return function(name, fn) {
    suite.test(name, function(t) {
      changeSetQueue = new ChangeSetQueue();
      model = new TestModel();
      childModel = new TestModel();

      scope = new Scope({ name: 'Test' });
      model.setScopeAndMakeRootModel(scope);

      fn(t);
    });
  };
}

test('ChangeSet', function(suite) {
  var it = setup(suite);

  it('should throw if instantiated without a scope', function(t) {
    t.throws(function() { new ChangeSet(); });
    t.end();
  });

  it('should throw if instantiated without syncFragments', function(t) {
    t.throws(function() {
      new ChangeSet({ scope: scope });
    });
    
    t.end();
  });

  it('should initialize with state SYNCING and call _updateTouches', function(t) {
    var spy = sinon.spy(ChangeSet.prototype, '_updateTouches');
    var changeSet = new ChangeSet({ scope: scope, syncFragments: [] });

    spy.restore();

    t.equal(changeSet._state, Constants.ChangeSetState.SYNCING);
    t.ok(spy.calledWithExactly(scope));
    t.end();
  });

  it('should reverse basic properties', function(t) {
    model.set({ number: 1, string: 'one' });
    scope.clearSyncFragments();
    
    model.set({ number: 2, string: 'two' });
    var changeSet = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    changeSet.revertOnScope(scope);

    t.equal(model.get('number'), 1);
    t.equal(model.get('string'), 'one');
    t.end();
  });

  it('should reverse model properties', function(t) {
    model.set('model', childModel);
    var changeSet = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    changeSet.revertOnScope(scope);

    t.equal(model.get('model'), null);
    t.equal(_.size(scope._models), 1);
    t.end();
  });

  it('should reapply model properties', function(t) {
    model.set('model', childModel);
    scope.clearSyncFragments();

    model.set('model', null);

    var changeSet = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    changeSet.revertOnScope(scope);

    t.equal(model.get('model'), childModel);
    t.equal(_.size(scope._models), 2);
    t.end();
  });

  it('should revert collections', function(t) {
    model.get('models').push(childModel);
    var changeSet = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });

    t.equal(changeSet.syncFragments.length, 2);
    changeSet.revertOnScope(scope);

    t.equal(model.get('models').length, 0);
    t.equal(_.size(scope._models), 1);
    t.end();
  });

  it('should move child models', function(t) {
    model.set('model', childModel);
    var changeSet = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    t.equal(changeSet.syncFragments.length, 2);

    model.set('model', null);
    model.set('modelTwo', childModel);

    changeSet = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    t.equal(changeSet.syncFragments.length, 1);

    model.set('modelTwo', null);

    changeSet = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    t.equal(changeSet.syncFragments.length, 1);

    model.set('model', childModel);

    changeSet = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    t.equal(changeSet.syncFragments.length, 2);

    t.end();
  });
});

test('ChangeSet.prototype.applyFragmentReplies', function(suite) {
  var it = setup(suite);

  it('should call revertOnScope if the fragment replies do not match', function(t) {
    model.set({ number: 1 });
    var changeSet = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    var spy = sinon.spy(changeSet, 'revertOnScope');
    changeSet.applyFragmentReplies([{ accepted: true }, { accepted: true }], scope);

    t.ok(spy.calledWithExactly(scope));
    t.end();
  });

  it('should revert changes if the fragment was not accepted', function(t) {
    model.set({ number: 1 });
    var changeSet = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    changeSet.applyFragmentReplies([{ accepted: false }], scope);

    t.equal(model.get('number'), null);
    t.end();
  });

  it('should change state to COMPLETED and emit "changeSetComplete" if all fragments are accepted', function(t) {
    model.set({ number: 1 });
    var changeSet = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });

    changeSet.on(Constants.Event.CHANGE_SET_COMPLETE, function() {
      t.equal(changeSet._state, Constants.ChangeSetState.COMPLETED);
      t.end();
    });

    changeSet.applyFragmentReplies([{ accepted: true }], scope);
  });

  it('should change state to PARTIALLY REVERTED and emit "changeSetError" if some fragments are accepted', function(t) {
    model.set({ model: childModel });
    var changeSet = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });

    changeSet.on(Constants.Event.CHANGE_SET_ERROR, function() {
      t.equal(changeSet._state, Constants.ChangeSetState.PARTIALLY_REVERTED);
      t.end();
    });

    changeSet.applyFragmentReplies([{ accepted: true }, { accepted: false }], scope);
  });

  it('should change state to REVERTED and emit "changeSetError" if no fragments are accepted', function(t) {
    model.set({ model: childModel });
    var changeSet = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });

    changeSet.on(Constants.Event.CHANGE_SET_ERROR, function() {
      t.equal(changeSet._state, Constants.ChangeSetState.REVERTED);
      t.end();
    });

    changeSet.applyFragmentReplies([{ accepted: false }, { accepted: false }], scope);
  });

  it('should apply modifications if the fragment has modifications', function(t) {
    model.set({ number: 1 });
    var changeSet = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });

    var fragmentReply = {
      accepted: true,
      modifications: { number: 2 }
    };

    changeSet.applyFragmentReplies([fragmentReply], scope);
    t.equal(model.get('number'), 2);
    t.end();
  });
});

test('ChangeSet.prototype.rebaseOnChangeSet', function(suite) {
  var it = setup(suite);

  it('should not update touches from a rebase changeSet with different SyncFragment uuids', function(t) {
    model.set('number', 1);
    var changeSetOne = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });

    childModel.setScope(scope);
    childModel.set('number', 2);
    var changeSetTwo = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });

    changeSetOne.rebaseOnChangeSet(changeSetTwo);

    t.notDeepEqual(changeSetOne.touches, changeSetTwo.touches);
    t.end();
  });

  it('should update touches with touches from the rebase changeSet', function(t) {
    model.set('number', 1);
    var changeSetOne = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });

    model.set('number', 2);
    var changeSetTwo = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });

    changeSetOne.rebaseOnChangeSet(changeSetTwo);

    t.deepEqual(changeSetOne.touches, changeSetTwo.touches);
    t.end();
  });
});

test('ChangeSet.prototype.revertOnScope', function(suite) {
  var it = setup(suite);

  it('should change state to REVERTED', function(t) {
    var changeSet = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    changeSet.revertOnScope(scope);

    t.equal(changeSet._state, Constants.ChangeSetState.REVERTED);
    t.end();
  });

  it('should emit "changeSetError"', function(t) {
    var changeSet = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    changeSet.on(Constants.Event.CHANGE_SET_ERROR, function() {
      t.pass();
      t.end();
    });

    changeSet.revertOnScope(scope);
  });
});

test('ChangeSet.prototype._changeState', function(suite) {
  var it = setup(suite);

  it('should emit "stateChanged" if the state has changed', function(t) {
    var changeSet = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    changeSet.on(Constants.Event.CHANGE_SET_STATE_CHANGED, function() {
      t.pass();
      t.end();
    });
    
    changeSet._changeState(Constants.ChangeSetState.COMPLETED);
  });
});

test('ChangeSet.prototype._pendingChangesTouchModel', function(suite) {
  var it = setup(suite);

  it('should return false if there is no queue', function(t) {
    var changeSet = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });

    t.equal(changeSet._pendingChangesTouchModel(model, 'number'), false);
    t.end();
  });

  it('should return false if ChangeSets in the queue do not touch the same model and key', function(t) {
    model.set({ number: 1 });
    var changeSetOne = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    changeSetQueue.addChangeSet(changeSetOne);

    model.set({ string: 'one' });
    var changeSetTwo = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    changeSetQueue.addChangeSet(changeSetTwo);

    t.equal(changeSetOne._pendingChangesTouchModel(model, 'number'), false);
    t.end();
  });

  it('should return true if ChangeSets in the queue touch the same model and key', function(t) {
    model.set({ number: 1 });
    var changeSetOne = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    changeSetQueue.addChangeSet(changeSetOne);

    model.set({ number: 2 });
    var changeSetTwo = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    changeSetQueue.addChangeSet(changeSetTwo);

    t.equal(changeSetOne._pendingChangesTouchModel(model, 'number'), true);
    t.end();
  });
});

test('ChangeSet.prototype._touchesModel', function(suite) {
  var it = setup(suite);

  it('should return false if it does not touch a ModelObject', function(t) {
    var changeSet = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });

    t.equal(changeSet._touchesModel({ uuid: 'test' }, 'number'), false);
    t.end();
  });

  it('should return false if it does not touch a property on a ModelObject', function(t) {
    var changeSet = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });

    t.equal(changeSet._touchesModel(model, 'number'), false);
    t.end();
  });

  it('should return true if it touches a property on a ModelObject', function(t) {
    model.set({ number: 1 });
    var changeSet = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });

    t.equal(changeSet._touchesModel(model, 'number'), true);
    t.end();
  });
});

test('ChangeSet.prototype._updateTouches', function(suite) {
  var it = setup(suite);

  it('should not update touches for non-change SyncFragments', function(t) {
    model.set('model', childModel);
    var changeSet = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    changeSet._updateTouches(scope);

    t.equal(changeSet.touches[childModel.uuid], undefined);
    t.end();
  });

  it('should update touches for change SyncFragments', function(t) {
    model.set('model', childModel);
    var changeSet = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    changeSet._updateTouches(scope);

    t.notEqual(changeSet.touches[model.uuid], undefined);
    t.end();
  });
});

test('ChangeSet.prototype._updateValueOnModel', function(suite) {
  var it = setup(suite);

  it('should not call set on the ModelObject if pending changes touch the model', function(t) {
    model.set({ number: 1 });
    var changeSetOne = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    changeSetQueue.addChangeSet(changeSetOne);

    model.set({ number: 2 });
    var changeSetTwo = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    changeSetQueue.addChangeSet(changeSetTwo);

    var spy = sinon.spy(model, 'set');
    changeSetOne._updateValueOnModel(model, 'number');
    t.notOk(spy.called);
    t.end();
  });

  it('should call set on the ModelObject if pending changes do not touch the model', function(t) {
    model.set({ number: 1 });
    var changeSetOne = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    changeSetQueue.addChangeSet(changeSetOne);

    model.set({ string: 'two' });
    var changeSetTwo = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    changeSetQueue.addChangeSet(changeSetTwo);

    var spy = sinon.spy(model, 'set');
    changeSetOne._updateValueOnModel(model, 'number');
    t.notOk(spy.calledWithExactly('number', 1));
    t.end();
  });
});
