//
// key_path_notation.js
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

var createTestContext = require('../test/test_context');
var Err = require('rust-result').Err;
var KeyPathNotation = require('../../lib/query/key_path_notation');
var ModelObject = require('../../lib/model_object');
var Ok = require('rust-result').Ok;
var test = require('redtape')();

var context = createTestContext('KeyPathNotation');
var describe = context.describe;
var method = context.method;

var Leaf = ModelObject.model('Leaf');

var KeyPathTest = ModelObject.model('KeyPathTest', function() {
    this.has('single', this);
    this.has('leaf', Leaf);
    this.has('many', [this]);
    this.has('number', Number);
    this.has('str', String);
});

var DerivedKeyPathTest = ModelObject.model('DerivedKeyPathTest', function() {
    this.inherit(KeyPathTest);
    this.has('base', KeyPathTest);
    this.has('derived', this);
    this.has('date', Date);
});

ModelObject.model('ConflictingDerivedKeyPathTest', function() {
    this.inherit(KeyPathTest);
    this.has('date', Date);
});

describe(method('constructor'), 'when called directly', function(thing) {

    test(thing('should be a function'), function t(assert) {
        assert.equal(typeof KeyPathNotation, 'function');
        assert.doesNotThrow(function() { KeyPathNotation(); });
        assert.end();
    });

});

describe(method('resolveModelObject'), 'when resolving key paths', function(thing) {

    test(thing('should return error result if modelObject not instance of ModelObject'), function t(assert) {
        var result = KeyPathNotation.resolveModelObject(1, '');
        assert.ok(Err(result));
        assert.ok(/Requires modelObject/.test(Err(result).message));
        assert.end();
    });

    test(thing('should return modelObject with empty keyPath'), function t(assert) {
        var leaf = new Leaf();
        var result = KeyPathNotation.resolveModelObject(leaf, '');
        assert.equal(Ok(result), leaf);
        assert.end();
    });

    test(thing('should support simple property of property access'), function t(assert) {
        var t1 = new KeyPathTest();
        t1.single = new KeyPathTest();
        t1.single.leaf = new Leaf();

        var result = KeyPathNotation.resolveModelObject(t1, 'single.leaf');
        assert.ifError(Err(result));
        assert.equal(Ok(result), t1.single.leaf);
        assert.end();
    });

    test(thing('should support simple array property access'), function t(assert) {
        var t1 = new KeyPathTest();
        var child1 = new KeyPathTest();
        var child2 = new KeyPathTest();

        t1.many = [child1, child2];
        child1.leaf = new Leaf();
        child2.single = new KeyPathTest();
        child2.single.leaf = new Leaf();

        var result = KeyPathNotation.resolveModelObject(t1, 'many.0.leaf');
        assert.equal(Ok(result), child1.leaf);

        result = KeyPathNotation.resolveModelObject(t1, 'many[1]');
        assert.equal(Ok(result), child2);

        result = KeyPathNotation.resolveModelObject(t1, 'many[1].single.leaf');
        assert.equal(Ok(result), child2.single.leaf);

        assert.end();
    });

    test(thing('should support traversing derived ModelObject properties'), function t(assert) {
        var t1 = new KeyPathTest();
        t1.single = new DerivedKeyPathTest();
        t1.single.derived = new DerivedKeyPathTest();
        t1.single.derived.single = t1;

        var result = KeyPathNotation.resolveModelObject(t1, 'single.derived.single');
        assert.equal(Ok(result), t1);

        assert.end();
    });

    test(thing('should return error result for missing key path'), function t(assert) {
        var t1 = new KeyPathTest();

        var result = KeyPathNotation.resolveModelObject(t1, 'missing');
        assert.ok(Err(result));
        assert.ok(/No property/.test(Err(result).message));

        assert.end();
    });

    test(thing('should return error result for non-ModelObject property'), function t(assert) {
        var t1 = new KeyPathTest();
        t1.single = new KeyPathTest();

        var result = KeyPathNotation.resolveModelObject(t1, 'single.number');
        assert.ok(Err(result));
        assert.ok(/not a ModelObject property/.test(Err(result).message));

        assert.end();
    });

    test(thing('should return error result for missing array index with array key path'), function t(assert) {
        var t1 = new KeyPathTest();
        var child1 = new KeyPathTest();
        var child2 = new KeyPathTest();

        t1.many = [child1, child2];
        child1.single = new KeyPathTest();

        var result = KeyPathNotation.resolveModelObject(t1, 'many.single');
        assert.ok(Err(result));
        assert.ok(/No index found/.test(Err(result).message));

        result = KeyPathNotation.resolveModelObject(t1, 'many');
        assert.ok(Err(result));
        assert.ok(/No index found/.test(Err(result).message));

        assert.end();
    });

    test(thing('should return error result for array index with no element present'), function t(assert) {
        var t1 = new KeyPathTest();
        var child1 = new KeyPathTest();
        var child2 = new KeyPathTest();
        t1.many = [child1, child2];

        var result = KeyPathNotation.resolveModelObject(t1, 'many.0');
        assert.equal(Ok(result), child1);

        result = KeyPathNotation.resolveModelObject(t1, 'many[2]');
        assert.ok(Err(result));
        assert.ok(/No ModelObject instance at index/.test(Err(result).message));

        assert.end();
    });

    test(thing('should return error result when no ModelObject instance at key path'), function t(assert) {
        var t1 = new KeyPathTest();
        t1.single = new KeyPathTest();

        var result = KeyPathNotation.resolveModelObject(t1, 'single.leaf');
        assert.ok(Err(result));
        assert.ok(/No ModelObject instance on property/.test(Err(result).message));

        assert.end();
    });

});

describe(method('resolveProperty'), 'when resolving key paths', function(thing) {

    test(thing('should return error result if typeClass not derived from ModelObject'), function t(assert) {
        var result = KeyPathNotation.resolveProperty(1);
        assert.ok(Err(result));
        assert.ok(/Requires typeClass to derive from ModelObject/.test(Err(result).message));

        function AnObject(){}
        result = KeyPathNotation.resolveProperty(AnObject);
        assert.ok(Err(result));
        assert.ok(/Requires typeClass to derive from ModelObject/.test(Err(result).message));

        assert.end();
    });

    test(thing('should support simple property access'), function t(assert) {
        var result = KeyPathNotation.resolveProperty(KeyPathTest, 'number');
        assert.ifError(Err(result));

        result = Ok(result);
        assert.equal(result.property, KeyPathTest.getProperty('number'));
        assert.equal(result.property.singleType, Number);
        assert.equal(result.ownerTypeClass, KeyPathTest);
        assert.equal(result.ownerKeyPath, '');

        assert.end();
    });

    test(thing('should support simple property of property access'), function t(assert) {
        var result = KeyPathNotation.resolveProperty(KeyPathTest, 'single.leaf');
        assert.ifError(Err(result));

        result = Ok(result);
        assert.equal(result.property, KeyPathTest.getProperty('leaf'));
        assert.equal(result.property.singleType, Leaf);
        assert.equal(result.ownerTypeClass, KeyPathTest);
        assert.equal(result.ownerKeyPath, 'single');

        assert.end();
    });

    test(thing('should support simple array property access'), function t(assert) {
        // Really simple test first
        var result = KeyPathNotation.resolveProperty(KeyPathTest, 'many[1]');
        assert.ifError(Err(result));

        result = Ok(result);
        assert.equal(result.property, KeyPathTest.getProperty('many'));
        assert.equal(result.property.singleType, KeyPathTest);
        assert.equal(result.ownerTypeClass, KeyPathTest);
        assert.equal(result.ownerKeyPath, '');

        // Slightly more complex
        result = KeyPathNotation.resolveProperty(KeyPathTest, 'single.many.0.leaf');
        assert.ifError(Err(result));

        result = Ok(result);
        assert.equal(result.property, KeyPathTest.getProperty('leaf'));
        assert.equal(result.property.singleType, Leaf);
        assert.equal(result.ownerTypeClass, KeyPathTest);
        assert.equal(result.ownerKeyPath, 'single.many.0');

        assert.end();
    });

    test(thing('should support traversing derived ModelObject properties'), function t(assert) {
        var result = KeyPathNotation.resolveProperty(KeyPathTest, 'single.derived.leaf');
        assert.ifError(Err(result));

        result = Ok(result);
        assert.equal(result.property, KeyPathTest.getProperty('leaf'));
        assert.equal(result.property.singleType, Leaf);
        assert.equal(result.ownerTypeClass, DerivedKeyPathTest);
        assert.equal(result.ownerKeyPath, 'single.derived');

        assert.end();
    });

    test(thing('should return error result when accessing ambiguous derived key path'), function t(assert) {
        var result = KeyPathNotation.resolveProperty(KeyPathTest, 'single.date');
        assert.ok(Err(result));
        assert.ok(/is ambiguous/.test(Err(result).message));
        assert.ok(/both declare the same property/.test(Err(result).message));
        assert.ok(/DerivedKeyPathTest/.test(Err(result).message));
        assert.ok(/ConflictingDerivedKeyPathTest/.test(Err(result).message));

        assert.end();
    });

    test(thing('should return error result for missing key path'), function t(assert) {
        var result = KeyPathNotation.resolveProperty(KeyPathTest, 'single.missing');
        assert.ok(Err(result));
        assert.ok(/No property/.test(Err(result).message));

        assert.end();
    });

    test(thing('should return error result for key path extending from a value property'), function t(assert) {
        var result = KeyPathNotation.resolveProperty(KeyPathTest, 'single.number.invalid');
        assert.ok(Err(result));
        assert.ok(/is not a ModelObject property/.test(Err(result).message));

        assert.end();
    });

    test(thing('should return error result for array key path without index'), function t(assert) {
        var result = KeyPathNotation.resolveProperty(KeyPathTest, 'many.single');
        assert.ok(Err(result));
        assert.ok(/No index found/.test(Err(result).message));

        assert.end();
    });

    test(thing('should return correct ownerKeyPath if final keyPath piece is an array dot index'), function t(assert) {
        var result = KeyPathNotation.resolveProperty(KeyPathTest, 'single.many.3');
        assert.ifError(Err(result));

        result = Ok(result);
        assert.equal(result.property, KeyPathTest.getProperty('many'));
        assert.equal(result.property.singleType, KeyPathTest);
        assert.equal(result.ownerTypeClass, KeyPathTest);
        assert.equal(result.ownerKeyPath, 'single');

        assert.end();
    });

});
