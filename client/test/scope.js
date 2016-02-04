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
var Constants = require('../lib/constants');
var Scope = require('../lib/scope');
var sinon = require('sinon');
var SyncFragment = require('../lib/sync-fragment');
var test = require('tape');
var TestModel = require('./test/model');

var model, childModelOne, childModelTwo, childModelThree, scope, syncFragment;

function setup(suite) {
  return function(name, fn) {
    suite.test(name, function(t) {
      model = new TestModel();
      childModelOne = new TestModel();
      childModelTwo = new TestModel();
      childModelThree = new TestModel();

      scope = new Scope({ name: 'Test' });

      syncFragment = new SyncFragment({
        type: Constants.SyncFragmentType.CHANGE,
        modelObject: childModelOne
      });

      syncFragment.properties = { number: 1 };

      fn(t);
    });
  };
}

test('Scope', function(suite) {
  var it = setup(suite);

  it('should throw if instantiated without a name', function(t) {
    t.throws(function() { new Scope(); });
    t.end();
  });

  it('should initialize with a name and no root', function(t) {
    var scope = new Scope({ name: 'Test' });

    t.equal(scope.name, 'Test');
    t.equal(scope.root, null);
    t.end();
  });

  it('should track models', function(t) {
    model.setScopeAndMakeRootModel(scope);
    model.set('model', childModelOne);

    t.equal(_.size(scope._models), 2);
    t.end();
  });

  it('should track fragments', function(t) {
    model.setScopeAndMakeRootModel(scope);

    var fragments = scope.clearSyncFragments();
    t.equal(fragments.length, 0);

    // Model changes tracked
    model.set('model', childModelOne);
    childModelOne.set('model', childModelTwo);
    fragments = scope.clearSyncFragments();
    t.equal(fragments.length, 3);
    t.equal(fragments[0].type, Constants.SyncFragmentType.ADD);
    t.equal(fragments[1].type, Constants.SyncFragmentType.CHANGE);
    t.equal(fragments[2].type, Constants.SyncFragmentType.ADD);

    // Fragments cleared
    fragments = scope.clearSyncFragments();
    t.equal(fragments.length, 0);

    // Child changes tracked
    childModelOne.set('string', 'one');
    fragments = scope.clearSyncFragments();
    t.equal(fragments.length, 1);
    t.equal(fragments[0].type, Constants.SyncFragmentType.CHANGE);

    // Child removal tracked
    model.set('model', null);
    fragments = scope.clearSyncFragments();
    t.equal(fragments.length, 1);
    t.equal(fragments[0].type, Constants.SyncFragmentType.CHANGE);
    t.equal(fragments[0].properties.model, null);

    // Removed child changes are no longer tracked
    childModelOne.set('string', 'two');
    fragments = scope.clearSyncFragments();
    t.equal(fragments.length, 0);

    t.end();
  });

  it('should track model add and change', function(t) {
    model.setScopeAndMakeRootModel(scope);
    model.set('model', childModelOne);
    childModelOne.set('model', childModelTwo);

    model.set('string', 'test');
    childModelOne.set('string', 'test');

    t.equal(scope.clearSyncFragments().length, 3);
    t.end();
  });

  it('should track model change and remove', function(t) {
    model.setScopeAndMakeRootModel(scope);
    model.set('model', childModelOne);
    childModelOne.set('model', childModelTwo);
    scope.clearSyncFragments();

    childModelOne.set('string', 'test');
    childModelTwo.set('string', 'test');
    model.set('model', null);

    t.equal(scope.clearSyncFragments().length, 1);
    t.end();
  });

  it('should track model add and remove', function(t) {
    model.setScopeAndMakeRootModel(scope);
    scope.clearSyncFragments();

    model.set('model', childModelOne);
    childModelOne.set('model', childModelTwo);
    model.set('model', null);

    t.equal(scope.clearSyncFragments().length, 1);
    t.end();
  });

  it('should track subsequent model removal', function(t) {
    model.setScopeAndMakeRootModel(scope);
    scope.clearSyncFragments();

    model.set('model', childModelOne);
    model.set('model', null);

    var fragments = scope.clearSyncFragments();
    t.equal(fragments.length, 1);
    t.equal(fragments[0].type, Constants.SyncFragmentType.CHANGE);
    t.equal(fragments[0].properties.model, null);
    t.end();
  });

  it('should emit changes', function(t) {
    model.setScopeAndMakeRootModel(scope);
    scope.clearSyncFragments();

    scope.on(Constants.Event.SCOPE_CHANGES, function(scope, changeSet) {
      t.equal(changeSet.syncFragments.length, 3);

      var fragment = changeSet.syncFragments[0];
      t.equal(fragment.type, Constants.SyncFragmentType.ADD);
      t.equal(fragment.uuid, childModelOne.uuid);
      t.ok(_.size(fragment.properties) > 2);
      t.equal(fragment.properties.string, 'child one');
      t.equal(fragment.properties.model, childModelTwo.uuid);

      fragment = changeSet.syncFragments[1];
      t.equal(fragment.type, Constants.SyncFragmentType.CHANGE);
      t.equal(fragment.uuid, model.uuid);
      t.equal(_.size(fragment.properties), 2);
      t.equal(fragment.properties.string, 'model');
      t.equal(fragment.properties.model, childModelOne.uuid);

      fragment = changeSet.syncFragments[2];
      t.equal(fragment.type, Constants.SyncFragmentType.ADD);
      t.equal(fragment.uuid, childModelTwo.uuid);
      t.ok(_.size(fragment.properties) > 2);
      t.equal(fragment.properties.string, 'child two');
      t.equal(fragment.properties.number, 1);

      t.end();
    });

    model.set('model', childModelOne);
    model.set('string', 'model');
    childModelOne.set('model', childModelTwo);
    childModelOne.set('string', 'child one');
    childModelTwo.set('string', 'child two');
    childModelTwo.set('number', 1);
  });
});

test('Scope.prototype.addModel', function(suite) {
  var it = setup(suite);

  it('should add and listen to "propertyChanged" events on the model', function(t) {
    var spy = sinon.spy(model, 'on');
    scope.addModel(model);

    t.equal(scope._models[model.uuid], model);
    t.ok(spy.calledWithExactly(Constants.Event.MODEL_PROPERTY_CHANGED, scope._onModelPropertyChanged));
    t.end();
  });

  it('should set root to the first added model', function(t) {
    t.equal(scope.root, null);

    model.setScopeAndMakeRootModel(scope);
    t.equal(scope.root, model);

    model.set('model', childModelOne);
    t.equal(scope.root, model);
    t.equal(_.size(scope._models), 2);
    t.end();
  });

  it('should not call _syncFragmentWithType on add of a model without parents while applying remote', function(t) {
    var spy = sinon.spy(scope, '_syncFragmentWithType');
    scope._applyingRemote = true;
    scope.addModel(model);

    t.notOk(spy.called);
    t.end();
  });

  it('should not call _syncFragmentWithType on add of a model with parents while applying remote', function(t) {
    var spy = sinon.spy(scope, '_syncFragmentWithType');
    scope._applyingRemote = true;

    model.set('model', childModelOne);
    scope.addModel(model);

    t.notOk(spy.called);
    t.end();
  });

  it('should not call _syncFragmentWithType on add of a model without parents and not applying remote', function(t) {
    var spy = sinon.spy(scope, '_syncFragmentWithType');
    scope.addModel(model);

    t.notOk(spy.called);
    t.end();
  });

  it('should call _syncFragmentWithType on add of a model with parents and not applying remote', function(t) {
    var spy = sinon.spy(scope, '_syncFragmentWithType');
    
    model.set('model', childModelOne);
    scope.addModel(childModelOne);

    t.ok(spy.calledWithExactly(Constants.SyncFragmentType.ADD, childModelOne));
    t.end();
  });
});

test('Scope.prototype.applySyncFragmentsWithRoot', function(suite) {
  var it = setup(suite);

  it('should not call applySyncFragments if there is no root', function(t) {
    var spy = sinon.spy(scope, 'applySyncFragments');
    scope.applySyncFragmentsWithRoot('test', []);

    t.notOk(spy.called);
    t.end();
  });

  it('should call updateModelUUID on the root with the root uuid', function(t) {
    model.setScopeAndMakeRootModel(scope);
    
    var spy = sinon.spy(scope, 'updateModelUUID');
    scope.applySyncFragmentsWithRoot('test', []);

    t.equal(model.uuid, 'test');
    t.ok(spy.calledWithExactly(model, 'test'));
    t.end();
  });

  it('should detach non-root models', function(t) {
    model.setScopeAndMakeRootModel(scope);
    model.set('model', childModelOne);
    childModelOne.set('model', childModelTwo);

    scope.applySyncFragmentsWithRoot('test', [syncFragment]);

    t.equal(_.size(scope._models), 1);
    t.end();
  });
});

test('Scope.prototype.applySyncFragments', function(suite) {
  var it = setup(suite);

  it('should apply fragment changes to the scope', function(t) {
    var syncFragmentOne = new SyncFragment({
      type: Constants.SyncFragmentType.CHANGE,
      modelObject: model
    });

    var spyOne = sinon.spy(syncFragmentOne, 'applyChangesToScope');

    var syncFragmentTwo = new SyncFragment({
      type: Constants.SyncFragmentType.CHANGE,
      modelObject: childModelOne
    });

    var spyTwo = sinon.spy(syncFragmentTwo, 'applyChangesToScope');

    scope.applySyncFragments([syncFragmentOne, syncFragmentTwo], true);

    t.ok(spyOne.calledWithExactly(scope, true));
    t.ok(spyTwo.calledWithExactly(scope, true));
    t.end();
  });
});

test('Scope.prototype.clearSyncFragments', function(suite) {
  var it = setup(suite);

  it('should return non-change and non-empty change fragments', function(t) {
    var syncFragmentOne = new SyncFragment({
      type: Constants.SyncFragmentType.ADD,
      modelObject: model
    });

    var syncFragmentTwo = new SyncFragment({
      type: Constants.SyncFragmentType.CHANGE,
      modelObject: childModelOne
    });

    syncFragmentTwo.properties.number = 1;

    var syncFragmentThree = new SyncFragment({
      type: Constants.SyncFragmentType.CHANGE,
      modelObject: childModelTwo
    });

    scope._syncFragments[model.uuid] = syncFragmentOne;
    scope._syncFragments[childModelOne.uuid] = syncFragmentTwo;
    scope._syncFragments[childModelTwo.uuid] = syncFragmentThree;

    var fragments = scope.clearSyncFragments();
    t.notEqual(fragments.indexOf(syncFragmentOne), -1);
    t.notEqual(fragments.indexOf(syncFragmentTwo), -1);
    t.equal(fragments.indexOf(syncFragmentThree), -1);
    t.end();
  });
});

test('Scope.prototype.getModelByUUID', function(suite) {
  var it = setup(suite);

  it('should return null if the uuid does not exist', function(t) {
    model.setScopeAndMakeRootModel(scope);

    t.equal(scope.getModelByUUID('test'), null);
    t.end();
  });

  it('should return the model for the given uuid', function(t) {
    model.setScopeAndMakeRootModel(scope);

    t.equal(scope.getModelByUUID(model.uuid), model);
    t.end();
  });
});

test('Scope.prototype.removeModel', function(suite) {
  var it = setup(suite);

  it('should remove and stop listening to "propertyChanged" events on the model', function(t) {
    model.setScopeAndMakeRootModel(scope);

    var spy = sinon.spy(model, 'removeListener');
    scope.removeModel(model);

    t.equal(scope._models[model.uuid], undefined);
    t.ok(spy.calledWithExactly(Constants.Event.MODEL_PROPERTY_CHANGED, scope._onModelPropertyChanged));
    t.end();
  });

  it('should set root to null if the scope does not have any more models', function(t) {
    model.setScopeAndMakeRootModel(scope);
    t.equal(scope.root, model);

    scope.removeModel(model);
    t.equal(scope.root, null);
    t.end();
  });

  it('should remove model fragments', function(t) {
    model.setScopeAndMakeRootModel(scope);
    model.set('number', 1);
    t.notEqual(scope._syncFragments[model.uuid], undefined);

    scope.removeModel(model);
    t.equal(scope._syncFragments[model.uuid], undefined);
    t.end();
  });
});

test('Scope.prototype.updateModelUUID', function(suite) {
  var it = setup(suite);

  it('should not update the model uuid if it is not in scope', function(t) {
    scope.updateModelUUID(model, 'test');

    t.notEqual(model.uuid, 'test');
    t.end();
  });

  it('should update the model uuid', function(t) {
    var uuid = model.uuid;
    model.setScopeAndMakeRootModel(scope);
    scope.updateModelUUID(model, 'test');

    t.equal(scope._models[uuid], undefined);
    t.equal(scope._models.test, model);
    t.equal(model.uuid, 'test');
    t.end();
  });
});

test('Scope.prototype._addFragment', function(suite) {
  var it = setup(suite);

  it('should add the fragment and call _setChangeTimer', function(t) {
    var spy = sinon.spy(scope, '_setChangeTimer');
    scope._addFragment(syncFragment);

    t.equal(scope._syncFragments[syncFragment.uuid], syncFragment);
    t.ok(spy.called);
    t.end();
  });
});

test('Scope.prototype._onModelPropertyChanged', function(suite) {
  var it = setup(suite);

  it('should not call _syncFragmentWithType if applying remote', function(t) {
    var spy = sinon.spy(scope, '_syncFragmentWithType');
    scope._applyingRemote = true;
    scope._onModelPropertyChanged(model, 'number', 1, null);

    t.notOk(spy.called);
    t.end();
  });

  it('should call _syncFragmentWithType and update the fragment with changed properties', function(t) {
    var spy = sinon.spy(scope, '_syncFragmentWithType');
    scope._onModelPropertyChanged(model, 'number', 1, null);

    t.ok(spy.calledWithExactly(Constants.SyncFragmentType.CHANGE, model));

    var fragment = scope._syncFragments[model.uuid];
    t.equal(fragment.originalProperties.number, null);
    t.equal(fragment.properties.number, 1);
    t.end();
  });
});

test('Scope.prototype._removeFragment', function(suite) {
  var it = setup(suite);

  it('should remove the fragment', function(t) {
    scope._syncFragments[syncFragment.uuid] = syncFragment;

    scope._removeFragment(syncFragment);

    t.equal(scope._syncFragments[syncFragment.uuid], undefined);
    t.end();
  });
});

test('Scope.prototype._sendChanges', function(suite) {
  var it = setup(suite);

  it('should not call clearSyncFragments if no changes are queued', function(t) {
    var spy = sinon.spy(scope, 'clearSyncFragments');
    scope._sendChanges();

    t.notOk(spy.called);
    t.end();
  });

  it('should emit "scopeChanges" if changes are qeueud', function(t) {
    scope._changesQueued = true;
    scope._syncFragments[childModelOne.uuid] = syncFragment;

    scope.on(Constants.Event.SCOPE_CHANGES, function(s, changeSet) {
      t.equal(s, scope);
      t.notEqual(changeSet.syncFragments.indexOf(syncFragment), -1);
      t.end();
    });

    scope._sendChanges();
  });
});

test('Scope.prototype._setChangeTimer', function(suite) {
  var it = setup(suite);

  it('should call _sendChanges after the change interval', function(t) {
    var clock = sinon.useFakeTimers();
    var spy = sinon.spy(scope, '_sendChanges');

    scope._setChangeTimer();
    t.notOk(spy.called);
    
    clock.tick(scope._changeInterval);
    t.ok(spy.called);
    t.end();

    clock.restore();
  });
});

test('Scope.prototype._syncFragmentWithType', function(suite) {
  var it = setup(suite);

  it('should call _setChangeTimer and return an existing model sync fragment', function(t) {
    scope._syncFragments[childModelOne.uuid] = syncFragment;
    var spy = sinon.spy(scope, '_setChangeTimer');
    var fragment = scope._syncFragmentWithType(null, childModelOne);

    t.ok(spy.called);
    t.equal(fragment, syncFragment);
    t.end();
  });

  it('should call _addFragment and return a new SyncFragment if one does not exist', function(t) {
    var spy = sinon.spy(scope, '_addFragment');
    var fragment = scope._syncFragmentWithType(Constants.SyncFragmentType.ADD, childModelOne);

    t.ok(spy.called);
    t.equal(fragment.type, Constants.SyncFragmentType.ADD);
    t.equal(fragment.uuid, childModelOne.uuid);
    t.end();
  });
});
