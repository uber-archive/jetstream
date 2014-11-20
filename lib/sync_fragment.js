//
// sync_fragment.js
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

module.exports = SyncFragment;

var _ = require('lodash');

var CONST = {};
CONST.TYPE_ROOT = 'root';
CONST.TYPE_ADD = 'add';
CONST.TYPE_CHANGE = 'change';
CONST.TYPE_REMOVE = 'remove';
CONST.TYPE_MOVECHANGE = 'movechange';
CONST.TYPES = Object.freeze([
    CONST.TYPE_ROOT,
    CONST.TYPE_ADD,
    CONST.TYPE_CHANGE,
    CONST.TYPE_REMOVE,
    CONST.TYPE_MOVECHANGE
]);
CONST.ALLOWED_VALUE_TYPES = Object.freeze([
    'string',
    'number',
    'boolean'
]);
CONST = Object.freeze(CONST);

function SyncFragment(options) {
    options = options || {};

    if (CONST.TYPES.indexOf(options.type) === -1) {
        throw new Error('Invalid type');
    }

    if (typeof options.uuid !== 'string' && !options.modelObject) {
        throw new Error('Requires uuid or modelObject');
    }

    this.type = options.type;
    if (options.modelObject) {
        this.objectUUID = options.modelObject.uuid.toLowerCase();
    } else {
        this.objectUUID = options.uuid.toLowerCase();
    }
    if (options.modelObject) {
        this.clsName = options.modelObject.typeName;
    } else {
        this.clsName = options.clsName ? options.clsName : null;
    }
    if (options.properties) {
        this._setProperties(options.properties);
    } else {
        this.properties = null;
    }
}

SyncFragment.CONST = CONST;

SyncFragment.prototype._getValidTypeOrThrow = function(key, value) {
    var valueTypeIndex = CONST.ALLOWED_VALUE_TYPES.indexOf(typeof value);
    var allowedValueType = valueTypeIndex !== -1;
    var isArray = value instanceof Array;
    var isDate = value instanceof Date;
    if (!allowedValueType && !isArray && !isDate && value !== null) {
        var allowed = CONST.ALLOWED_VALUE_TYPES.join(', ') + ', array, date, null';
        throw new Error('Property \'' + key + '\' not a ' + allowed);
    }
    if (isArray) {
        return 'array';
    } else if (isDate) {
        return 'date';
    } else if (value === null) {
        return 'null';
    } else {
        return CONST.ALLOWED_VALUE_TYPES[valueTypeIndex];
    }
};

SyncFragment.prototype._setProperties = function(properties) {
    if (typeof properties !== 'object') {
        throw new Error('Requires properties');
    }

    var props = {};
    _.each(properties, function(value, key) {
        if (typeof key !== 'string') {
            throw new Error('Property key not a string');
        }
        var valueType = this._getValidTypeOrThrow(key, value);
        if (valueType === 'array') {
            var firstElementValueType = null;
            _.each(value, function(element) {
                var elementValueType = this._getValidTypeOrThrow(key, element);
                if (elementValueType === 'array') {
                    throw new Error(
                        'Property \'' + key + '\' cannot have arrays in an array');
                }
                if (!firstElementValueType) {
                    firstElementValueType = elementValueType;
                } else if (firstElementValueType !== elementValueType) {
                    throw new Error(
                        'Property \'' + key + '\' not all array value types match');
                }
            }.bind(this));
            props[key] = value;
        } else if (valueType === 'date') {
            // Always send dates as timestamps for faster parsing
            props[key] = value.getTime();
        } else {
            props[key] = value;
        }
    }.bind(this));

    this.properties = props;
};

SyncFragment.prototype.toJSON = function() {
    var json = {
        type: this.type,
        uuid: this.objectUUID
    };
    if (this.clsName) {
        json.clsName = this.clsName;
    }
    if (this.properties) {
        json.properties = this.properties;
    }
    return json;
};
