//
// enumeration.js
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
var createTestContext = require('./test/test_context');
var Enumeration = require('../lib/enumeration');
var test = require('redtape')();

var context = createTestContext('Enumeration');
var describe = context.describe;
var method = context.method;

describe(method('type'), 'when defining an enumeration', function(thing) {

    test(thing('should be able to define strings enumeration'), function t(assert) {
        var Status = Enumeration.type('Status', String, ['Inactive', 'Active']);
        assert.equal(Status.Inactive, 'Inactive');
        assert.equal(Status.Active, 'Active');
        assert.deepEqual(Status.getKeys(), ['Inactive', 'Active']);
        assert.deepEqual(Status.getValues(), ['Inactive', 'Active']);
        assert.end();
    });

    test(thing('should be able to define number enumeration'), function t(assert) {
        var Status = Enumeration.type('Status', Number, {
            'Inactive': 0, 
            'Active': 1
        });
        assert.equal(Status.Inactive, 0);
        assert.equal(Status.Active, 1);
        assert.deepEqual(Status.getKeys(), ['Inactive', 'Active']);
        assert.deepEqual(Status.getValues(), [0, 1]);
        assert.end();
    });

    test(thing('should throw when name not given'), function t(assert) {
        assert.throws(function() {
            Enumeration.type(undefined, Number, {});
        }, /type name/);
        assert.end();
    });

    test(thing('should throw when type not string or number'), function t(assert) {
        assert.throws(function() {
            Enumeration.type('SomeEnum', Date, {});
        }, /type must be string or number/);
        assert.throws(function() {
            Enumeration.type('SomeEnum', undefined, {});
        }, /type must be string or number/);
        assert.end();
    });

    test(thing('should throw when string and values not an array'), function t(assert) {
        assert.throws(function() {
            Enumeration.type('SomeEnum', String, {});
        }, /values must be array of strings/);
        assert.end();
    });

    test(thing('should throw when string and values empty'), function t(assert) {
        assert.throws(function() {
            Enumeration.type('SomeEnum', String, []);
        }, /values must non-empty array of strings/);
        assert.end();
    });

    test(thing('should throw when string and values not all strings'), function t(assert) {
        assert.throws(function() {
            Enumeration.type('SomeEnum', String, ['abc', 123]);
        }, /values must be array of strings/);
        assert.end();
    });

    test(thing('should throw when number and values empty'), function t(assert) {
        assert.throws(function() {
            Enumeration.type('SomeEnum', Number, {});
        }, /values must non-empty map of string to integers/);
        assert.end();
    });

    test(thing('should throw when number and key values not all strings'), function t(assert) {
        assert.throws(function() {
            var values = {'Abc': 0};
            values[3.14] = 'Pi';
            Enumeration.type('SomeEnum', Number, values);
        }, /values must be map of string to integers/);
        assert.end();
    });

    test(thing('should throw when number and values not all numbers'), function t(assert) {
        assert.throws(function() {
            Enumeration.type('SomeEnum', Number, {'Abc': 0, 'Def': 'Ghi'});
        }, /values must be map of string to integers/);
        assert.end();
    });

});
