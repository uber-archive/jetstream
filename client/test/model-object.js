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
var ModelCollection = require('../lib/model-collection');
var ModelObject = require('../lib/model-object');
var ModelProperty = require('../lib/model-property');
var Scope = require('../lib/scope');
var sinon = require('sinon');
var test = require('tape');
var TestModel = require('./test/model');

var model, childModel, scopeOne, scopeTwo;

function setup(suite) {
  return function(name, fn) {
    suite.test(name, function(t) {
      model = new TestModel();
      childModel = new TestModel();

      scopeOne = new Scope({ name: 'ScopeOne' });
      scopeTwo = new Scope({ name: 'ScopeTwo' });

      fn(t);
    });
  };
}

test('ModelObject', function(suite) {
  var it = setup(suite);

  it('should always initialize with a uuid', function(t) {
    var modelOne = new TestModel();
    var modelTwo = new TestModel({ uuid: 'test' });

    t.ok(modelOne.uuid);
    t.ok(modelTwo.uuid);
    t.equal(modelTwo.uuid, 'test');
    t.end();
  });
});

test('ModelObject.create', function(suite) {
  var it = setup(suite);

  it('should throw if instantiated without a name', function(t) {
    t.throws(function() { ModelObject.create(); });
    t.end();
  });

  it('should throw if a ModelObject already exists with the same name', function(t) {
    t.throws(function() {
      ModelObject.create('TestDuplicateModel');
      ModelObject.create('TestDuplicateModel');
    });

    t.end();
  });

  it('should support object and parameter instantiation', function(t) {
    var TestObjectModel = ModelObject.create({ name: 'TestObjectModel' });
    var TestParameterModel = ModelObject.create('TestParameterModel');

    t.equal(TestObjectModel.clsName, 'TestObjectModel');
    t.equal(TestParameterModel.clsName, 'TestParameterModel');
    t.end();
  });

  it('should call its definition function', function(t) {
    var spy = sinon.spy();
    ModelObject.create('TestDefinitionModel', spy);

    t.ok(spy.calledOnce);
    t.end();
  });

  it('should set its instance methods', function(t) {
    var spy = sinon.spy();
    var TestInstanceMethodsModel = ModelObject.create('TestInstanceMethodsModel', {
      instanceMethod: spy
    });
    
    var instanceMethodsModel = new TestInstanceMethodsModel();
    t.equal(instanceMethodsModel.instanceMethod, spy);

    instanceMethodsModel.instanceMethod('test');
    t.ok(spy.calledOnce);
    t.ok(spy.calledWithExactly('test'));

    t.end();
  });
});

test('ModelObject.has', function(suite) {
  var it = setup(suite);

  it('should instantiate a ModelProperty on its prototype', function(t) {
    var property = TestModel.prototype.properties.number;
    t.ok(property instanceof ModelProperty);
    t.equal(property.key, 'number');
    t.equal(property._type, Number);
    t.end();
  });
});

test('ModelObject.prototype.detach', function(suite) {
  var it = setup(suite);

  it('should call _removeParent with the parent relationship for each parent', function(t) {
    var modelTwo = new TestModel();
    var spy = sinon.spy(childModel, '_removeParent');

    model.set('model', childModel);
    modelTwo.set('model', childModel);

    var parentRelationshipOne = _.findWhere({
      key: 'model',
      parent: model
    });

    var parentRelationshipTwo = _.findWhere({
      key: 'model',
      parent: modelTwo
    });

    childModel.detach();

    t.ok(spy.calledWith(parentRelationshipOne));
    t.ok(spy.calledWith(parentRelationshipTwo));
    t.end();
  });
});

test('ModelObject.prototype.hasParents', function(suite) {
  var it = setup(suite);

  it('should return true if the model has parents', function(t) {
    model.set('model', childModel);
    t.equal(childModel.hasParents(), true);
    t.end();
  });

  it('should return false if the model does not have parents', function(t) {
    t.equal(childModel.hasParents(), false);
    t.end();
  });
});

test('ModelObject.prototype.off', function(suite) {
  var it = setup(suite);

  it('should remove listeners from the appropriate property listener array', function(t) {
    var spy = sinon.spy();
    model.on('change:number', spy);
    model.off('change:number', spy);

    t.equal(model._listeners.number.change.indexOf(spy), -1);
    t.end();
  });

  it('should not throw if an invalid listener is removed from a property', function(t) {
    t.doesNotThrow(function() { model.off('change:test', sinon.spy()); });
    t.doesNotThrow(function() { model.off('remove:number', sinon.spy()); });
    t.end();
  });

  it('should support removal of custom event listeners', function(t) {
    var spy = sinon.spy();

    model.on('test', spy);
    model.off('test', spy);
    model.emit('test');

    t.notOk(spy.called);
    t.end();
  });
});

test('ModelObject.prototype.on', function(suite) {
  var it = setup(suite);

  it('should add listeners from the appropriate property listener array', function(t) {
    var spy = sinon.spy();
    model.on('change:number', spy);

    t.doesNotEqual(model._listeners.number.change.indexOf(spy), -1);
    t.end();
  });

  it('should not throw if an invalid listener is added to a property', function(t) {
    t.doesNotThrow(function() { model.on('change:test', sinon.spy()); });
    t.doesNotThrow(function() { model.on('remove:number', sinon.spy()); });
    t.end();
  });

  it('should support custom event listeners', function(t) {
    var spy = sinon.spy();
    model.on('test', spy);
    model.emit('test', true);

    t.ok(spy.calledWithExactly(true));
    t.end();
  });
});

test('ModelObject.prototype.onCollectionAdd', function(suite) {
  var it = setup(suite);

  it('should call _addParent on the added value if it is a model', function(t) {
    var spy = sinon.spy(childModel, '_addParent');
    model.onCollectionAdd('models', childModel);

    t.ok(spy.calledWithExactly('models', model));
    t.end();
  });

  it('should call _keyChanged with the key and collection', function(t) {
    var spy = sinon.spy(model, '_keyChanged');
    model.onCollectionAdd('numbers', 0);

    t.ok(spy.calledWithExactly('numbers', model.get('numbers')));
    t.end();
  });

  it('should call listeners with the added value for the changed property', function(t) {
    var spyOne = sinon.spy();
    var spyTwo = sinon.spy();
    model.on('add:numbers', spyOne);
    model.on('add:numbers', spyTwo);
    model.onCollectionAdd('numbers', 0);

    t.ok(spyOne.calledWithExactly(0));
    t.ok(spyTwo.calledWithExactly(0));
    t.end();
  });
});

test('ModelObject.prototype.onCollectionRemove', function(suite) {
  var it = setup(suite);

  it('should call _removeParent on the removed value if it is a model', function(t) {
    var spy = sinon.spy(childModel, '_removeParent');
    model.onCollectionRemove('models', childModel);

    t.ok(spy.calledWithExactly('models', model));
    t.end();
  });

  it('should call _keyChanged with the key and collection', function(t) {
    var spy = sinon.spy(model, '_keyChanged');
    model.onCollectionRemove('numbers', 0);

    t.ok(spy.calledWithExactly('numbers', model.get('numbers')));
    t.end();
  });

  it('should call listeners with the removed value for the changed property', function(t) {
    var spyOne = sinon.spy();
    var spyTwo = sinon.spy();
    model.on('remove:numbers', spyOne);
    model.on('remove:numbers', spyTwo);
    model.onCollectionRemove('numbers', 0);

    t.ok(spyOne.calledWithExactly(0));
    t.ok(spyTwo.calledWithExactly(0));
    t.end();
  });
});

test('ModelObject.prototype.set', function(suite) {
  var it = setup(suite);

  it('should not throw or set a value on an invalid property', function(t) {
    t.doesNotThrow(function() { model.set('test', 0); });
    t.equal(model._values.test, undefined);
    t.end();
  });

  it('should call validate on the property with the value to set', function(t) {
    var spyOne = sinon.spy(model.properties.number, 'validate');
    var spyTwo = sinon.spy(model.properties.model, 'validate');
    model.set('number', 0);
    model.set('model', childModel);

    t.ok(spyOne.calledWithExactly(0));
    t.ok(spyTwo.calledWithExactly(childModel));

    model.set('model', 0);
    t.ok(spyTwo.threw());

    t.end();
  });

  it('should reset a collection property with the value', function(t) {
    var collection = model._values.numbers;
    var spy = sinon.spy(collection, 'reset');

    model.set('numbers', [1, 2]);
    t.ok(spy.calledWithExactly([1, 2]));

    model.set('numbers', [3, 4]);
    t.ok(spy.calledWithExactly([3, 4]));

    t.deepEqual(collection._values, [3, 4]);
    t.end();
  });

  it('should call _removeParent on the replaced ModelObject value', function(t) {
    var spy = sinon.spy(childModel, '_removeParent');
    model.set('model', childModel);
    model.set('model', null);

    t.ok(spy.calledWithExactly('model', model));
    t.end();
  });

  it('should call _addParent on the set ModelObject value', function(t) {
    var spy = sinon.spy(childModel, '_addParent');
    model.set('model', childModel);

    t.ok(spy.calledWithExactly('model', model));
    t.end();
  });

  it('should call _keyChanged when the value has changed', function(t) {
    var spy = sinon.spy(model, '_keyChanged');
    
    model.set('number', 0);
    t.ok(spy.lastCall.calledWithExactly('number', 0, null));

    model.set('number', 1);
    t.ok(spy.lastCall.calledWithExactly('number', 1, 0));

    model.set('number', 1);
    t.ok(spy.calledTwice);

    t.end();
  });
});

test('ModelObject.prototype.setScope', function(suite) {
  var it = setup(suite);

  it('should call removeModel on the previous scope and addModel on the next scope', function(t) {
    var spyAddOne = sinon.spy(scopeOne, 'addModel');
    var spyRemoveOne = sinon.spy(scopeOne, 'removeModel');
    var spyAddTwo = sinon.spy(scopeTwo, 'addModel');

    model.setScope(scopeOne);
    t.ok(spyAddOne.calledWithExactly(model));
    t.equal(model.scope, scopeOne);

    model.setScope(scopeTwo);
    t.ok(spyRemoveOne.calledWithExactly(model));
    t.ok(spyAddTwo.calledWithExactly(model));

    t.equal(model.scope, scopeTwo);
    t.end();
  });

  it('should call setScope on its child models', function(t) {
    var childModelOne = new TestModel();
    var childModelTwo = new TestModel();
    var childModelThree = new TestModel();
    var spyOne = sinon.spy(childModelOne, 'setScope');
    var spyTwo = sinon.spy(childModelTwo, 'setScope');
    var spyThree = sinon.spy(childModelThree, 'setScope');
    model.set('model', childModelOne);
    model.get('models').push(childModelTwo, childModelThree);

    model.setScope(scopeOne);
    t.ok(spyOne.calledWithExactly(scopeOne));
    t.ok(spyTwo.calledWithExactly(scopeOne));
    t.ok(spyThree.calledWithExactly(scopeOne));
    t.end();
  });
});

test('ModelObject.prototype.setScopeAndMakeRootModel', function(suite) {
  var it = setup(suite);

  it('should remove any parents and update its scope', function(t) {
    model.set('model', childModel);

    t.ok(childModel.hasParents());
    childModel.setScopeAndMakeRootModel(scopeOne);
    t.notOk(childModel.hasParents());

    t.equal(childModel.scope, scopeOne);
    t.end();
  });
});

test('ModelObject.prototype._addParent', function(suite) {
  var it = setup(suite);

  it('should throw on an invalid parent', function(t) {
    t.throws(function() { childModel._addParent('model', null); });
    t.throws(function() { childModel._addParent('model', true); });
    t.end();
  });

  it('should throw on scope mismatch', function(t) {
    model.setScope(scopeOne);

    childModel.setScope(scopeTwo);
    t.throws(function() { childModel._addParent('model', model); });

    childModel.setScope(scopeOne);
    t.doesNotThrow(function() { childModel._addParent('model', model); });
    t.end();
  });

  it('should add to the child model\'s parent relationships', function(t) {
    childModel._addParent('model', model);
    t.equal(childModel._parentRelationships.length, 1);
    t.end();
  });

  it('should set the child model\'s scope to its parent\'s scope', function(t) {
    model.setScope(scopeOne);
    childModel._addParent('model', model);

    t.equal(childModel.scope, scopeOne);
    t.end();
  });
});

test('ModelObject.prototype._getChildModels', function(suite) {
  var it = setup(suite);

  it('should return an array of child models', function(t) {
    var childModelOne = new TestModel();
    var childModelTwo = new TestModel();
    var childModelThree = new TestModel();
    model.set('model', childModelOne);
    model.get('models').push(childModelTwo, childModelThree);

    var childModels = model._getChildModels();
    t.equal(childModels.length, 3);
    t.notEqual(childModels.indexOf(childModelOne), -1);
    t.notEqual(childModels.indexOf(childModelTwo), -1);
    t.notEqual(childModels.indexOf(childModelThree), -1);
    t.end();
  });
});

test('ModelObject.prototype._initPropertyValues', function(suite) {
  var it = setup(suite);
  var TestDefaultValueModel = ModelObject.create({
    name: 'TestDefaultValueModel',
    definition: function() {
      this.has('date', Date);
      this.has('number', Number, { defaultValue: 1234 });
      this.has('string', String, { defaultValue: 'test' });
      this.has('numbers', [Number]);
    }
  });

  it('should initialize property values with default values', function(t) {
    var defaultModel = new TestDefaultValueModel();
    t.ok(_.size(defaultModel._values) > 0);

    t.equal(defaultModel.get('date'), null);
    t.equal(defaultModel.get('number'), 1234);
    t.equal(defaultModel.get('string'), 'test');

    t.ok(defaultModel.get('numbers') instanceof ModelCollection);
    t.equal(defaultModel.get('numbers').length, 0);
    t.end();
  });
});

test('ModelObject.prototype._initPropertyListeners', function(suite) {
  var it = setup(suite);

  it('should initialize property listeners as empty arrays', function(t) {
    for (var key in model.properties) {
      if (model.properties.hasOwnProperty(key)) {
        var property = model.properties[key];
        if (property.isCollection) {
          t.ok(model._listeners[key].add instanceof Array);
          t.ok(model._listeners[key].remove instanceof Array);
          t.equal(model._listeners[key].add.length, 0);
          t.equal(model._listeners[key].remove.length, 0);
        }

        t.ok(model._listeners[key].change instanceof Array);
        t.equal(model._listeners[key].change.length, 0);
      }
    }

    t.end();
  });
});

test('ModelObject.prototype._keyChanged', function(suite) {
  var it = setup(suite);

  it('should emit a "propertyChanged" event with the changed property', function(t) {
    model.on(Constants.Event.MODEL_PROPERTY_CHANGED, function(model, key, value, previousValue) {
      t.equal(key, 'number');
      t.equal(value, 0);
      t.equal(previousValue, 1);
      t.end();
    });

    model._keyChanged('number', 0, 1);
  });

  it('should call listeners with the changed property', function(t) {
    var spyOne = sinon.spy();
    var spyTwo = sinon.spy();
    model.on('change:number', spyOne);
    model.on('change:number', spyTwo);
    model._keyChanged('number', 0, 1);

    t.ok(spyOne.calledWithExactly(model, 0, 1));
    t.ok(spyTwo.calledWithExactly(model, 0, 1));
    t.end();
  });

  it('should call _setTreeInvalidated', function(t) {
    var spy = sinon.spy(model, '_setTreeInvalidated');
    model._keyChanged('number', 0, 1);

    t.ok(spy.calledWithExactly(true));
    t.end();
  });
});

test('ModelObject.prototype._removeChildAtKey', function(suite) {
  var it = setup(suite);

  it('should remove the child from the collection at the key', function(t) {
    model.get('models').push(childModel);
    model._removeChildAtKey('models', childModel);

    t.equal(model.get('models').length, 0);
    t.end();
  });

  it('should not set the value at the key to null for a different child', function(t) {
    model.set('model', new TestModel());
    model._removeChildAtKey('model', new TestModel());

    t.notEqual(model.get('model'), null);
    t.end();
  });

  it('should set the value at the key to null', function(t) {
    model.set('model', childModel);
    model._removeChildAtKey('model', childModel);

    t.equal(model.get('model'), null);
    t.end();
  });
});

test('ModelObject.prototype._removeParent', function(suite) {
  var it = setup(suite);

  it('should remove and call _removeChildAtKey on its parents', function(t) {
    var modelTwo = new TestModel();
    var spyOne = sinon.spy(model, '_removeChildAtKey');
    var spyTwo = sinon.spy(modelTwo, '_removeChildAtKey');
    model.set('model', childModel);
    modelTwo.set('model', childModel);

    t.equal(childModel._parentRelationships.length, 2);

    childModel._removeParent('model', model);
    childModel._removeParent('model', modelTwo);

    t.ok(spyOne.calledWithExactly('model', childModel));
    t.ok(spyTwo.calledWithExactly('model', childModel));
    t.equal(childModel._parentRelationships.length, 0);
    t.end();
  });

  it('should set its scope to null if it has no parents', function(t) {
    model.setScope(scopeOne);
    model.set('model', childModel);

    t.equal(childModel.scope, scopeOne);
    childModel._removeParent('model', model);
    t.equal(childModel.scope, null);
    t.end();
  });
});

test('ModelObject.prototype._setTreeInvalidated', function(suite) {
  var it = setup(suite);

  it('should emit a "treeChanged" event when the tree is invalidated', function(t) {
    model.on(Constants.Event.MODEL_TREE_CHANGED, function(m) {
      t.equal(m, model);
      t.end();
    });

    model._setTreeInvalidated(true);
  });

  it('should call _setTreeInvalidated on its parents when the tree is invalidated', function(t) {
    model.set('model', childModel);

    var spy = sinon.spy(model, '_setTreeInvalidated');
    childModel._setTreeInvalidated(false);
    t.notOk(spy.called);

    childModel._setTreeInvalidated(true);
    t.ok(spy.called);

    t.end();
  });
});
