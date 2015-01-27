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

module.exports = SyncFragment;

var _ = require('lodash');
var async = require('async');
var Err = require('rust-result').Err;
var Ok = require('rust-result').Ok;

var CONST = {};
CONST.TYPE_ADD = 'add';
CONST.TYPE_CHANGE = 'change';
CONST.TYPES = Object.freeze([
    CONST.TYPE_ADD,
    CONST.TYPE_CHANGE
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

    if (typeof options.clsName !== 'string' && !options.modelObject) {
        throw new Error('Requires clsName or modelObject');
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
        this.clsName = options.clsName;
    }
    if (options.properties) {
        this.setPropertiesOrThrow(options.properties);
    } else {
        this.properties = null;
    }
}

SyncFragment.CONST = CONST;

SyncFragment.syncFragmentResult = function(syncFragmentError) {
    var result = {};
    if (syncFragmentError) {
        result.error = {message: syncFragmentError.message};
        if (syncFragmentError.type) {
            result.error.type = syncFragmentError.type;
        }
    }
    return result;
};

SyncFragment.toIncoming = function(syncFragments) {
    var incoming = {};
    syncFragments.forEach(function(syncFragment) {
        incoming[syncFragment.clsName + '.' + syncFragment.type] = syncFragment;
    });
    return incoming;
};

SyncFragment.prototype.setPropertiesOrThrow = function(properties) {
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

SyncFragment.prototype._getValidTypeOrThrow = function(key, value) {
    var valueTypeIndex = CONST.ALLOWED_VALUE_TYPES.indexOf(typeof value);
    var allowedValueType = valueTypeIndex !== -1;
    var isArray = Array.isArray(value);
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

SyncFragment.prototype.verifyPropertiesForType = function(typeClass, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    options = _.extend({
        checkModelObjectsExist: {
            scope: null,
            lookup: null
        }
    }, options);

    async.mapSeries(Object.keys(this.properties), function(key, doneCallback) {
        var value = this.properties[key];

        var property = typeClass.getProperty(key);
        if (!property) {
            return doneCallback(new Error('No property at \'' + key + '\''));
        }

        if (!property.isModelObjectType) {
            if (property.isCollectionType && !Array.isArray(value)) {
                return doneCallback(new Error('Collection type without array value at \'' + key + '\''));
            } else if (property.isCollectionType) {
                return async.map(value, function(element, collectionDoneCallback) {
                    var result;
                    if (property.isEnumerationType) {
                        result = this._verifyFragmentEnumerationProperty(property, element);
                    } else {
                        result = this._verifyFragmentValueProperty(property, element);
                    }
                    collectionDoneCallback(Err(result));
                }.bind(this), doneCallback);
            } else if (property.isEnumerationType) {
                var enumerationValueResult = this._verifyFragmentEnumerationProperty(property, value);
                return doneCallback(Err(enumerationValueResult));
            } else {
                var fragmentValueResult = this._verifyFragmentValueProperty(property, value);
                return doneCallback(Err(fragmentValueResult));
            }
        } else {
            // Before verifying ensure we lowercase all UUIDs present
            if (typeof value === 'string') {
                this.properties[key] = value = value.toLowerCase();
            } else if (Array.isArray(value)) {
                this.properties[key] = value = _.map(value, function(element) {
                    if (typeof element === 'string') {
                        return element.toLowerCase();
                    }
                    return element;
                });
            }
            return this._verifyFragmentModelObjectProperty(property, value, options, doneCallback);
        }
    }.bind(this), callback);
};

SyncFragment.prototype._verifyFragmentValueProperty = function(property, value, callback) {
    var validNumber = property.singleType === Number &&
        typeof value === 'number' && 
        !isNaN(value);
    var validString = property.singleType === String &&
        typeof value === 'string';
    var validBoolean = property.singleType === Boolean &&
        typeof value === 'boolean';
    var validDate = property.singleType === Date && 
        !isNaN(new Date(value).getTime());
    var validNull = 
        (property.isModelObjectType && !property.isCollectionType && value === null) || 
        (!property.isModelObjectType && value === null);

    if (!validNumber && !validString && !validBoolean && !validDate && !validNull) {
        return Err(new Error(
            'Not valid type at \'' + property.name + 
            '\', should be ' + property.singleType.name));
    }
    return Ok();
};

SyncFragment.prototype._verifyFragmentEnumerationProperty = function(property, value, callback) {
    var validValues = property.singleType.getValues();
    if (validValues.indexOf(value) === -1) {
        return Err(new Error(
            'Not valid type at \'' + property.name + 
            '\', should be one of ' + JSON.stringify(validValues)));
    }
    return Ok();
};

SyncFragment.prototype._verifyFragmentModelObjectProperty = function(property, value, options, callback) {
    var scope = options.checkModelObjectsExist.scope;
    var modelObjectLookup = options.checkModelObjectsExist.lookup;
    var checkModelObjectsExist = Boolean(scope) || Boolean(modelObjectLookup);

    if (property.isCollectionType) {
        if (!Array.isArray(value)) {
            return callback(new Error(
                'Not valid type at \'' + property.name + '\', should be array of UUIDs'));
        }
        var err;
        _.each(value, function(uuid) {
            if (!uuid || typeof uuid !== 'string') {
                err = new Error(
                    'Not valid type at \'' + property.name + '\', should be array of UUIDs');
                return false;
            }
        });
        if (err) {
            return callback(err);
        }
        if (!checkModelObjectsExist) {
            return callback();
        }

        var notFoundUUIDs = value;
        if (modelObjectLookup) {
            notFoundUUIDs = _.filter(notFoundUUIDs, function(uuid) {
                return !modelObjectLookup.hasOwnProperty(uuid);
            });
        }

        if (notFoundUUIDs.length < 1) {
            return callback();
        } else if (!scope) {
            var notFound = JSON.stringify(notFoundUUIDs);
            return callback(new Error(
                'No such ModelObjects ' + notFound  + ' at \'' + property.name + '\''));
        }

        async.mapSeries(notFoundUUIDs, function(uuid, nextCallback) {
            scope.persist.containsModelObjectWithUUID(uuid, function(err, result) {
                if (err) {
                    return nextCallback(err);
                }
                if (!result) {
                    return nextCallback(null, uuid);
                }
                nextCallback(null, true);
            });

        }.bind(this), function(err, results) {
            if (err) {
                return callback(err);
            }

            var notInScopeUUIDs = _.filter(results, function(result) {
                return result !== true;
            });
            if (notInScopeUUIDs.length > 0) {
                var notFound = JSON.stringify(notInScopeUUIDs);
                return callback(new Error(
                    'No such ModelObjects \'' + notFound + '\' at \'' + property.name + '\''));
            }
            callback();
        });
    } else {
        if (value === null) {
            return callback();
        }
        if (typeof value !== 'string') {
            return callback(new Error(
                'Cannot set property at \'' + property.name + '\' as non-UUID'));
        }
        if (!checkModelObjectsExist) {
            return callback();
        }

        if (modelObjectLookup && modelObjectLookup.hasOwnProperty(value)) {
            return callback();
        }

        if (!scope) {
            return callback(new Error(
                'No such ModelObject \'' + value + '\' at \'' + property.name + '\''));
        }

        scope.persist.containsModelObjectWithUUID(value, function(err, result) {
            if (err || !result) {
                err = err || new Error(
                    'No such ModelObject \'' + value + '\' at \'' + property.name + '\'');
                return callback(err);
            }
            callback();
        });
    }
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
