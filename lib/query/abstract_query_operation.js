//
// abstract_query_operation.js
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

module.exports = AbstractQueryOperation;

var _ = require('lodash');
var async = require('async');
var Err = require('rust-result').Err;
var LateBoundSyncFragment = require('./late_bound_sync_fragment');
var ModelObject = require('../model_object');
var Ok = require('rust-result').Ok;
var QueryResult = require('./query_result');
var QueryResultEntry = require('./query_result_entry');
var uuid = require('node-uuid');

function AbstractQueryOperation(options) {
    options = options || {};

    if (!ModelObject.isChildClass(options.typeClass)) {
        throw new Error('Requires typeClass derived from ModelObject for ModelObject type to operate on');
    }

    if (typeof options.modification !== 'object') {
        throw new Error('Illegal modification value, must be object');
    }

    this.options = options;
    this.typeClass = options.typeClass;
    this.modification = options.modification;
}

AbstractQueryOperation.prototype.prepareAndValidate = function(callback) {
    throw new Error('Not implemented');
};

AbstractQueryOperation.prototype.execute = function(scope, modelObject, callback) {
    // Child classes implementing execute should always make sure prepareAndValidate
    // has been called before starting to execute the query operation.
    throw new Error('Not implemented');
};

AbstractQueryOperation.prototype._modificationHasUUIDOrType = function(modification) {
    var singleAddition = typeof modification === 'object' && 
        (typeof modification.$uuid === 'string' ||
        typeof modification.$cls === 'string');
    if (singleAddition) {
        return true;
    }

    return Array.isArray(modification) && _.every(modification, function(element) {
        return typeof element === 'object' && 
            (typeof element.$uuid === 'string' || 
            typeof element.$cls === 'string');
    });
};

AbstractQueryOperation.prototype._modificationHasUUIDAndType = function(modification) {
    var singleAddition = typeof modification === 'object' && 
        typeof modification.$uuid === 'string' && 
        typeof modification.$cls === 'string';
    if (singleAddition) {
        return true;
    }

    return Array.isArray(modification) && _.every(modification, function(element) {
        return typeof element === 'object' && 
            typeof element.$uuid === 'string' && 
            typeof element.$cls === 'string';
    });
};

AbstractQueryOperation.prototype._createAddSyncFragments = function(op, typeClass, keyPath, modification, callback) {
    if (typeof modification !== 'object') {
        return callback(new Error(
            'Illegal ' + op + ' modification at keyPath \'' + keyPath + 
            '\' expected object for ModelObject type'));
    }

    var syncFragments = [];
    var properties = {};
    async.mapSeries(Object.keys(modification), function(key, doneCallback) {
        var value = modification[key];

        if (key === '$uuid' || key === '$cls') {
            return doneCallback();
        }

        var property = typeClass.getProperty(key);
        var propertyKeyPath = keyPath === '' ? key : keyPath + '.' + key;

        if (!property) {
            return doneCallback(new Error(
                'Illegal ' + op + ' modification at keyPath \'' + keyPath + 
                '\' has no property at \'' + key + '\''));
        }

        this._getPropertyValue(op, property, propertyKeyPath, value, function(err, value, addSyncFragments) {
            if (err) {
                return doneCallback(err);
            }
            properties[key] = value;
            syncFragments = syncFragments.concat(addSyncFragments);
            doneCallback();
        });

    }.bind(this), function(err) {
        if (err) {
            return callback(err);
        }

        // UUID can be undefined and it will be lazy generated
        var objectUUID;
        if (typeof modification.$uuid === 'string') {
            objectUUID = modification.$uuid;
        } else {
            objectUUID = uuid.v4();
        }

        // Class type name defaults to property type, can be overriden from default
        var typeName = typeClass.typeName;
        if (typeof modification.$cls === 'string') {
            var findTypeClassResult = typeClass.getChildClassWithTypeName(modification.$cls);
            if (Err(findTypeClassResult)) {
                return callback(new Error(
                    'Illegal ' + op + ' modification at keyPath \'' + keyPath + 
                    '\' no such $cls \'' + modification.$cls + '\''));
            }

            typeName = modification.$cls;
            typeClass = Ok(findTypeClassResult);
        }

        var syncFragment = new LateBoundSyncFragment({
            uuid: objectUUID,
            type: 'add',
            clsName: typeName,
            keyPath: keyPath,
            properties: properties
        });

        syncFragment.verifyPropertiesForType(typeClass, function(err) {
            if (err) {
                return callback(err);
            }
            callback(null, [syncFragment].concat(syncFragments));
        });
    });
};

AbstractQueryOperation.prototype._getPropertyValue = function(op, property, propertyKeyPath, value, callback) {
    if (property.isModelObjectType && property.isCollectionType) {
        this._getCollectionPropertyValue(op, property, propertyKeyPath, value, function(err, uuids, fragments) {
            if (err) {
                return callback(err);
            }
            callback(null, uuids, fragments);
        });
    } else if (property.isModelObjectType && !property.isCollectionType) {
        this._getModelObjectPropertyValue(op, property, propertyKeyPath, value, function(err, objectUUID, fragments) {
            if (err) {
                return callback(err);
            }
            callback(null, objectUUID, fragments);
        });
    } else {
        callback(null, value, []);
    }
};

AbstractQueryOperation.prototype._getCollectionPropertyValue = function(op, property, propertyKeyPath, value, callback) {
    var addSyncFragments = [];
    if (!Array.isArray(value)) {
        return callback(new Error(
            'Illegal ' + op + ' modification at keyPath \'' + 
            propertyKeyPath + '\' expected array for collection property'));
    }

    // Support setting any entry by UUID string and then create fragment for any inline ModelObjects
    var uuids = _.filter(value, function(element) {
        return typeof element === 'string';
    });

    // If any remaining values treat as inline ModelObjects
    var newModelObjects = _.filter(value, function(element) {
        return typeof element !== 'string';
    });
    if (newModelObjects.length < 1) {
        return callback(null, uuids, addSyncFragments);
    }

    async.mapSeries(newModelObjects, function(element, collectionDoneCallback) {
        this._createAddSyncFragments(
            op, property.singleType, propertyKeyPath, element, 
            collectionDoneCallback);

    }.bind(this), function(err, results) {
        if (err) {
            return callback(err);
        }

        // Set the UUIDs of the created fragments for this fragment property value
        results.forEach(function(array) {
            // The direct descendent for each of these created fragments is always the first.
            uuids.push(array[0].objectUUID);
            addSyncFragments = addSyncFragments.concat(array);
        });

        callback(null, uuids, addSyncFragments);
    });
};

AbstractQueryOperation.prototype._getModelObjectPropertyValue = function(op, property, propertyKeyPath, value, callback) {
    if (typeof value === 'string') {
        // Setting ModelObject instance by UUID
        callback(null, value, []);

    } else {
        // Inline specifying a new ModelObject instance
        this._createAddSyncFragments(op, property.singleType, propertyKeyPath, value, function(err, fragments) {
            if (err) {
                return callback(err);
            }

            // Set the UUID of the created fragment for this fragment property value
            // The direct descendent for each of these created fragments is always the first
            callback(null, fragments[0].objectUUID, fragments);
        });
    }
};

AbstractQueryOperation.prototype._createQueryResult = function(matchedModelObject, syncFragments, results) {
    var matched = [new QueryResultEntry({
        uuid: matchedModelObject.uuid,
        clsName: matchedModelObject.typeName
    })];
    var createdByUUID = {};
    var modifiedByUUID = {};
    var writeErrors = [];
    _.each(results, function(result, index) {
        if (result.error) {
            writeErrors.push(result.error);
        } else {
            var syncFragment = syncFragments[index];
            var objectUUID = syncFragment.objectUUID;
            if (syncFragment.type === 'add' && !createdByUUID.hasOwnProperty(objectUUID)) {
                createdByUUID[objectUUID] = new QueryResultEntry({
                    uuid: objectUUID,
                    clsName: syncFragment.clsName
                });
            } else if (syncFragment.type === 'change' && !createdByUUID.hasOwnProperty(objectUUID)) {
                modifiedByUUID[objectUUID] = new QueryResultEntry({
                    uuid: objectUUID,
                    clsName: syncFragment.clsName
                });
            }
        }
    });

    return new QueryResult({
        matched: matched,
        created: _.values(createdByUUID),
        modified: _.values(modifiedByUUID),
        writeErrors: writeErrors
    });
};
