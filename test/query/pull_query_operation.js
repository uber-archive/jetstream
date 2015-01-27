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
var createTestChatRoom = require('../test/test_helpers').createTestChatRoom;
var createTestContext = require('../test/test_context');
var createTestMessage = require('../test/test_helpers').createTestMessage;
var createTestUser = require('../test/test_helpers').createTestUser;
var Scope = require('../../lib/scope');
var test = require('redtape')();

var context = createTestContext('PullQueryOperation');
var describe = context.describe;
var method = context.method;

describe(method('execute'), 'when executing updates', function(thing) {

    test(thing('should be able to perform simple pull'), function t(assert) {
        var room = createTestChatRoom();

        var testAuthor = createTestUser();
        testAuthor.username = 'PullQueryTestUser';
        room.users = [testAuthor];

        // Set messages to contain just a single message first
        var testExistingMessage = createTestMessage();
        room.messages = [testExistingMessage];

        async.waterfall([
            function setRoot(nextCallback) {
                var scope = new Scope({name: 'ChatRoomScope'});
                scope.setRoot(room, function(err) {
                    nextCallback(err, scope);
                });
            },

            function executeUpdate(scope, nextCallback) {
                scope.update({}, {
                    $pull: {
                        messages: {
                            $uuid: testExistingMessage.uuid
                        }
                    }
                }, nextCallback);
            },

            function verifyQueryResult(result, nextCallback) {
                assert.equal(room.messages.length, 0);

                assert.equal(result.matched.length, 1);
                assert.equal(result.matched[0].uuid, room.uuid);
                assert.equal(result.matched[0].clsName, room.typeName);

                assert.equal(result.created.length, 0);

                assert.equal(result.modified.length, 1);
                assert.equal(result.modified[0].uuid, room.uuid);
                assert.equal(result.modified[0].clsName, room.typeName);

                nextCallback();
            }

        ], function(err) {
            assert.ifError(err);
            assert.end();
        });
    });

});
