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

var async = require('async');
var Canvas = require('../demos/shapes').Canvas;
var createTestChatRoom = require('./test/test_helpers').createTestChatRoom;
var createTestContext = require('./test/test_context');
var ModelObject = require('../lib/model_object');
var redtape = require('redtape');
var Scope = require('../lib/scope');
var Shape = require('../demos/shapes').Shape;
var sinon = require('sinon');
var SyncFragment = require('../lib/sync_fragment');
var uuid = require('node-uuid');

var context = createTestContext('Scope');
var describe = context.describe;
var method = context.method;

var sandbox;
var test = redtape({
    beforeEach: function(callback) {
        sandbox = sinon.sandbox.create();
        callback();
    },
    afterEach: function(callback) {
        sandbox.restore();
        callback();
    }
});

describe(method('applySyncFragments'), 'when removing orphaned objects', function(thing) {

    test(thing('should remove any model objects that have no parents'), function t(assert) {
        var scope = new Scope({name: 'TestScope'});
        var canvas = new Canvas();
        var shape1 = new Shape();
        var shape2 = new Shape();
        canvas.shapes = [shape1, shape2];

        var memoryPersist = scope.persist;
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
            assert.ifError(err);
            assert.end();
        });
    });

    test(thing('should clear the newly orphaned model objects after orphans are removed'), function t(assert) {
        var scope = new Scope({name: 'TestScope'});

        var TestModel = ModelObject.model('TestModel', function() {
            this.has('children', [this]);
        });

        var root = new TestModel();
        var child = new TestModel();
        var grandchild1 = new TestModel();
        var grandchild2 = new TestModel();

        // Build circular graph:
        //      o
        //       \
        //        o
        //       / \
        //      o---o
        root.children = [child];
        child.children = [grandchild1, grandchild2];
        grandchild1.children = [grandchild2];

        var removeModelObjectSpy = sandbox.spy(scope, 'removeModelObject');

        async.series([
            function setRoot(nextCallback) {
                scope.setRoot(root, nextCallback);
            },

            function getAllModelObjects(nextCallback) {
                assert.equal(scope.persist._modelObjects.length, 4);
                nextCallback();
            },

            function applyChangeToRemoveChild(nextCallback) {
                var change = new SyncFragment({
                    type: 'change',
                    clsName: 'TestModel',
                    uuid: root.uuid,
                    properties: {
                        children: []
                    }
                });

                scope.applySyncFragments([change], nextCallback);
            },

            function getAllModelObjects(nextCallback) {
                assert.equal(scope.persist._modelObjects.length, 1);
                nextCallback();
            },

            function assertOrphanedModelObjectsClearedAndShape1Removed(nextCallback) {
                assert.equal(Object.keys(scope._orphanedModelObjects).length, 0);

                assert.equal(removeModelObjectSpy.callCount, 3);

                nextCallback();
            }

        ], function(err) {
            assert.ifError(err);
            assert.end();
        });
    });

    test(thing('should apply procedure updates on success'), function t(assert) {
        var chatRoom = createTestChatRoom();

        var newChatRoomName = 'New name';

        var syncFragments = [
            new SyncFragment({
                uuid: chatRoom.uuid,
                type: 'change',
                clsName: 'ChatRoom',
                properties: {
                    name: newChatRoomName
                }
            })
        ];

        var updatedTopicName = 'Room renamed "' + chatRoom.name + '" to "' + newChatRoomName + '"';

        var accessToken = uuid.v4();
        var scope = new Scope({name: 'TestScope', params: {accessToken: accessToken}});

        var procedure = chatRoom.getProcedure('setName');
        assert.ok(procedure);
        sandbox.stub(procedure, 'httpClient', mockHttpClient);

        function mockHttpClient(options, callback) {
            assert.equal(options.url, 'http://chatRoomAPI/room/' + chatRoom.uuid);

            assert.equal(options.method, 'POST');

            assert.deepEqual(options.headers, {
                'Content-Type': 'application/json',
                'Authorization': scope.params.accessToken,
                'X-ChatRoom-SetName': newChatRoomName
            });

            assert.equal(options.json, undefined);

            var updates = [
                {
                    update: {
                        $set: {
                            'attributes.topic': updatedTopicName
                        }
                    }
                }
            ];

            callback(null, {statusCode: 200}, {_updates: updates});
        }

        async.series([
            function setRoot(nextCallback) {
                scope.setRoot(chatRoom, function(err) {
                    assert.ifError(err);
                    nextCallback();
                });
            },

            function applyChangeToRemoveSecondShape(nextCallback) {
                var options = {procedure: 'ChatRoom.setName'};
                scope.applySyncFragments(syncFragments, options, nextCallback);
            },

            function assertUpdatesApplied(nextCallback) {
                assert.equal(chatRoom.attributes.topic, updatedTopicName);
                nextCallback();
            }

        ], function(err) {
            assert.ifError(err);
            assert.end();
        });
    });

});
