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

var ChangeSet = require('../lib/change-set');
var ChangeSetQueue = require('../lib/change-set-queue');
var Constants = require('../lib/constants');
var ModelObject = require('../lib/model-object');
var Scope = require('../lib/scope');
var sinon = require('sinon');
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

test('ChangeSetQueue', function(suite) {
  var it = setup(suite);

  it('should complete', function(t) {
    model.set({ number: 1, numberTwo: 10, string: 'one' });
    scope.clearSyncFragments();

    model.set({ number: 2, numberTwo: 20, string: 'two' });
    var changeSet = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    changeSetQueue.addChangeSet(changeSet);

    changeSet._changeState(Constants.ChangeSetState.COMPLETED);
    changeSet.emit(Constants.Event.CHANGE_SET_COMPLETE);

    t.equal(model.get('number'), 2);
    t.equal(model.get('numberTwo'), 20);
    t.equal(model.get('string'), 'two');
    t.equal(changeSetQueue.changeSets.length, 0);
    t.end();
  });

  it('should revert', function(t) {
    model.set({ number: 1, numberTwo: 10, string: 'one' });
    scope.clearSyncFragments();

    model.set({ number: 2, numberTwo: 20, string: 'two' });
    var changeSet = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    changeSetQueue.addChangeSet(changeSet);

    changeSet.revertOnScope(scope);

    t.equal(model.get('number'), 1);
    t.equal(model.get('numberTwo'), 10);
    t.equal(model.get('string'), 'one');
    t.equal(changeSetQueue.changeSets.length, 0);
    t.end();
  });

  it('should rebase', function(t) {
    model.set({ number: 1, numberTwo: 10, string: 'one' });
    scope.clearSyncFragments();

    model.set({ number: 2, numberTwo: 20, string: 'two' });
    var changeSetOne = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    changeSetQueue.addChangeSet(changeSetOne);

    model.set({ number: 3, numberTwo: 30, string: 'three' });
    var changeSetTwo = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    changeSetQueue.addChangeSet(changeSetTwo);

    changeSetOne.revertOnScope(scope);
    t.equal(model.get('number'), 3);
    t.equal(model.get('numberTwo'), 30);
    t.equal(model.get('string'), 'three');
    t.equal(changeSetQueue.changeSets.length, 1);

    changeSetTwo.revertOnScope(scope);
    t.equal(model.get('number'), 1);
    t.equal(model.get('numberTwo'), 10);
    t.equal(model.get('string'), 'one');
    t.equal(changeSetQueue.changeSets.length, 0);
    t.end();
  });

  it('should subset rebase', function(t) {
    model.set({ number: 1, numberTwo: 10, string: 'one' });
    scope.clearSyncFragments();

    model.set({ number: 2 });
    var changeSetOne = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    changeSetQueue.addChangeSet(changeSetOne);

    model.set({ number: 3, numberTwo: 30 });
    var changeSetTwo = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    changeSetQueue.addChangeSet(changeSetTwo);

    model.set({ number: 4, numberTwo: 40, string: 'four' });
    var changeSetThree = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    changeSetQueue.addChangeSet(changeSetThree);

    changeSetOne.revertOnScope(scope);
    changeSetTwo.revertOnScope(scope);
    changeSetThree.revertOnScope(scope);

    t.equal(model.get('number'), 1);
    t.equal(model.get('numberTwo'), 10);
    t.equal(model.get('string'), 'one');
    t.equal(changeSetQueue.changeSets.length, 0);
    t.end();
  });

  it('should superset rebase', function(t) {
    model.set({ number: 1, numberTwo: 10, string: 'one' });
    scope.clearSyncFragments();

    model.set({ number: 2, numberTwo: 20, string: 'two' });
    var changeSetOne = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    changeSetQueue.addChangeSet(changeSetOne);

    model.set({ number: 3, numberTwo: 30 });
    var changeSetTwo = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    changeSetQueue.addChangeSet(changeSetTwo);

    model.set({ number: 4 });
    var changeSetThree = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    changeSetQueue.addChangeSet(changeSetThree);

    changeSetOne.revertOnScope(scope);
    changeSetTwo.revertOnScope(scope);
    changeSetThree.revertOnScope(scope);

    t.equal(model.get('number'), 1);
    t.equal(model.get('numberTwo'), 10);
    t.equal(model.get('string'), 'one');
    t.equal(changeSetQueue.changeSets.length, 0);
    t.end();
  });

  it('should revert between ChangeSets', function(t) {
    model.set({ number: 1, numberTwo: 10, string: 'one' });
    scope.clearSyncFragments();

    model.set({ number: 2, numberTwo: 20, string: 'two' });
    var changeSetOne = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    changeSetQueue.addChangeSet(changeSetOne);

    model.set({ number: 3, numberTwo: 30, string: 'three' });
    var changeSetTwo = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    changeSetQueue.addChangeSet(changeSetTwo);

    changeSetOne.revertOnScope(scope);
    changeSetTwo._changeState(Constants.ChangeSetState.COMPLETED);
    changeSetTwo.emit(Constants.Event.CHANGE_SET_COMPLETE);

    t.equal(model.get('number'), 3);
    t.equal(model.get('numberTwo'), 30);
    t.equal(model.get('string'), 'three');
    t.equal(changeSetQueue.changeSets.length, 0);
    t.end();
  });

  it('should rebase over ChangeSets', function(t) {
    model.set({ number: 1, numberTwo: 10, string: 'one' });
    scope.clearSyncFragments();

    model.set({ number: 2, numberTwo: 20, string: 'two' });
    var changeSetOne = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    changeSetQueue.addChangeSet(changeSetOne);

    model.set({ number: 3, numberTwo: 30 });
    var changeSetTwo = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    changeSetQueue.addChangeSet(changeSetTwo);

    model.set({ number: 4, numberTwo: 40, string: 'four' });
    var changeSetThree = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    changeSetQueue.addChangeSet(changeSetThree);

    changeSetOne.revertOnScope(scope);
    changeSetTwo.revertOnScope(scope);
    changeSetThree.revertOnScope(scope);

    t.equal(model.get('number'), 1);
    t.equal(model.get('numberTwo'), 10);
    t.equal(model.get('string'), 'one');
    t.equal(changeSetQueue.changeSets.length, 0);
    t.end();
  });
});

test('ChangeSetQueue.prototype.addChangeSet', function(suite) {
  var it = setup(suite);

  it('should throw if the ChangeSet is already queued', function(t) {
    var changeSet = new ChangeSet({ scope: scope, syncFragments: [] });
    changeSetQueue.addChangeSet(changeSet);

    t.throws(function() {
      changeSetQueue.addChangeSet(changeSet);
    });

    t.end();
  });

  it('should set the queue on the ChangeSet, add it to the queue, and emit "changeSetAdded" with the added ChangeSet', function(t) {
    var changeSet = new ChangeSet({ scope: scope, syncFragments: [] });

    changeSetQueue.on(Constants.Event.CHANGE_SET_ADDED, function(cs) {
      t.equal(cs, changeSet);
      t.equal(changeSet.changeSetQueue, changeSetQueue);
      t.equal(changeSetQueue.changeSets.length, 1);
      t.end();
    });

    changeSetQueue.addChangeSet(changeSet);
  });

  it('should listen to "changeSetStateChanged" on the added ChangeSet', function(t) {
    var changeSet = new ChangeSet({ scope: scope, syncFragments: [] });
    var spy = sinon.spy(changeSet, 'on');
    changeSetQueue.addChangeSet(changeSet);

    t.ok(spy.calledWithExactly(Constants.Event.CHANGE_SET_STATE_CHANGED, changeSetQueue._onChangeSetStateChanged));
    t.end();
  });
});

test('ChangeSetQueue.prototype._onChangeSetStateChanged', function(suite) {
  var it = setup(suite);

  it('should emit "changeSetStateChanged" with the changed ChangeSet and state', function(t) {
    var changeSet = new ChangeSet({ scope: scope, syncFragments: [] });

    changeSetQueue.on(Constants.Event.CHANGE_SET_STATE_CHANGED, function(cs, state) {
      t.equal(cs, changeSet);
      t.equal(state, changeSet._state);
      t.end();
    });

    changeSetQueue.addChangeSet(changeSet);
    changeSet._changeState(Constants.ChangeSetState.COMPLETED);
  });

  it('should call _removeChangeSet when the ChangeSet state is COMPLETED', function(t) {
    var changeSet = new ChangeSet({ scope: scope, syncFragments: [] });
    var spy = sinon.spy(changeSetQueue, '_removeChangeSet');
    changeSetQueue.addChangeSet(changeSet);
    changeSet._changeState(Constants.ChangeSetState.COMPLETED);

    t.ok(spy.calledWithExactly(changeSet));
    t.end();
  });

  it('should call rebaseOnChangeSet on the next ChangeSet when the ChangeSet state is REVERTED', function(t) {
    model.set({ number: 1 });
    var changeSetOne = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    changeSetQueue.addChangeSet(changeSetOne);

    model.set({ number: 2 });
    var changeSetTwo = new ChangeSet({ scope: scope, syncFragments: scope.clearSyncFragments() });
    changeSetQueue.addChangeSet(changeSetTwo);

    var spy = sinon.spy(changeSetTwo, 'rebaseOnChangeSet');
    changeSetOne._changeState(Constants.ChangeSetState.REVERTED);

    t.ok(spy.calledWithExactly(changeSetOne));
    t.end();
  });
});

test('ChangeSetQueue.prototype._removeChangeSet', function(suite) {
  var it = setup(suite);

  it('should remove the ChangeSet from its list of ChangeSets', function(t) {
    var changeSet = new ChangeSet({ scope: scope, syncFragments: [] });
    changeSetQueue.addChangeSet(changeSet);
    changeSetQueue._removeChangeSet(changeSet);

    t.equal(changeSetQueue.changeSets.indexOf(changeSet), -1);
    t.equal(changeSetQueue.changeSets.length, 0);
    t.end();
  });

  it('should emit "changeSetRemoved" with the removed ChangeSet', function(t) {
    var changeSet = new ChangeSet({ scope: scope, syncFragments: [] });
    changeSetQueue.addChangeSet(changeSet);
    
    changeSetQueue.on(Constants.Event.CHANGE_SET_REMOVED, function(cs) {
      t.equal(cs, changeSet);
      t.end();
    });

    changeSetQueue._removeChangeSet(changeSet);
  });
});
