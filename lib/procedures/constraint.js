//
// constraint.js
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

module.exports = Constraint;

var ArrayPropertyConstraint = require('./array_property_constraint');
var async = require('async');
var HasNewValuePropertyConstraint = require('./has_new_value_property_constraint');
var SyncFragment = require('../sync_fragment');

function Constraint(options) {
    options = options || {};

    if (SyncFragment.CONST.TYPES.indexOf(options.type) === -1) {
        throw new Error('Requires type to be one of: ' + SyncFragment.CONST.TYPES.join(', '));
    }

    if (typeof options.clsName !== 'string') {
        throw new Error('Requires clsName');
    }

    if (options.hasOwnProperty('properties') && typeof options.properties !== 'object') {
        throw new Error('Requires properties as object');
    } else if (!options.hasOwnProperty('properties')) {
        options.properties = {};
    }

    if (options.hasOwnProperty('allowAdditionalProperties') && typeof options.allowAdditionalProperties !== 'boolean') {
        throw new Error('Requires allowAdditionalProperties as boolean');
    } else if (!options.hasOwnProperty('allowAdditionalProperties')) {
        options.allowAdditionalProperties = false;
    }

    this.type = options.type;
    this.clsName = options.clsName;
    this.properties = options.properties;
    this.allowAdditionalProperties = options.allowAdditionalProperties;
    this._propertiesKeys = Object.keys(this.properties);
}

Constraint.matchesAllConstraints = function(scope, constraints, syncFragments, callback) {
    var unmatchedFragments = syncFragments.concat();
    constraints.forEach(function(constraint) {
        unmatchedFragments = unmatchedFragments.filter(function(fragment) {
            return !constraint.matches(scope, constraint);
        });
    });
    return unmatchedFragments.length === 0;
};

Constraint.prototype.matches = function(scope, syncFragment, callback) {
    if (this.type !== syncFragment.type || this.clsName !== syncFragment.clsName) {
        return callback(null, false);
    }

    var fragmentPropertiesKeys = Object.keys(syncFragment.properties);
    if (this._propertiesKeys.length < 1) {
        if (!this.allowAdditionalProperties && fragmentPropertiesKeys.length > 0) {
            // Expecting no properties however there are some
            return callback(null, false);
        } else {
            // Matches as no constraint values to verify
            return callback(null, true);
        }
    }

    if (!this.allowAdditionalProperties && fragmentPropertiesKeys.length !== this._propertiesKeys.length) {
        // Not allowing additional properties, needs to match count.  If other mismatch a property 
        // will be missing from fragment properties and it will be caught by the checking below.
        return callback(null, false);
    }

    var rootTypeClass = scope.getRootModelObjectType();
    if (!rootTypeClass) {
        return callback(null, false);
    }

    var typeClass = rootTypeClass.getSubtypeWithTypeName(this.clsName);
    if (!typeClass) {
        return callback(null, false);
    }

    // This can be lazily loaded in if we need to check current property values
    var existingModelObject;
    function lazilyGetExistingModelObject(attemptedFetchCallback) {
        if (existingModelObject) { 
            return attemptedFetchCallback(null, existingModelObject);
        }
        scope.getModelObjectByUUID(syncFragment.objectUUID, function(err, modelObject) {
            if (err || !modelObject) {
                return attemptedFetchCallback(err || new Error('No such ModelObject'));
            }
            existingModelObject = modelObject;
            attemptedFetchCallback(null, modelObject);
        });
    }

    // Validate all the constraint properties are met
    async.eachSeries(this._propertiesKeys, function(constraintKey, doneCallback) {
        var constraintValue = this.properties[constraintKey];
        var property = typeClass.getProperty(constraintKey);
        if (!property) {
            return doneCallback(new Error('No model property for constraint at \'' + constraintKey + '\''));
        }

        if (!syncFragment.properties.hasOwnProperty(constraintKey)) {
            // Specified a constraint at a key which fragment does not include
            return doneCallback(new Error('No fragment value for constraint at \'' + constraintKey + '\''));
        }

        var value = syncFragment.properties[constraintKey];
        if (constraintValue && constraintValue instanceof HasNewValuePropertyConstraint) {
            // Already verified the value exists on the sync fragment properties
            return doneCallback();
        } else if (constraintValue && constraintValue instanceof ArrayPropertyConstraint) {
            // Apply an array constraint value
            if (!property.isCollectionType()) {
                return doneCallback(new Error(
                    'Array property constraint on non-collection property at \'' + constraintKey + '\''));
            } else if (!Array.isArray(value)) {
                return doneCallback(new Error(
                    'Non-array value for fragment value at \'' + constraintKey + '\''));
            } else if (syncFragment.type === 'add') {
                if (constraintValue.type !== 'insert') {
                    // Allow an insert constraint on an add with actual values in the 
                    // array but not a remove or anything else as they do not make sense
                    return doneCallback(new Error(
                        'Array property constraint \'' + constraintValue.type + 
                        '\' for new object not valid, only insert is applicable at \'' + constraintKey + '\''));
                } else {
                    return doneCallback();
                }
            } else if (syncFragment.type === 'change') {
                lazilyGetExistingModelObject(function(err, modelObject) {
                    if (err) {
                        return doneCallback(new Error(
                            'Failed to fetch model object instance to test constraint at \'' + 
                            constraintKey + '\', ' + 'with UUID \'' + syncFragment.objectUUID + 
                            '\' due to: ' + err.message));
                    }
                    var original = modelObject[constraintKey];
                    if (constraintValue.type === 'insert' && !(value.length > original.length)) {
                        return doneCallback(new Error('Fragment value is not an insert at \'' + constraintKey + '\''));
                    } else if (constraintValue.type === 'remove' && !(value.length < original.length)) {
                        return doneCallback(new Error('Fragment value is not a remove at \'' + constraintKey + '\''));
                    } else {
                        return doneCallback();
                    }
                });
            } else {
                return doneCallback(new Error('Cannot match sync fragment type'));
            }
        } else {
            // Apply a simple value constraint
            if (value !== constraintValue) {
                return doneCallback(new Error('Fragment value does not match at \'' + constraintKey + '\''));
            } else {
                return doneCallback();
            }
        }
    }.bind(this), function(err) {
        callback(null, err ? false : true);
    });
};
