//
// model_object_property.js
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

module.exports = ModelObjectProperty;

var _ = require('lodash');
var Enumeration = require('./enumeration');
var ModelObject = require('./model_object');

function ModelObjectProperty(options) {
    options = options || {};

    if (typeof options.name !== 'string') {
        throw new Error('Invalid property name');
    }

    this._setType(options.type);

    this.name = options.name;
    this.key = '_' + options.name;
    this.isCollectionType = this.type instanceof Array;
    this.singleType = this.isCollectionType ? this.type[0] : this.type;
    this.isModelObjectType = ModelObjectProperty.isModelObjectType(this.singleType);
    this.isEnumerationType = ModelObjectProperty.isEnumerationType(this.singleType);
    this.defaultValue = null;

    if (_.has(options, 'defaultValue')) {
        this.defaultValue = ModelObjectProperty.filterValueForPropertyOrThrow(options.defaultValue, this);
    }
}

ModelObjectProperty.isValidSingleType = function(type) {
    return type === String || 
        type === Number || 
        type === Boolean || 
        type === Date || 
        this.isModelObjectType(type) ||
        this.isEnumerationType(type);
};

ModelObjectProperty.isModelObjectType = function(type) {
    return ModelObject.isChildClass(type);
};

ModelObjectProperty.isEnumerationType = function(type) {
    return Enumeration.isChildClass(type);
};

ModelObjectProperty.filterValueForPropertyOrThrow = function(newValue, property) {
    var propertyType = property.singleType;
    var modelObjectType = property.isModelObjectType;
    var enumerationType = property.isEnumerationType;

    if (newValue !== null && newValue !== undefined) {
        if (propertyType === Number) {
            newValue = Number(newValue);
            if (isNaN(newValue)) {
                throw new Error(
                    'Bad number value setting property \'' + property.name + '\'');
            }
        } else if (propertyType === String) {
            newValue = String(newValue);
        } else if (propertyType === Boolean) {
            newValue = Boolean(newValue);
        } else if (propertyType === Date) {
            var date = newValue instanceof Date ? newValue : new Date(newValue);
            if (isNaN(date.getTime())) {
                throw new Error(
                    'Bad date value setting property \'' + property.name + '\'');
            } else {
                newValue = date;
            }
        } else if (modelObjectType && newValue instanceof propertyType) {
            // No-op, we store reference directly
            return newValue;
        } else if (enumerationType) {
            if (propertyType.getValues().indexOf(newValue) === -1) {
                throw new Error('Bad enum value for property \'' + property.name + '\'');
            }
            return newValue;
        } else {
            throw new Error(
                'Bad mismatch value setting property \'' + property.name + '\'');
        }
    }

    return newValue;
};

ModelObjectProperty.prototype._setType = function(type) {
    if (type instanceof Array) {
        if (type.length !== 1 || !ModelObjectProperty.isValidSingleType(type[0])) {
            throw new Error('Collection type \'' + type[0] + '\' is not valid');
        }
    } else if (!ModelObjectProperty.isValidSingleType(type)) {
        throw new Error('Type \'' + type + '\' is not valid');
    }

    this.type = type;
};
