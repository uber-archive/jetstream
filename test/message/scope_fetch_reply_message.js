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
var ScopeFetchReplyMessage = require('../../lib/message/scope_fetch_reply_message');
var test = require('redtape')();

var context = createTestContext('ScopeFetchReplyMessage');
var describe = context.describe;
var method = context.method;

describe(method('constructor'), 'when constructing', function(thing) {

    test(thing('should throw on no scopeIndex or error'), function t(assert) {
        var message;
        assert.throws(function() {
            message = new ScopeFetchReplyMessage({index: 2, replyTo: 1});
        }, /Requires scopeIndex or Error/);
        assert.end();
    });

    test(thing('should set scopeIndex with valid scopeIndex'), function t(assert) {
        var message = new ScopeFetchReplyMessage({
            index: 2, 
            replyTo: 1,
            scopeIndex: 0
        });
        assert.equal(message.scopeIndex, 0);
        assert.end();
    });

    test(thing('should set error with valid error'), function t(assert) {
        var err = new Error('An error');
        var message = new ScopeFetchReplyMessage({
            index: 2, 
            replyTo: 1,
            error: err
        });
        assert.equal(message.error, err);
        assert.end();
    });

});

describe(method('parseAsJSON'), 'when parsing from JSON', function(thing) {

    test(thing('should callback error with non-truthy JSON'), function t(assert) {
        ScopeFetchReplyMessage.parseAsJSON(undefined, function(err){
            assert.ok(err);
            assert.end();
        });
    });

    test(thing('should callback error with invalid type'), function t(assert) {
        ScopeFetchReplyMessage.parseAsJSON({type: 'invalidType'}, function(err){
            assert.ok(err);
            assert.end();
        });
    });

    test(thing('should callback error with invalid JSON'), function t(assert) {
        ScopeFetchReplyMessage.parseAsJSON({type: 'ScopeFetchReply'}, function(err){
            assert.ok(err);
            assert.end();
        });
    });

    test(thing('should callback result with valid JSON'), function t(assert) {
        ScopeFetchReplyMessage.parseAsJSON({
            type: 'ScopeFetchReply',
            index: 2, 
            replyTo: 1,
            scopeIndex: 0
        }, function(err, message){
            assert.ifError(err);
            assert.ok(message);
            assert.end();
        });
    });

});

describe(method('toJSON'), 'when creating JSON', function(thing) {

    test(thing('should create JSON with valid scopeIndex'), function t(assert) {
        var message = new ScopeFetchReplyMessage({
            index: 2,
            replyTo: 1,
            scopeIndex: 0
        });
        assert.deepEqual(message.toJSON(), {
            type: 'ScopeFetchReply',
            index: 2,
            replyTo: 1,
            scopeIndex: 0
        });
        assert.end();
    });

    test(thing('should create JSON with valid error'), function t(assert) {
        var message = new ScopeFetchReplyMessage({
            index: 2,
            replyTo: 1,
            error: new Error('An error')
        });
        assert.deepEqual(message.toJSON(), {
            type: 'ScopeFetchReply',
            index: 2,
            replyTo: 1,
            error: {message: 'An error'}
        });
        assert.end();
    });

});
