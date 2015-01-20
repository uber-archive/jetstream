//
// json_reader.js
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
'use strict';

var createTestContext = require('./test/test_context');
var JSONReader = require('../lib/message/json_reader');
var test = require('redtape')();
var underscore = require('underscore');

var context = createTestContext('JSONReader');
var describe = context.describe;
var method = context.method;

describe(method('read'), 'when reading JSON', function(thing) {

    test(thing('should read and parse JSON passed as Buffer'), function t(assert) {
        var json = {a: 1};
        var predicate = underscore.matches(json);
        var input = new Buffer(JSON.stringify(json));
        JSONReader.read(input, function(err, result) {
            assert.ifError(err);
            assert.equal(predicate(result), true);
            assert.end();
        });
    });

    test(thing('should read and parse JSON passed as string'), function t(assert) {
        var json = {a: 1};
        var predicate = underscore.matches(json);
        var input = JSON.stringify(json);
        JSONReader.read(input, function(err, result) {
            assert.ifError(err);
            assert.equal(predicate(result), true);
            assert.end();
        });
    });

    test(thing('should read and parse JSON passed as JSON'), function t(assert) {
        var json = {a: 1};
        var predicate = underscore.matches(json);
        JSONReader.read(json, function(err, result) {
            assert.ifError(err);
            assert.equal(predicate(result), true);
            assert.end();
        });
    });

    test(thing('should callback with error for non-JSON string'), function t(assert) {
        JSONReader.read('bah-humbug', function(err, result) {
            assert.ok(err);
            assert.notOk(result);
            assert.end();
        });
    });

    test(thing('should callback with error for no input'), function t(assert) {
        JSONReader.read(null, function(err, result) {
            assert.ok(err);
            assert.notOk(result);
            assert.end();
        });
    });

    test(thing('should callback with error for unrecognized input'), function t(assert) {
        JSONReader.read(123, function(err, result) {
            assert.ok(err);
            assert.notOk(result);
            assert.end();
        });
    });

});
