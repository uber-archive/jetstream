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

var createTestContext = require('../test/test_context');
var ScopeSyncMessage = require('../../lib/message/scope_sync_message');
var test = require('redtape')();

var context = createTestContext('ScopeSyncMessage');
var describe = context.describe;
var method = context.method;

describe(method('constructor'), 'when constructing', function(thing) {

    test(thing('should throw on setting non-unsigned int for scopeIndex'), function t(assert) {
        var message;
        assert.throws(function() {
            message = new ScopeSyncMessage({index: 2, scopeIndex: -1});
        }, /Invalid scopeIndex/);
        assert.end();
    });

    test(thing('should throw on setting non-array for syncFragments'), function t(assert) {
        var message;
        assert.throws(function() {
            message = new ScopeSyncMessage({index: 2, scopeIndex: 1, syncFragments: true});
        }, /Invalid syncFragments/);
        assert.end();
    });

    test(thing('should throw on setting non-boolean for atomic'), function t(assert) {
        var message;
        assert.throws(function() {
            message = new ScopeSyncMessage({
                index: 2, 
                scopeIndex: 1, 
                syncFragments: [],
                atomic: 'yes'
            });
        }, /Invalid atomic/);
        assert.end();
    });

    test(thing('should throw on setting non-string for procedure'), function t(assert) {
        var message;
        assert.throws(function() {
            message = new ScopeSyncMessage({
                index: 2, 
                scopeIndex: 1, 
                syncFragments: [],
                procedure: true
            });
        }, /Invalid procedure/);
        assert.end();
    });

    test(thing('should throw on setting procedure with atomic false'), function t(assert) {
        var message;
        assert.throws(function() {
            message = new ScopeSyncMessage({
                index: 2, 
                scopeIndex: 1, 
                syncFragments: [],
                procedure: 'Model.procedure'
            });
        }, /requires to be atomic/);
        assert.end();
    });


    test(thing('should throw on setting procedure with bad format'), function t(assert) {
        var message;
        assert.throws(function() {
            message = new ScopeSyncMessage({
                index: 2, 
                scopeIndex: 1, 
                syncFragments: [],
                atomic: true,
                procedure: 'ModelProcedure'
            });
        }, /must be of the format "ModelName.procedureName"/);
        assert.end();
    });

});

describe(method('parseAsJSON'), 'when parsing from JSON', function(thing) {

    test(thing('should callback error with non-truthy JSON'), function t(assert) {
        ScopeSyncMessage.parseAsJSON(undefined, function(err){
            assert.ok(err);
            assert.end();
        });
    });

    test(thing('should callback error with invalid type'), function t(assert) {
        ScopeSyncMessage.parseAsJSON({type: 'invalidType'}, function(err){
            assert.ok(err);
            assert.end();
        });
    });

    test(thing('should callback error with invalid JSON'), function t(assert) {
        ScopeSyncMessage.parseAsJSON({type: 'ScopeSync'}, function(err){
            assert.ok(err);
            assert.end();
        });
    });

    test(thing('should callback error with invalid JSON with fragments'), function t(assert) {
        ScopeSyncMessage.parseAsJSON({type: 'ScopeSync', fragments: []}, function(err){
            assert.ok(err);
            assert.end();
        });
    });

    test(thing('should callback result with valid JSON'), function t(assert) {
        ScopeSyncMessage.parseAsJSON({
            type: 'ScopeSync', 
            index: 2,
            scopeIndex: 0,
            fragments: [
                {
                    type: 'add',
                    uuid: 'uuid',
                    clsName: 'clsName'
                }
            ]
        }, function(err, message){
            assert.ifError(err);
            assert.ok(message);
            assert.end();
        });
    });

});

describe(method('toJSON'), 'when creating JSON', function(thing) {

    test(thing('should create JSON with procedure'), function t(assert) {
        var message = new ScopeSyncMessage({
            index: 2,
            scopeIndex: 0,
            syncFragments: [
                {
                    type: 'add',
                    uuid: 'uuid',
                    clsName: 'clsName'
                }
            ],
            atomic: true,
            procedure: 'Model.procedure'
        });
        assert.deepEqual(message.toJSON(), {
            type: 'ScopeSync',
            index: 2,
            scopeIndex: 0,
            fragments: [
                {
                    type: 'add',
                    uuid: 'uuid',
                    clsName: 'clsName'
                }
            ],
            atomic: true,
            procedure: 'Model.procedure'
        });
        assert.end();
    });

});
