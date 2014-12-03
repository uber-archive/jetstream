//
// model_object.js
// Jetstream
// 
// Copyright (c) 2014 Uber Technologies, Inc.
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

var _ = require('lodash');
var async = require('async');
var createTestContext = require('./test/test_context');
var ModelObject = require('../lib/model_object');
var Scope = require('../lib/scope');
var sinon = require('sinon');
var test = require('redtape')();
var uuid = require('node-uuid');

var context = createTestContext('ModelObject');
var describe = context.describe;
var method = context.method;

describe(method('model'), 'when defining a model', function(thing) {

    test(thing('should throw when name not given'), function t(assert) {
        assert.throws(function() {
            ModelObject.model(undefined, function() {});
        }, /model name/);
        assert.end();
    });

    test(thing('should set the static and prototype typeName'), function t(assert) {
        var SomeModel = ModelObject.model('SomeModel', function() {});
        assert.equal(SomeModel.typeName, 'SomeModel');
        assert.equal(SomeModel.prototype.typeName, 'SomeModel');
        assert.end();
    });

    test(thing('should call the definition'), function t(assert) {
        var spy = sinon.spy();
        ModelObject.model('SomeModel', spy);
        assert.equal(spy.calledOnce, true);
        assert.end();
    });

    test(thing('should set instance methods when given'), function t(assert) {
        var spy = sinon.spy();

        var SomeModel = ModelObject.model('SomeModel', function() {}, {
            instanceMethod: spy
        });

        var someModel = new SomeModel();
        assert.equal(typeof someModel.instanceMethod, 'function');

        someModel.instanceMethod(1, 'two', 3);
        assert.equal(spy.calledOnce, true);
        assert.equal(spy.calledWithExactly(1, 'two', 3), true);

        assert.end();
    });

});

describe(method('has'), 'when defining model properties', function(thing) {

    test(thing('should throw when redefining a property'), function t(assert) {
        assert.throws(function() {
            ModelObject.model('SomeModel', function() {
                this.has('someProperty', String);
                this.has('someProperty', Number);
            });
        }, /already exists/);

        assert.end();
    });

    test(thing('should inherit supertype properties'), function t(assert) {
        var SomeSuperModel = ModelObject.model('SomeSuperModel', function() {
            this.has('aProperty', String);
        });

        var SomeChildModel = SomeSuperModel.model('SomeChildModel', function() {
            this.has('anotherProperty', Number);
        });

        var someModel = new SomeChildModel();

        var properties = someModel.getProperties();
        assert.equal(properties.length, 2);
        assert.equal(someModel.getProperty('aProperty').singleType, String);
        assert.equal(someModel.getProperty('anotherProperty').singleType, Number);

        assert.end();
    });

    test(thing('should inherit late added supertype properties'), function t(assert) {
        var SomeSuperModel = ModelObject.model('SomeSuperModel');

        var SomeChildModel = SomeSuperModel.model('SomeChildModel', function() {
            this.has('anotherProperty', Number);
        });

        SomeSuperModel.has('aProperty', String);

        var someModel = new SomeChildModel();

        var properties = someModel.getProperties();
        assert.equal(properties.length, 2);
        assert.equal(someModel.getProperty('aProperty').singleType, String);
        assert.equal(someModel.getProperty('anotherProperty').singleType, Number);

        assert.end();
    });

    test(thing('should late inherit supertype properties'), function t(assert) {
        var SomeSuperModel = ModelObject.model('SomeSuperModel', function() {
            this.has('aProperty', String);
        });

        var SomeChildModel = ModelObject.model('SomeChildModel', function() {
            this.has('anotherProperty', Number);
        });

        var properties = new SomeChildModel().getProperties();
        assert.equal(properties.length, 1);

        SomeChildModel.inherit(SomeSuperModel);

        properties = new SomeChildModel().getProperties();
        assert.equal(properties.length, 2);

        var someModel = new SomeChildModel();
        assert.equal(someModel.getProperty('aProperty').singleType, String);
        assert.equal(someModel.getProperty('anotherProperty').singleType, Number);

        assert.end();
    });

});

describe(method('has'), 'when defining primitive model properties', function(thing) {

    test(thing('should be able to create and set value properties'), function t(assert) {
        var SomeModel = ModelObject.model('SomeModel', function() {
            this.has('numberProperty', Number);
            this.has('stringProperty', String);
            this.has('booleanProperty', Boolean);
            this.has('dateProperty', Date);
        });

        var someModel = new SomeModel();

        someModel.numberProperty = 1;
        assert.equal(someModel.numberProperty, 1);
        assert.equal(someModel.getProperty('numberProperty').singleType, Number);

        someModel.stringProperty = 'word';
        assert.equal(someModel.stringProperty, 'word');
        assert.equal(someModel.getProperty('stringProperty').singleType, String);

        someModel.booleanProperty = true;
        assert.equal(someModel.booleanProperty, true);
        assert.equal(someModel.getProperty('booleanProperty').singleType, Boolean);

        var now = new Date();
        someModel.dateProperty = now;
        assert.equal(someModel.dateProperty.getTime(), now.getTime());
        assert.equal(someModel.getProperty('dateProperty').singleType, Date);

        assert.end();
    });

    test(thing('should be able to set date properties by string'), function t(assert) {
        var SomeModel = ModelObject.model('SomeModel', function() {
            this.has('dateProperty', Date);
        });

        var someModel = new SomeModel();

        var partyTime = '1999/12/31';
        someModel.dateProperty = partyTime;
        assert.equal(someModel.dateProperty.getTime(), Date.parse(partyTime));

        assert.end();
    });

    test(thing('should guard against bad date property values'), function t(assert) {
        var SomeModel = ModelObject.model('SomeModel', function() {
            this.has('dateProperty', Date);
        });

        var someModel = new SomeModel();

        var badTime = new Date('notadate');
        someModel.dateProperty = badTime;
        assert.equal(someModel.dateProperty, null);

        assert.end();
    });

    test(thing('should be able to set null property values'), function t(assert) {
        var SomeModel = ModelObject.model('SomeModel', function() {
            this.has('stringProperty', String);
        });

        var someModel = new SomeModel();

        someModel.stringProperty = null;
        assert.equal(someModel.stringProperty, null);

        assert.end();
    });

    test(thing('should be able to create and set ModelObject properties'), function t(assert) {
        var scope = new Scope({name: 'TestScope'});

        var Driver = ModelObject.model('Driver', function() {
            this.has('name', String);
        });

        var Vehicle = ModelObject.model('Vehicle', function() {
            this.has('driver', Driver);
        });

        var vehicle = new Vehicle();
        vehicle.setScope(scope, function(err) {
            assert.ifError(err);

            var driver = new Driver();
            vehicle.driver = driver;
            assert.equals(vehicle.driver.uuid, driver.uuid);
            assert.equals(vehicle.getProperty('driver').singleType, Driver);

            assert.end();
        });
    });

    test(thing('should be able to set ModelObject properties to existing value'), function t(assert) {
        var Driver = ModelObject.model('Driver', function() {
            this.has('name', String);
        });

        var Vehicle = ModelObject.model('Vehicle', function() {
            this.has('driver', Driver);
        });

        var vehicle = new Vehicle();
        var driver = new Driver();
        vehicle.driver = driver;
        assert.equals(vehicle.driver.uuid, driver.uuid);

        vehicle.driver = vehicle.driver;
        assert.equals(vehicle.driver.uuid, driver.uuid);

        assert.end();
    });

    test(thing('should not be able to set invalid property values'), function t(assert) {
        var SomeModel = ModelObject.model('SomeModel', function() {
            this.has('numberProperty', Number);
            this.has('stringProperty', String);
            this.has('booleanProperty', Boolean);
            this.has('dateProperty', Date);
            this.has('someModelProperty', this);
        });

        var someModel = new SomeModel();

        // Cannot possibly convert to a number so should be undefined
        someModel.numberProperty = 'notanumber';
        assert.equal(someModel.numberProperty, null);

        // Can convert to a number so should be number equivalent
        someModel.numberProperty = '5';
        assert.equal(someModel.numberProperty, 5);

        // Can convert most things to a string
        someModel.stringProperty = {};
        assert.equal(someModel.stringProperty, {}.toString());

        // Can convert most things to a boolean
        someModel.booleanProperty = 'word';
        assert.equal(someModel.booleanProperty, true);

        // Ensure falsy will convert to boolean false
        someModel.booleanProperty = '';
        assert.equal(someModel.booleanProperty, false);

        // Relatively strict enforcement for date properties
        someModel.dateProperty = new SomeModel();
        assert.equal(someModel.dateProperty, null);

        // Date strings should work as expected however
        someModel.dateProperty = '1999/12/31';
        assert.equal(someModel.dateProperty.getTime(), Date.parse('1999/12/31'));

        // ModelObject types are strict
        someModel.someModelProperty = new Date();
        assert.equal(someModel.someModelProperty, null);

        assert.end();
    });

    test(thing('should be able to set null values'), function t(assert) {
        var SomeModel = ModelObject.model('SomeModel', function() {
            this.has('aProperty', String);
        });

        var someModel = new SomeModel();
        someModel.aProperty = null;
        assert.equal(someModel.aProperty, null);

        assert.end();
    });

    test(thing('should remove ModelObject parent when removed from a property'), function t(assert) {
        var Person = ModelObject.model('Person', function() {
            this.has('bestFriend', this);
        });

        var person = new Person();
        person.name = 'Alex';

        var bestFriend = new Person();
        bestFriend.name = 'Sam';

        person.bestFriend = bestFriend;

        bestFriend.getParentRelationships(function(err, parentRelationships) {
            assert.ifError(err);
            assert.equal(parentRelationships.length, 1);
            assert.equal(parentRelationships[0].parent, person);
            assert.equal(parentRelationships[0].key, 'bestFriend');

            person.bestFriend = null;

            bestFriend.getParentRelationships(function(err, newParentRelationships) {
                assert.ifError(err);
                assert.equal(newParentRelationships.length, 0);
                assert.end();
            });
        });
    });

});

describe(method('has'), 'when defining collection model properties', function(thing) {

    test(thing('should be able to create and set value collection properties'), function t(assert) {
        var SomeModel = ModelObject.model('SomeModel', function() {
            this.has('numberCollectionProperty', [Number]);
            this.has('stringCollectionProperty', [String]);
            this.has('booleanCollectionProperty', [Boolean]);
            this.has('dateCollectionProperty', [Date]);
        });

        var someModel = new SomeModel();
        someModel.numberCollectionProperty = [1, 2, 3];
        assert.ok(_.isEqual(
            someModel.numberCollectionProperty.slice(0), 
            [1, 2, 3]));

        someModel.stringCollectionProperty = ['one', 'two', 'three'];
        assert.ok(_.isEqual(
            someModel.stringCollectionProperty.slice(0), 
            ['one', 'two', 'three']));

        someModel.booleanCollectionProperty = [true, true, false];
        assert.ok(_.isEqual(
            someModel.booleanCollectionProperty.slice(0), 
            [true, true, false]));

        var partyTime = new Date('1999/12/31');
        var morePartyTime = new Date('1969/12/31');
        var countryBorn = new Date('1901/01/01');
        someModel.dateCollectionProperty = [partyTime, morePartyTime, countryBorn];
        assert.ok(_.isEqual(
            someModel.dateCollectionProperty.slice(0), 
            [partyTime, morePartyTime, countryBorn]));

        assert.end();
    });

    test(thing('should be able to create and set ModelObject type properties'), function t(assert) {
        var Person = ModelObject.model('SomeModel', function() {
            this.has('children', [this]);
        });

        var parent = new Person();
        var child = new Person();
        parent.children = [child];

        assert.equal(parent.children.length, 1);
        assert.ok(_.isEqual(parent.children.objectAtIndex(0).uuid, child.uuid));

        assert.end();
    });

    test(thing('should be able to set a new set of values for collection properties'), function t(assert) {
        var SomeModel = ModelObject.model('SomeModel', function() {
            this.has('aCollectionProperty', [Number]);
        });

        var someModel = new SomeModel();
        someModel.aCollectionProperty = [1, 2, 3];
        someModel.aCollectionProperty = [4, 5, 6];
        assert.ok(_.isEqual(
            someModel.aCollectionProperty.slice(0), 
            [4, 5, 6]));

        assert.end();
    });

    test(thing('should not be able to set non-array values for collection properties'), function t(assert) {
        var SomeModel = ModelObject.model('SomeModel', function() {
            this.has('aCollectionProperty', [Number]);
        });

        var someModel = new SomeModel();
        someModel.aCollectionProperty = 1;

        assert.ok(_.isEqual(someModel.aCollectionProperty.slice(0), []));

        assert.end();
    });

    test(thing('should by default return an empty collection for collection properties'), function t(assert) {
        var SomeModel = ModelObject.model('SomeModel', function() {
            this.has('aCollectionProperty', [Number]);
        });

        var someModel = new SomeModel();
        assert.equal(someModel.aCollectionProperty.length, 0);
        assert.ok(_.isEqual(someModel.aCollectionProperty.slice(0), []));

        assert.end();
    });

    test(thing('should not be able to set invalid values for collection properties'), function t(assert) {
        var SomeModel = ModelObject.model('SomeModel', function() {
            this.has('numberCollectionProperty', [Number]);
            this.has('stringCollectionProperty', [String]);
            this.has('booleanCollectionProperty', [Boolean]);
            this.has('dateCollectionProperty', [Date]);
            this.has('someModelCollectionProperty', [this]);
        });

        var someModel = new SomeModel();

        // Cannot possibly convert to a number so should be undefined
        someModel.numberCollectionProperty = ['notanumber'];
        assert.ok(_.isEqual(
            someModel.numberCollectionProperty.slice(0), 
            []));

        // Can convert to a number so should be number equivalent
        someModel.numberCollectionProperty = ['5'];
        assert.ok(_.isEqual(
            someModel.numberCollectionProperty.slice(0), 
            [5]));

        // Can convert most things to a string
        someModel.stringCollectionProperty = [{}];
        assert.ok(_.isEqual(
            someModel.stringCollectionProperty.slice(0), 
            [{}.toString()]));

        // Can convert most things to a boolean
        someModel.booleanCollectionProperty = ['word'];
        assert.ok(_.isEqual(
            someModel.booleanCollectionProperty.slice(0), 
            [true]));

        // Ensure falsy will convert to boolean false
        someModel.booleanCollectionProperty = [''];
        assert.ok(_.isEqual(
            someModel.booleanCollectionProperty.slice(0), 
            [false]));

        // Relatively strict enforcement for date properties
        someModel.dateCollectionProperty = [new SomeModel()];
        assert.ok(_.isEqual(
            someModel.dateCollectionProperty.slice(0), 
            []));

        // Date strings should work as expected however
        someModel.dateCollectionProperty = ['1999/12/31'];
        assert.ok(_.isEqual(
            someModel.dateCollectionProperty.slice(0), 
            [new Date('1999/12/31')]));

        // ModelObject types are strict
        someModel.someModelCollectionProperty = [new Date()];
        assert.ok(_.isEqual(
            someModel.someModelCollectionProperty.slice(0), 
            []));

        assert.end();
    });

});

describe(method('constructor'), 'when creating ModelObjects', function(thing) {

    test(thing('should be able to created with a given UUID'), function t(assert) {
        var SomeModel = ModelObject.model('SomeModel', function() {
            this.has('name', String);
        });

        var id = uuid.v4();
        var someModel = new SomeModel({uuid: id});
        assert.equal(someModel.uuid, id);

        assert.end();
    });

});

describe(method('setScope'), 'when setting scope', function(thing) {

    test(thing('should be able to set a valid scope'), function t(assert) {
        var scope = new Scope({name: 'TestScope'});

        var someModel = new (ModelObject.model('SomeModel', function() {
            this.has('name', String);
        }))();

        someModel.setScope(scope, function(err) {
            assert.ifError(err);
            assert.equal(someModel.scope, scope);

            scope.containsModelObject(someModel, function(err, result) {
                assert.ifError(err);
                assert.equal(result, true);
                assert.end();
            });
        });
    });

    test(thing('should set all children\'s scope'), function t(assert) {
        var scope = new Scope({name: 'TestScope'});

        var Person = ModelObject.model('Person', function() {
            this.has('children', [this]);
        });

        var grandParent = new Person();

        var child1 = new Person();
        var child2 = new Person();
        grandParent.children = [child1, child2];

        var grandchild1 = new Person();
        var grandchild2 = new Person();
        child1.children = [grandchild1, grandchild2];

        var grandchild3 = new Person();
        var grandchild4 = new Person();
        child2.children = [grandchild3, grandchild4];

        grandParent.setScope(scope, function(err) {
            assert.ifError(err);

            assert.equal(grandParent.scope, scope);

            assert.equal(child1.scope, scope);
            assert.equal(child2.scope, scope);

            assert.equal(grandchild1.scope, scope);
            assert.equal(grandchild2.scope, scope);
            assert.equal(grandchild3.scope, scope);
            assert.equal(grandchild4.scope, scope);

            assert.end();
        });
    });    

    test(thing('should be able to remove itself from an old scope'), function t(assert) {
        var firstScope = new Scope({name: 'TestScope'});
        var secondScope = new Scope({name: 'AnotherTestScope'});

        var someModel = new (ModelObject.model('SomeModel', function() {
            this.has('name', String);
        }))();

        async.series([
            function insertAndRemove(nextCallback) {
                someModel.setScope(firstScope, function(err) {
                    if (err) {
                        return nextCallback(err);
                    }
                    
                    someModel.setScope(secondScope, nextCallback);
                });
            },

            function verifyInsert(nextCallback) {
                secondScope.containsModelObject(someModel, function(err, result) {
                    if (err || !result) {
                        return nextCallback(err || new Error('Second scope did not add ModelObject'));
                    }

                    nextCallback();
                });
            },

            function verifyRemoval(nextCallback) {
                firstScope.containsModelObject(someModel, function(err, result) {
                    if (err || result) {
                        return nextCallback(err || new Error('First scope did not remove ModelObject'));
                    }

                    nextCallback();
                });
            }

        ], function(err) {
            assert.ifError(err);
            assert.end();
        });
    });

    test(thing('should be able to set a scope and then set no scope'), function t(assert) {
        var scope = new Scope({name: 'TestScope'});

        var someModel = new (ModelObject.model('SomeModel', function() {
            this.has('name', String);
        }))();

        someModel.setScope(scope, function(err) {
            assert.ifError(err);
            assert.equal(someModel.scope, scope);

            someModel.setScope(null, function(err) {
                assert.ifError(err);
                assert.equal(someModel.scope, null);
                assert.end();
            });
        });
    });

    test(thing('should not perform routine when scope does not differ'), function t(assert) {
        var scope = new Scope({name: 'TestScope'});

        var someModel = new (ModelObject.model('SomeModel', function() {
            this.has('name', String);
        }))();

        var spy = sinon.spy();
        someModel.on('scope', spy);

        someModel.setScope(scope, function(err) {
            assert.ifError(err);
            someModel.setScope(scope, function(err) { 
                assert.ifError(err);
                assert.ok(spy.calledOnce);
                assert.end();
            });
        });
    });

});

describe(method('setIsScopeRoot'), 'when setting as scope root', function(thing) {

    test(thing('should be able to create a scope with the ModelObject name'), function t(assert) {
        var someModel = new (ModelObject.model('SomeModel', function() {
            this.has('name', String);
        }))();

        someModel.setIsScopeRoot(true, function(err) {
            assert.ifError(err);
            assert.equal(someModel.isScopeRoot, true);
            assert.equal(someModel.scope.name, 'SomeModel');
            assert.end();
        });
    });

    test(thing('should be able to revert and remove scope when set to false'), function t(assert) {
        var someModel = new (ModelObject.model('SomeModel', function() {
            this.has('name', String);
        }))();

        someModel.setIsScopeRoot(true, function(err) {
            assert.ifError(err);
            assert.equal(someModel.isScopeRoot, true);
            assert.equal(someModel.scope.name, 'SomeModel');

            someModel.setIsScopeRoot(false, function(err) {
                assert.ifError(err);
                assert.equal(someModel.isScopeRoot, false);
                assert.notOk(someModel.scope);
                assert.end();
            });
        });
    });

    test(thing('should not set scope if isScopeRoot value does not differ'), function t(assert) {
        var someModel = new (ModelObject.model('SomeModel', function() {
            this.has('name', String);
        }))();

        var sandbox = sinon.sandbox.create();
        var spy = sandbox.spy(someModel, 'setScope');

        someModel.setIsScopeRoot(true, function(err) {
            assert.ifError(err);
            assert.equal(someModel.isScopeRoot, true);
            assert.equal(someModel.scope.name, 'SomeModel');
            var createdScope = someModel.scope;

            someModel.setIsScopeRoot(true, function(err) {
                assert.ifError(err);
                assert.equal(someModel.isScopeRoot, true);
                assert.equal(someModel.scope, createdScope);
                assert.ok(spy.calledOnce);
                sandbox.restore();
                assert.end();
            });
        });
    });

});

describe(method('getChildModelObjectUUIDs'), 'when getting child UUIDs', function(thing) {

    test(thing('should get collection and primitive ModelObject property UUIDs'), function t(assert) {
        var Person = ModelObject.model('Person', function() {
            this.has('partner', this);
            this.has('children', [this]);
        });

        var parent = new Person();
        var otherParent = new Person();
        var child1 = new Person();
        var child2 = new Person();
        parent.partner = otherParent;
        parent.children = [child1, child2];

        var uuids = parent.getChildModelObjectUUIDs();
        assert.ok(_.isEqual(_.map([otherParent, child1, child2], function(modelObject) {
            return modelObject.uuid;
        }), uuids));
        assert.end();
    }); 

});

describe(method('getChildModelObjects'), 'when getting child objects', function(thing) {

    test(thing('should get collection and primitive ModelObject properties'), function t(assert) {
        var Person = ModelObject.model('Person', function() {
            this.has('partner', this);
            this.has('children', [this]);
        });

        var parent = new Person();
        var otherParent = new Person();
        var child1 = new Person();
        var child2 = new Person();
        parent.partner = otherParent;
        parent.children = [child1, child2];

        parent.getChildModelObjects(function(err, modelObjects) {
            assert.ifError(err);
            assert.ok(_.isEqual([otherParent, child1, child2], modelObjects));
            assert.end();
        });
    });

});

describe(method('getAddSyncFragment'), 'when getting ModelObject as an add fragment', function(thing) {

    test(thing('should get collection, primitive value and ModelObject properties'), function t(assert) {
        var Person = ModelObject.model('Person', function() {
            this.has('name', String);
            this.has('age', Number);
            this.has('nicknames', [String]);
            this.has('partner', this);
            this.has('children', [this]);
        });

        var parent = new Person();
        var otherParent = new Person();
        var child1 = new Person();
        var child2 = new Person();
        parent.name = 'Sam';
        parent.age = 28;
        parent.nicknames = ['samster', 'samsonite'];
        parent.partner = otherParent;
        parent.children = [child1, child2];

        var syncFragment = parent.getAddSyncFragment();
        assert.equal(syncFragment.type, 'add');
        assert.equal(syncFragment.objectUUID, parent.uuid);
        assert.equal(syncFragment.clsName, 'Person');

        var values = syncFragment.properties;
        assert.equal(Object.keys(values).length, 5);
        assert.equal(values.name, 'Sam');
        assert.equal(values.age, 28);
        assert.ok(_.isEqual(values.nicknames, ['samster', 'samsonite']));
        assert.equal(values.partner, otherParent.uuid);
        assert.ok(_.isEqual(values.children, [child1.uuid, child2.uuid]));

        assert.end();
    });

});

describe(method('getParentRelationships'), 'when getting a child\'s parents', function(thing) {

    test(thing('should callback with empty array if none set'), function t(assert) {
        var Person = ModelObject.model('Person', function() {
            this.has('children', [this]);
            this.has('name', String);
        });

        var person = new Person();
        person.name = 'Alex';

        person.getParentRelationships(function(err, parentRelationships) {
            assert.ifError(err);
            assert.equal(parentRelationships instanceof Array, true);
            assert.equal(parentRelationships.length, 0);
            assert.end();
        });
    });

    test(thing('should callback with unique set of parent and keys and remove correctly'), function t(assert) {
        var Driver = ModelObject.model('Driver', function() {
            this.has('name', String);
        });

        var Rider = ModelObject.model('Rider', function() {
            this.has('lastThreeDrivers', [Driver]);
            this.has('currentDriver', Driver);
            this.has('name', String);
        });

        var driver = new Driver();
        driver.name = 'Sam';

        var otherDriver = new Driver();
        otherDriver.name = 'Pat';

        var rider = new Rider();
        rider.name = 'Alex';
        rider.currentDriver = driver;
        rider.lastThreeDrivers = [driver, driver, otherDriver];

        var otherRider = new Rider();
        otherRider.name = 'Jo';
        otherRider.currentDriver = driver;

        driver.getParentRelationships(function(err, parentRelationships) {
            assert.ifError(err);

            assert.ok(_.isEqual([
                rider, 
                rider, 
                otherRider
            ], _.pluck(parentRelationships, 'parent')));

            assert.ok(_.isEqual([
                'currentDriver', 
                'lastThreeDrivers', 
                'currentDriver'
            ], _.pluck(parentRelationships, 'key')));

            rider.currentDriver = null;
            rider.lastThreeDrivers = [otherDriver];

            driver.getParentRelationships(function(err, newParentRelationships) {
                assert.ifError(err);
                assert.ok(_.isEqual([otherRider], _.pluck(parentRelationships, 'parent')));
                assert.ok(_.isEqual(['currentDriver'], _.pluck(parentRelationships, 'key')));
                assert.end();
            });
        });
    });

});

describe(method('_addParent'), 'when adding parent relationships', function(thing) {

    test(thing('should throw if passed invalid parent or key'), function t(assert) {
        var SomeModel = ModelObject.model('SomeModel', function() {
            this.has('aProperty', String);
        });

        var someModel = new SomeModel();

        assert.throws(function() {
            someModel._addParent('notamodel', 'someKeyPath');
        }, /Invalid parent or key/);

        assert.throws(function() {
            someModel._addParent(new SomeModel(), 1);
        }, /Invalid parent or key/);

        assert.end();
    });

    test(thing('should throw if passed parent with different scope'), function t(assert) {
        var SomeModel = ModelObject.model('SomeModel', function() {
            this.has('someModelProperty', this);
        });

        var someModel = new SomeModel();
        someModel.setIsScopeRoot(true, function(err) {
            assert.ifError(err);

            var someOtherModel = new SomeModel();
            someOtherModel.setIsScopeRoot(true, function(err) {
                assert.ifError(err);

                assert.throws(function() {
                    someModel._addParent(someOtherModel, 'someModelProperty');
                }, /differing scope/);
                assert.end();
            });
        });
    });

});

describe(method('_removeParent'), 'when removing parent relationships', function(thing) {

    test(thing('should throw if passed invalid parent or key'), function t(assert) {
        var SomeModel = ModelObject.model('SomeModel', function() {
            this.has('someModelProperty', this);
        });

        var someModel = new SomeModel();
        var someOtherModel = new SomeModel();
        someModel.someModelProperty = someOtherModel;

        assert.throws(function() {
            someModel._removeParent('notamodel', 'someModelProperty');
        }, /Invalid parent or key/);

        assert.throws(function() {
            someModel._removeParent(someOtherModel, 1);
        }, /Invalid parent or key/);

        assert.end();
    });

    test(thing('should throw if no such parent at key'), function t(assert) {
        var Driver = ModelObject.model('Driver', function() {
            this.has('name', String);
        });

        var Rider = ModelObject.model('Rider', function() {
            this.has('currentDriver', Driver);
            this.has('lastDriver', Driver);
            this.has('name', String);
        });

        var currentDriver = new Driver();
        var lastDriver = new Driver();

        var rider = new Rider();
        rider.currentDriver = currentDriver;
        rider.lastDriver = lastDriver;

        assert.throws(function() {
            currentDriver._removeParent(rider, 'lastDriver');
        }, /No such parent on key/);

        assert.end();
    });

});
