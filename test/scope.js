//
// scope.js
// Jetstream
// 
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

var _ = require('lodash');
var async = require('async');
var Canvas = require('../demos/shapes').Canvas;
var createTestContext = require('./test/test_context');
var ModelObject = require('../lib/model_object');
var Scope = require('../lib/scope');
var Shape = require('../demos/shapes').Shape;
var sinon = require('sinon');
var SyncFragment = require('../lib/sync_fragment');
var test = require('redtape')();

var context = createTestContext('Scope');
var describe = context.describe;
var method = context.method;

describe(method('applySyncFragments'), 'when removing orphaned objects', function(thing) {

    test(thing('should remove any model objects that have no parents'), function t(assert) {
        var scope = new Scope({name: 'TestScope'});
        var canvas = new Canvas();
        var shape1 = new Shape();
        var shape2 = new Shape();
        canvas.shapes = [shape1, shape2];

        var memoryPersist = scope.persist;
        var sandbox = sinon.sandbox.create();
        var removeModelObjectSpy = sandbox.spy(scope, 'removeModelObject');

        async.series([
            function setRoot(nextCallback) {
                scope.setRoot(canvas, function(err) {
                    assert.ifError(err);
                    assert.equal(memoryPersist._modelObjects.length, 3);
                    assert.equal(Object.keys(memoryPersist._modelObjectsByUUID).length, 3);
                    nextCallback();
                });
            },

            function applyChangeToRemoveSecondShape(nextCallback) {
                var change = new SyncFragment({
                    type: 'change',
                    clsName: 'Canvas',
                    uuid: canvas.uuid,
                    properties: {
                        shapes: [shape1.uuid]
                    }
                });

                scope.applySyncFragments([change], nextCallback);
            },

            function assertShape2OrphanedAndRemoved(nextCallback) {
                assert.ok(removeModelObjectSpy.calledOnce);
                assert.ok(removeModelObjectSpy.calledWith(shape2));

                var parentRelationships = shape2.getParentRelationships();
                assert.equal(parentRelationships.length, 0);
                assert.notOk(shape2.scope);

                assert.equal(memoryPersist._modelObjects.length, 2);
                assert.equal(Object.keys(memoryPersist._modelObjectsByUUID).length, 2);

                scope.persist.containsModelObjectWithUUID(shape2.uuid, function(err, result) {
                    assert.ifError(err);
                    assert.equal(result, false);
                    nextCallback();
                });
            }

        ], function(err) {
            sandbox.restore();
            assert.ifError(err);
            assert.end();
        });
    });

    test(thing('should clear the orphaned model objects after they are removed'), function t(assert) {
        var scope = new Scope({name: 'TestScope'});
        var canvas = new Canvas();
        var shape1 = new Shape();
        var shape2 = new Shape();
        canvas.shapes = [shape1, shape2];

        var sandbox = sinon.sandbox.create();
        var removeModelObjectSpy = sandbox.spy(scope, 'removeModelObject');

        async.series([
            function setRoot(nextCallback) {
                scope.setRoot(canvas, nextCallback);
            },

            function applyChangeToRemoveSecondShape(nextCallback) {
                var change = new SyncFragment({
                    type: 'change',
                    clsName: 'Canvas',
                    uuid: canvas.uuid,
                    properties: {
                        shapes: [shape2.uuid]
                    }
                });

                scope.applySyncFragments([change], nextCallback);
            },

            function assertOrphanedModelObjectsClearedAndShape1Removed(nextCallback) {
                assert.equal(Object.keys(scope._orphanedModelObjects).length, 0);

                assert.ok(removeModelObjectSpy.calledOnce);
                assert.ok(removeModelObjectSpy.calledWith(shape1));

                nextCallback();
            }

        ], function(err) {
            sandbox.restore();
            assert.ifError(err);
            assert.end();
        });
    });

});
