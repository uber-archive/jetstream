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

module.exports = PullQueryOperation;

var _ = require('lodash');
var AbstractQueryOperation = require('./abstract_query_operation');
var async = require('async');
var Err = require('rust-result').Err;
var KeyPathNotation = require('./key_path_notation');
var LateBoundSyncFragment = require('./late_bound_sync_fragment');
var Ok = require('rust-result').Ok;
var tryit = require('tryit');
var util = require('util');

function PullQueryOperation(options) {
    AbstractQueryOperation.call(this, options);

    this.prepared = false;
    this.executing = false;
    this.executed = false;
    this.lateBoundSyncFragments = [];
}

util.inherits(PullQueryOperation, AbstractQueryOperation);

PullQueryOperation.prototype.prepareAndValidate = function(callback) {
    var modification = this.modification;
    var propertiesAndTypeClassByKeyPath = {};
    async.mapSeries(Object.keys(modification), function(keyPath, doneCallback) {
        var value = modification[keyPath];

        var queryTypeClass = this.typeClass;
        var result = KeyPathNotation.resolveProperty(queryTypeClass, keyPath);
        if (Err(result)) {
            return doneCallback(Err(result));
        }

        result = Ok(result);

        var property = result.property;
        var key = property.name;
        var ownerTypeClass = result.ownerTypeClass;
        var ownerKeyPath = result.ownerKeyPath;

        if (!property.isCollectionType) {
            return doneCallback(new Error(
                'Illegal $pull modification at keyPath \'' + 
                keyPath + '\' can only pull values from a collection property'));
        }

        var propertiesAndTypeClass = propertiesAndTypeClassByKeyPath[ownerKeyPath];
        if (!propertiesAndTypeClass) {
            propertiesAndTypeClass = {typeClass: ownerTypeClass, properties: {}};
            propertiesAndTypeClassByKeyPath[ownerKeyPath] = propertiesAndTypeClass;
        }

        var properties = propertiesAndTypeClass.properties;
        var valueArray;
        if (value.hasOwnProperty('$each')) {
            if (Object.keys(value).length !== 1) {
                return doneCallback(new Error(
                    'Illegal $pull modification at keyPath \'' + 
                    keyPath + '\' can only use $each without any other keys on object'));
            }

            var each = value.$each;
            if (!Array.isArray(each)) {
                return doneCallback(new Error(
                    'Illegal $pull modification at keyPath \'' + 
                    keyPath + '\' $each expects an array value'));
            }

            valueArray = each.concat();
        } else {
            valueArray = [value];
        }

        // TODO: support <query> type of values rather than just exact match and object filters
        // e.g. $gte, $lte, etc: http://docs.mongodb.org/manual/reference/operator/update/pull/
        var err;
        valueArray = valueArray.map(function(pullValue) {
            var typeofPullValue = typeof pullValue;
            if (property.isModelObjectType && typeofPullValue !== 'object') {
                err = new Error(
                    'Illegal $pull modification at keyPath \'' + 
                    keyPath + '\' need to specify object to filter collection of ModelObjects');
                return false;
            } else if (!property.isModelObjectType && typeofPullValue === 'object') {
                err = new Error(
                    'Illegal $pull modification at keyPath \'' + 
                    keyPath + '\' need to specify scalar value to filter collection of values, not an object');
                return false;
            }

            if (property.isModelObjectType) {
                // Validate the keys are correct
                var modelObjectFilter = {};
                _.each(pullValue, function(modelObjectFilterValue, modelObjectFilterKey) {
                    var isUUIDKey = modelObjectFilterKey === '$uuid' && typeof modelObjectFilterValue === 'string';
                    if (!isUUIDKey && !property.singleType.getProperty(modelObjectFilterKey)) {
                        err = new Error(
                            'Illegal $pull modification at keyPath \'' + 
                            keyPath + '\' bad field to match ModelObject specified ' +
                            '\'' + property.singleType.typeName + '\' has no property ' +
                            '\'' + modelObjectFilterKey + '\'');
                        return false;
                    }
                    // TODO: validate the modelObjectFilterValue matches the property type
                    if (isUUIDKey) {
                        modelObjectFilter.uuid = modelObjectFilterValue;
                    } else {
                        modelObjectFilter[modelObjectFilterKey] = modelObjectFilterValue;
                    }
                });
                if (err) {
                    return false;
                }
                return modelObjectFilter;
            } else {
                // TODO: validate if not ModelObjectType that scalar value matches the property scalar value type
                return pullValue;
            }
        });

        if (err) {
            return doneCallback(err);
        }

        properties[key] = valueArray;
        doneCallback();

    }.bind(this), function(err) {
        if (err) {
            return callback(err);
        }

        async.mapSeries(Object.keys(propertiesAndTypeClassByKeyPath), function(keyPath, doneCallback) {
            var propertiesAndTypeClass = propertiesAndTypeClassByKeyPath[keyPath];
            var properties = propertiesAndTypeClass.properties;
            var typeClass = propertiesAndTypeClass.typeClass;

            var syncFragment = new LateBoundSyncFragment({
                type: 'change',
                keyPath: keyPath,
                clsName: typeClass.typeName,
                propertyFilters: properties
            });

            doneCallback(null, syncFragment);

        }.bind(this), function(err, changeFragments) {
            if (err) {
                return callback(err);
            }

            this.prepared = true;

            this.lateBoundSyncFragments = changeFragments;

            callback();
        }.bind(this));
    }.bind(this));
};

PullQueryOperation.prototype.execute = function(scope, modelObject, callback) {
    if (!this.prepared) {
        return callback(new Error('Cannot execute, not prepared'));
    }
    if (this.executed) {
        return callback(new Error('Cannot execute, already executed'));
    }
    if (modelObject.constructor !== this.typeClass) {
        return callback(new Error('Cannot execute, modelObject does not match typeClass'));
    }
    if (this.executing) {
        return callback(new Error('Cannot execute, currently executing'));
    }
    this.executing = true;

    // Bind all the late bound sync fragments and then apply them
    async.waterfall([
        function bindlateBoundSyncFragments(nextCallback) {
            var changeSyncFragments = this.lateBoundSyncFragments;
            async.eachSeries(changeSyncFragments, function(lateBoundSyncFragment, doneCallback) {
                var keyPath = lateBoundSyncFragment.keyPath;
                var result = KeyPathNotation.resolveModelObject(modelObject, keyPath);
                if (Err(result)) {
                    return doneCallback(new Error(
                        'Illegal $pull modification at keyPath \'' + keyPath +
                        '\' no such ModelObject exists at keyPath'));
                }

                // Bind the target ModelObject's UUID to the change fragment
                var target = Ok(result);
                lateBoundSyncFragment.bindObjectUUID(target.uuid);
                lateBoundSyncFragment.bindClsName(target.typeName);

                // Set the actual filtered properties
                var properties = {};
                var propertyFilters = lateBoundSyncFragment.propertyFilters;
                Object.keys(propertyFilters).forEach(function(key) {
                    var value = propertyFilters[key];
                    var collection = target[key];
                    var remaining = collection.slice(0);
                    _.each(value, function(filterValue) {
                        if (typeof filterValue === 'object') {
                            remaining = _.reject(remaining, filterValue);
                        } else {
                            remaining = _.without(remaining, filterValue);
                        }
                    });

                    // Ensure filtering changed the array otherwise this is not a property change
                    if (remaining.length === collection.length) {
                        return;
                    }

                    if (target.getProperty(key).isModelObjectType) {
                        properties[key] = remaining.map(function(element) {
                            return element.uuid;
                        });
                    } else {
                        properties[key] = remaining;
                    }
                });

                tryit(function() {
                    lateBoundSyncFragment.setPropertiesOrThrow(properties);
                }, doneCallback);

            }, nextCallback);
        }.bind(this),

        function applySyncFragments(nextCallback) {
            var syncFragments = this.lateBoundSyncFragments.filter(function(syncFragment) {
                return Object.keys(syncFragment.properties).length > 0;
            });
            var options = this.options;
            scope.applySyncFragments(syncFragments, options, function(err, results) {
                nextCallback(err, syncFragments, results);
            });
        }.bind(this),

        function createQueryResult(syncFragments, results, nextCallback) {
            var result = this._createQueryResult(modelObject, syncFragments, results);
            nextCallback(null, result);
        }.bind(this)

    ], function(err, result) {
        this.executed = true;
        this.executing = false;
        callback(err, result);
    }.bind(this));
};

