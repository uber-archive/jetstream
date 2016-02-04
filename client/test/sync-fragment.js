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
var ModelObject = require('../lib/model-object');
var Scope = require('../lib/scope');
var sinon = require('sinon');
var SyncFragment = require('../lib/sync-fragment');
var test = require('tape');
var TestModel = require('./test/model');

var model, childModel, scope;

function setup(suite) {
  return function(name, fn) {
    suite.test(name, function(t) {
      model = new TestModel();
      childModel = new TestModel();
      model.set('model', childModel);

      scope = new Scope({ name: 'Test' });
      model.setScopeAndMakeRootModel(scope);

      fn(t);
    });
  };
}

test('SyncFragment', function(suite) {
  var it = setup(suite);

  it('should throw if instantiated with an invalid type', function(t) {
    t.throws(function() { new SyncFragment({ clsName: 'Test', uuid: 'test' }); });
    t.throws(function() {
      new SyncFragment({ clsName: 'Test', type: 'test', uuid: 'test' });
    });

    t.doesNotThrow(function() {
      new SyncFragment({ clsName: 'Test', type: 'add', uuid: 'test' });
      new SyncFragment({ clsName: 'Test', type: 'change', uuid: 'test' });
    });

    t.end();
  });

  it('should throw if instantiated without a clsName or ModelObject', function(t) {
    t.throws(function() {
      new SyncFragment({ type: 'change', uuid: 'test' });
    });

    t.doesNotThrow(function() {
      new SyncFragment({ clsName: 'Test', type: 'change', uuid: 'test' });
    });

    t.doesNotThrow(function() {
      new SyncFragment({ type: 'change', modelObject: model });
    });

    t.end();
  });

  it('should throw if instantiated without a uuid or ModelObject', function(t) {
    t.throws(function() {
      new SyncFragment({ clsName: 'Test', type: 'change' });
    });

    t.doesNotThrow(function() {
      new SyncFragment({ clsName: 'Test', type: 'change', uuid: 'test' });
    });

    t.doesNotThrow(function() {
      new SyncFragment({ type: 'change', modelObject: model });
    });

    t.end();
  });

  it('should apply a change fragment', function(t) {
    var fragment = new SyncFragment({
      clsName: 'TestModel',
      properties: {
        number: 1,
        string: 'test'
      },
      type: 'change',
      uuid: childModel.uuid
    });

    t.equal(fragment.uuid, childModel.uuid);
    t.equal(_.size(fragment.properties), 2);

    fragment.applyChangesToScope(scope);
    t.equal(model.get('model').get('number'), 1);
    t.equal(model.get('model').get('string'), 'test');
    t.end();
  });

  it('should apply an add fragment', function(t) {
    var fragmentOne = new SyncFragment({
      clsName: 'TestModel',
      properties: { string: 'test' },
      type: 'add',
      uuid: 'uuid'
    });

    var fragmentTwo = new SyncFragment({
      clsName: 'TestModel',
      properties: { model: 'uuid' },
      type: 'change',
      uuid: childModel.uuid
    });

    scope.applySyncFragments([fragmentOne, fragmentTwo]);
    var testModel = childModel.get('model');

    t.ok(!!testModel);
    t.equal(testModel._parentRelationships[0].parent, childModel);
    t.equal(testModel.scope, scope);
    t.equal(testModel.get('string'), 'test');
    t.equal(_.size(scope._models), 3);
    t.end();
  });

  it('should apply an add fragment with an array of models', function(t) {
    var fragmentOne = new SyncFragment({
      clsName: 'TestModel',
      properties: { string: 'test' },
      type: 'add',
      uuid: 'uuid'
    });

    var fragmentTwo = new SyncFragment({
      clsName: 'TestModel',
      properties: { models: ['uuid'] },
      type: 'change',
      uuid: childModel.uuid
    });

    scope.applySyncFragments([fragmentOne, fragmentTwo]);
    var testModel = childModel.get('models').at(0);

    t.ok(!!testModel);
    t.equal(testModel._parentRelationships[0].parent, childModel);
    t.equal(testModel.scope, scope);
    t.equal(testModel.get('string'), 'test');
    t.equal(_.size(scope._models), 3);
    t.end();
  });

  it('should apply a change fragment with null values', function(t) {
    var fragment = new SyncFragment({
      clsName: 'TestModel',
      properties: {
        number: null,
        string: null
      },
      type: 'change',
      uuid: childModel.uuid
    });

    childModel.set('number', 1);
    childModel.set('string', 'test');

    fragment.applyChangesToScope(scope);
    t.equal(childModel.get('number'), null);
    t.equal(childModel.get('string'), null);
    t.end();
  });

  it('should not apply a change fragment with invalid values', function(t) {
    var fragment = new SyncFragment({
      clsName: 'TestModel',
      properties: {
        date: 'test',
        number: 'test'
      },
      type: 'change',
      uuid: childModel.uuid
    });

    var date = new Date();
    childModel.set('date', date);
    childModel.set('number', 1);

    fragment.applyChangesToScope(scope);
    t.equal(childModel.get('date'), date);
    t.equal(childModel.get('number'), 1);
    t.end();
  });
});

test('SyncFragment.prototype.applyChangesToScope', function(suite) {
  var it = setup(suite);

  it('should call _applyPropertiesToModel on add fragment with a new ModelObject', function(t) {
    var fragment = new SyncFragment({
      clsName: 'TestModel',
      type: 'add',
      uuid: 'uuid'
    });

    var spyOne = sinon.spy(fragment, 'getOrCreateModelForScope');
    var spyTwo = sinon.spy(fragment, '_applyPropertiesToModel');
    fragment.applyChangesToScope(scope, true);

    t.ok(spyOne.calledWithExactly(scope));
    t.ok(spyTwo.called);
    t.ok(spyTwo.firstCall.args[0] instanceof TestModel);
    t.equal(spyTwo.firstCall.args[0].uuid, 'uuid');
    t.end();
  });

  it('should call _applyPropertiesToModel on change fragment with an existing ModelObject', function(t) {
    var fragment = new SyncFragment({
      clsName: 'TestModel',
      type: 'add',
      uuid: model.uuid
    });

    var spyOne = sinon.spy(scope, 'getModelByUUID');
    var spyTwo = sinon.spy(fragment, '_applyPropertiesToModel');
    fragment.applyChangesToScope(scope, true);

    t.ok(spyOne.calledWithExactly(model.uuid));
    t.ok(spyTwo.called);
    t.ok(spyTwo.firstCall.args[0], model);
    t.equal(spyTwo.firstCall.args[0].uuid, model.uuid);
    t.end();
  });
});

test('SyncFragment.prototype.getOrCreateModelForScope', function(suite) {
  var it = setup(suite);

  it('should return null on non-add fragment', function(t) {
    var fragment = new SyncFragment({
      clsName: 'TestModel',
      type: 'change',
      uuid: model.uuid
    });

    var modelObject = fragment.getOrCreateModelForScope(scope);
    t.equal(modelObject, null);
    t.end();
  });

  it('should return the model if it is in scope', function(t) {
    var fragment = new SyncFragment({
      clsName: 'TestModel',
      type: 'add',
      uuid: model.uuid
    });

    var modelObject = fragment.getOrCreateModelForScope(scope);
    t.equal(modelObject, model);
    t.end();
  });

  it('should create a new model with the uuid if it is not in scope', function(t) {
    var fragment = new SyncFragment({
      clsName: 'TestModel',
      type: 'add',
      uuid: 'uuid'
    });

    var modelObject = fragment.getOrCreateModelForScope(scope);
    t.ok(modelObject instanceof TestModel);
    t.equal(modelObject.uuid, 'uuid');
    t.end();
  });
});

test('SyncFragment.prototype.updateValueFromModel', function(suite) {
  var it = setup(suite);

  it('should set previous and serialized values', function(t) {
    var fragment = new SyncFragment({
      clsName: 'TestModel',
      type: 'change',
      uuid: model.uuid
    });

    model.get('models').push(childModel);
    fragment.updateValueFromModel('number', 1, null);
    fragment.updateValueFromModel('model', childModel, null);
    fragment.updateValueFromModel('models', model.get('models'), null);
    
    t.equal(fragment.originalProperties.number, null);
    t.equal(fragment.properties.number, 1);
    t.equal(fragment.properties.model, childModel.uuid);
    t.equal(fragment.properties.models[0], childModel.uuid);
    t.end();
  });
});

test('SyncFragment.prototype._applyPropertiesFromModel', function(suite) {
  var it = setup(suite);

  it('should set serialized values from the model', function(t) {
    var fragment = new SyncFragment({
      clsName: 'TestModel',
      type: 'change',
      uuid: model.uuid
    });

    model.set({ number: 1, string: 'test', models: [childModel] });
    fragment._applyPropertiesFromModel(model);

    t.equal(fragment.properties.number, 1);
    t.equal(fragment.properties.string, 'test');
    t.equal(fragment.properties.models[0], childModel.uuid);
    t.end();
  });
});

test('SyncFragment.prototype._applyPropertiesToModel', function(suite) {
  var it = setup(suite);

  it('should set default values on the model', function(t) {
    var TestDefaultModel = ModelObject.create({
      name: 'TestDefaultModel',
      definition: function() {
        this.has('number', Number, { defaultValue: 1 });
        this.has('string', String, { defaultValue: 'test' });
      }
    });

    var defaultModel = new TestDefaultModel();
    var fragment = new SyncFragment({
      clsName: 'TestDefaultModel',
      type: 'change',
      uuid: defaultModel.uuid
    });

    defaultModel.set({ number: null, string: null });

    fragment._applyPropertiesToModel(defaultModel, scope);

    t.equal(defaultModel.get('number'), null);
    t.equal(defaultModel.get('string'), null);

    fragment._applyPropertiesToModel(defaultModel, scope, true);

    t.equal(defaultModel.get('number'), 1);
    t.equal(defaultModel.get('string'), 'test');
    t.end();
  });

  it('should set unserialized values on the model', function(t) {
    var childModelTwo = new TestModel();
    childModelTwo.setScope(scope);

    var fragment = new SyncFragment({
      clsName: 'TestModel',
      properties: { number: 1, string: 'test', model: childModelTwo.uuid },
      type: 'change',
      uuid: model.uuid
    });

    fragment._applyPropertiesToModel(model, scope);

    t.equal(model.get('number'), 1);
    t.equal(model.get('string'), 'test');
    t.equal(model.get('model'), childModelTwo);
    t.end();
  });
});
