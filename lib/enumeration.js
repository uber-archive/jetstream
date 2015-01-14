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

module.exports = Enumeration;

var _ = require('lodash');
var robb = require('robb/src/robb');
var util = require('util');

function Enumeration() {

}

Enumeration.baseType = Enumeration;

Enumeration.isChildClass = function(cls) {
    if (!cls || !cls.baseType) {
        return false;
    }

    return cls.baseType === this.baseType;
};

Enumeration.type = function(name, type, values) {
    // Validate the name, type and values first
    if (typeof name !== 'string') {
        throw new Error('Enumeration type name should be a string');
    }
    this.validateTypeAndValuesOrThrow(type, values);

    // Inherit from Enumeration
    var typeClass = function() {
        Enumeration.apply(this, arguments);
    };
    util.inherits(typeClass, Enumeration);
    typeClass.baseType = Enumeration;
    typeClass.enumerationType = type;
    typeClass.getKeys = Enumeration.getKeys;
    typeClass.getValues = Enumeration.getValues;
    typeClass.keyForValue = Enumeration.keyForValue;
    typeClass._name = name;

    if (type === String) {
        var keysByValue = {};
        values.forEach(function(value) {
            typeClass[value] = value;
            keysByValue[value] = value;
        });
        typeClass._keys = values;
        typeClass._values = values;
        typeClass._keysByValue = keysByValue;
    } else {
        var numberValues = [];
        var keysByValue = {};
        _.each(values, function(value, key) {
            typeClass[key] = value;
            numberValues.push(value);
            keysByValue[value] = key;
        });
        typeClass._keys = Object.keys(values);
        typeClass._values = numberValues;
        typeClass._keysByValue = keysByValue;
    }
    
    return typeClass;
};

Enumeration.getKeys = function() {
    return this._keys;
};

Enumeration.getValues = function() {
    return this._values;
};

Enumeration.keyForValue = function(value) {
    if (_.has(this._keysByValue, value)) {
        return this._keysByValue[value];
    } else {
        return undefined;
    }
};

Enumeration.validateTypeAndValuesOrThrow = function(type, values) {
    if (type !== String && type !== Number) {
        throw new Error('Enumeration type must be string or number');
    }

    if (type === String) {
        // If string must be a flat array of strings
        if (!Array.isArray(values)) {
            throw new Error('String enumeration values must be array of strings');
        }
        if (values.length < 1) {
            throw new Error('String enumeration values must non-empty array of strings');
        }
        values.forEach(function(value) {
            if (typeof value !== 'string') {
                throw new Error('String enumeration values must be array of strings');
            }
        });
    } else {
        // If number must be a map of string to integers
        if (Object.keys(values).length < 1) {
            throw new Error('Number enumeration values must non-empty map of string to integers');
        }
        _.each(values, function(value, key) {
            if (typeof key !== 'string') {
                throw new Error('Number enumeration values must be map of string to integers');
            }
            if (!robb.isInt(value)) {
                throw new Error('Number enumeration values must be map of string to integers');
            }
        });
    }
};
