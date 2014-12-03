//
// scope.js
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

module.exports = Scope;

var _ = require('lodash');
var AbstractPersistMiddleware = require('./middleware/persist/abstract_persist_middleware');
var async = require('async');
var callbackOrEmitError = require('callback-or-emit-error');
var EventEmitter = require('events').EventEmitter;
var maybeCallback = require('maybe-callback');
var MemoryPersistMiddleware = require('./middleware/persist/memory_persist_middleware');
var StorageMiddleware = require('./middleware/storage/storage_middleware');
var SyncFragment = require('./sync_fragment');
var util = require('util');
var uuid = require('node-uuid');

function Scope(options) {
    options = options || {};

    if (typeof options.name !== 'string') {
        throw new Error('Requires name');
    }

    this.uuid = uuid.v4();
    this.name = options.name;
    this.params = options.params || {};
    this._hasRootModel = false;
    this._rootModelObjectUUID = null;
    this._rootModelObjectConstructor = null;
    this._applyingSyncFragments = false;
    this._applySyncFragmentsQueue = [];

    this.usePersist(options.persist || new MemoryPersistMiddleware());
    this.useStorage(options.storage || null);
}

util.inherits(Scope, EventEmitter);

Scope.prototype.usePersist = function(middleware) {
    if (middleware instanceof AbstractPersistMiddleware) {
        this.persist = middleware;
    } else {
        throw new Error('Persist middleware is not supported');
    }
};

Scope.prototype.useStorage = function(middleware) {
    if (middleware === null) {
        this.storage = null;
        return;
    }

    if (middleware instanceof StorageMiddleware) {
        this.storage = middleware;
    } else {
        throw new Error('Storage middleware is not supported');
    }
};

Scope.prototype.hasStorage = function(userCallback) {
    return Boolean(this.storage);
};

Scope.prototype.setRoot = function(modelObject, callback) {
    // Will call addModelObjectAsRootModelObject and set the modelObject.scope property
    modelObject.setScopeAndMakeRootModel(this, callback);
};

Scope.prototype.addModelObjectAsRootModelObject = function(modelObject, callback) {
    if (this._rootModelObjectUUID) {
        return callbackOrEmitError(this, callback, new Error('Already has root modelObject set'));
    }

    this.addModelObject(modelObject, function(err) {
        if (err) {
            return callbackOrEmitError(this, callback, err);
        }

        this._hasRootModel = true;
        this._rootModelObjectUUID = modelObject.uuid;
        this._rootModelObjectConstructor = modelObject.constructor;
        maybeCallback(callback)();
    }.bind(this));
};

Scope.prototype.getRootModelObjectUUID = function() {
    return this._rootModelObjectUUID;
};

Scope.prototype.addModelObject = function(modelObject, callback) {
    this.persist.addModelObject(modelObject, callback);
};

Scope.prototype.removeModelObject = function(modelObject, callback) {
    this.persist.removeModelObject(modelObject, callback);
};

Scope.prototype.updateModelObject = function(modelObject, callback) {
    this.persist.updateModelObject(modelObject, callback);
};

Scope.prototype.containsModelObject = function(modelObject, callback) {
    this.persist.containsModelObjectWithUUID(modelObject.uuid, callback);
};

Scope.prototype.getModelObjectByUUID = function(uuid, callback) {
    this.persist.getModelObjectByUUID(uuid, callback);
};

Scope.prototype.getRootModelObject = function(callback) {
    this.persist.getModelObjectByUUID(this.getRootModelObjectUUID(), callback);
};

Scope.prototype.getAllModelObjects = function(callback) {
    if (!this._rootModelObjectUUID) {
        return callbackOrEmitError(this, callback, new Error('No root modelObject set'));
    }

    this.getRootModelObject(function(err, rootModelObject) {
        if (err) {
            return callbackOrEmitError(this, callback, err);
        }

        rootModelObject.getTreeModelObjects(callback);
    }.bind(this));
};

Scope.prototype.fetchFromStorage = function(callback) {
    if (!this.hasStorage()) {
        return callbackOrEmitError(this, callback, new Error('No storage middleware set'));
    }
    if (this._hasRootModel) {
        return callbackOrEmitError(this, callback, new Error('Already has root model set'));
    }

    this.storage.fetchRootModelObjectForScope(this, function(err, rootModelObject) {
        if (err || !rootModelObject) {
            return callback(err || new Error('Failed to return a root ModelObject'));
        }

        rootModelObject.setScopeAndMakeRootModel(this, callback);
    }.bind(this));
};

Scope.prototype.applySyncFragments = function(syncFragments, context, callback) {
    if (typeof context === 'function') {
        callback = context;
        context = undefined;
    }

    if (!this._hasRootModel) {
        return callbackOrEmitError(this, callback, new Error('No root model set'));
    }

    // Queue this call if currently applying a set of sync fragments
    if (this._applyingSyncFragments) {
        return this._applySyncFragmentsQueue.push(arguments);
    }
    this._applyingSyncFragments = true;

    var addSyncFragments = _.filter(syncFragments, function(syncFragment) {
        return syncFragment.type === SyncFragment.CONST.TYPE_ADD;
    });

    async.waterfall([
        function applySyncFragmentsToStorage(nextCallback) {
            if (!this.hasStorage()) {
                return nextCallback();
            }

            storage.applySyncFragmentsForScope(this, syncFragments, function(err, results) {
                // TODO: somehow remove sync fragments that failed storage and remove the failed 
                // addSyncFragments too

                if (err) {
                    return nextCallback(err);
                }

                nextCallback();
            });
        }.bind(this),

        function createTemporalModelObjectsForAddSyncFragments(nextCallback) {
            var temporalModelObjectsByUUID = {};
            var addResultsByTemporalModelObjectUUID = {};
            async.mapSeries(addSyncFragments, function(syncFragment, doneCallback) {
                this._temporalModelObjectForAddSyncFragment(syncFragment, function(err, modelObject) {
                    if (modelObject) {
                        temporalModelObjectsByUUID[modelObject.uuid] = modelObject;
                    }
                    var result = this._syncFragmentResult(err);
                    if (modelObject) {
                        addResultsByTemporalModelObjectUUID[modelObject.uuid] = result;
                    }
                    doneCallback(null, result);
                }.bind(this));

            }.bind(this), function(err, addResults) {
                if (err) {
                    return nextCallback(err);
                }

                nextCallback(null, addResults, temporalModelObjectsByUUID, addResultsByTemporalModelObjectUUID);
            });
        }.bind(this),

        function applyAddSyncFragments(addResults, temporalModelObjectsByUUID, addResultsByTemporalModelObjectUUID, nextCallback) {
            async.mapSeries(addSyncFragments, function(syncFragment, doneCallback) {
                var result = addResultsByTemporalModelObjectUUID[syncFragment.objectUUID];
                if (!result || result.error) {
                    return doneCallback();
                }

                var modelObject = temporalModelObjectsByUUID[syncFragment.objectUUID];
                this._applySyncFragmentProperties(syncFragment, modelObject, temporalModelObjectsByUUID, function(err) {
                    if (err) {
                        // Failed applying properties for add fragment, update result
                        _.each(this._syncFragmentResult(err), function(value, key) {
                            result[key] = value;
                        });
                        // Remove as a temporal object so related change fragments fail
                        delete temporalModelObjectsByUUID[modelObject.uuid];
                    }
                    doneCallback();
                }.bind(this));

            }.bind(this), function(err) {
                if (err) {
                    return nextCallback(err);
                }

                nextCallback(null, addResults, temporalModelObjectsByUUID, addResultsByTemporalModelObjectUUID);
            });
        }.bind(this),

        function applyRemainingSyncFragments(addResults, temporalModelObjectsByUUID, addResultsByTemporalModelObjectUUID, nextCallback) {
            async.mapSeries(syncFragments, function(syncFragment, doneCallback) {
                // Already processed add fragments
                if (syncFragment.type === SyncFragment.CONST.TYPE_ADD) {
                    return doneCallback(null, addResults.shift());
                }

                switch (syncFragment.type) {
                    case SyncFragment.CONST.TYPE_CHANGE:
                        this._applyChangeSyncFragment(syncFragment, temporalModelObjectsByUUID, function(err) {
                            // TODO: actually call doneCallback with error if it was a persist error, 
                            // perhaps use a _commitChangeSyncFragment call instead of doing inside _applyChangeSyncFragment
                            doneCallback(null, this._syncFragmentResult(err));
                        }.bind(this));
                        break;
                    case SyncFragment.CONST.TYPE_REMOVE:
                        this._applyRemoveSyncFragment(syncFragment, function(err) {
                            // TODO: actually call doneCallback with error if it was a persist error, 
                            // perhaps use a _commitRemoveSyncFragment call instead of doing inside _applyRemoveSyncFragment
                            doneCallback(null, this._syncFragmentResult(err));
                        }.bind(this));
                        break;
                    default:
                        doneCallback(new Error('Misunderstood SyncFragment type')); 
                }
            }.bind(this), function(err, results) {
                if (err) {
                    return nextCallback(err);
                }
                nextCallback(null, results, temporalModelObjectsByUUID, addResultsByTemporalModelObjectUUID);
            });
        }.bind(this),

        function commitAttachedTemporalModelObjects(results, temporalModelObjectsByUUID, addResultsByTemporalModelObjectUUID, nextCallback) {
            var modelObjects = _.map(temporalModelObjectsByUUID, function(modelObject) {
                return modelObject;
            });
            async.mapSeries(modelObjects, function(modelObject, doneCallback) {
                var result = addResultsByTemporalModelObjectUUID[modelObject.uuid];

                if (!modelObject.scope) {
                    var err = new Error('No scope attached, parent sync fragment failed');
                    _.each(this._syncFragmentResult(err), function(value, key) {
                        result[key] = value;
                    });
                    return doneCallback();
                }

                this._commitModelObjectForAddSyncFragment(modelObject, function(err) {
                    if (err) {
                        return doneCallback(err);
                    }
                    doneCallback();
                });

            }.bind(this), function(err) {
                if (err) {
                    return nextCallback(err);
                }
                nextCallback(null, results);
            });
        }.bind(this)

    ], function(err, results) {
        // If any pending calls were queued then process the next on the next run loop
        this._applyingSyncFragments = false;
        if (this._applySyncFragmentsQueue.length > 0) {
            process.nextTick(function() {
                this.applySyncFragments.apply(this, this._applySyncFragmentsQueue.pop());
            }.bind(this));
        }

        if (err) {
            // TODO: discard this scope, integrity is GOOOOONE
            return callbackOrEmitError(this, callback, err);
        }

        var appliedFragments = [];
        _.each(results, function(result, index) {
            var syncFragment = syncFragments[index];
            if (!result.error) {
                appliedFragments.push(syncFragment);
            }
        });
        
        if (appliedFragments.length > 0) {
            this.emit('changes', appliedFragments, context);
        }

        maybeCallback(callback)(null, results);

    }.bind(this));
};

Scope.prototype._syncFragmentResult = function(syncFragmentError) {
    var result = {};
    if (syncFragmentError) {
        result.error = {message: syncFragmentError.message};
        if (syncFragmentError.code) {
            result.error.code = syncFragmentError.code;
        }
        if (syncFragmentError.slug) {
            result.error.slug = syncFragmentError.slug;
        }
    }
    return result;
};

Scope.prototype._verifyFragmentProperties = function(fragment, modelObject, addedModelObjectsByUUID, callback) {
    async.mapSeries(Object.keys(fragment.properties), function(key, doneCallback) {
        var value = fragment.properties[key];

        var property = modelObject.getProperty(key);
        if (!property) {
            return doneCallback(new Error('No property at \'' + key + '\''));
        }

        if (!property.isModelObjectType) {
            if (property.isCollectionType && !(value instanceof Array)) {
                return doneCallback(new Error('Collection type without array value at \'' + key + '\''));
            } else if (property.isCollectionType) {
                async.map(value, function(element) {
                    this._verifyFragmentValueProperty(property, element, doneCallback);
                }.bind(this), doneCallback);
            } else {
                this._verifyFragmentValueProperty(property, value, doneCallback);
            }
        } else {
            // Before verifying ensure we lowercase all UUIDs present
            if (typeof value === 'string') {
                fragment.properties[key] = value = value.toLowerCase();
            } else if (value instanceof Array) {
                fragment.properties[key] = value = _.map(value, function(element) {
                    if (typeof element === 'string') {
                        return element.toLowerCase();
                    }
                    return element;
                });
            }
            this._verifyFragmentModelObjectProperty(property, value, addedModelObjectsByUUID, doneCallback);
        }
    }.bind(this), callback);
};

Scope.prototype._verifyFragmentValueProperty = function(property, value, callback) {
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
        return callback(new Error(
            'Not valid type at \'' + property.name + '\', should be ' + property.singleType.name));
    }
    callback();
};

Scope.prototype._verifyFragmentModelObjectProperty = function(property, value, addedModelObjectsByUUID, callback) {
    if (property.isCollectionType) {
        if (!(value instanceof Array)) {
            return callback(new Error('Not valid type at \'' + property.name + '\', should be array of UUIDs'));
        }
        var err;
        _.each(value, function(uuid) {
            if (err) {
                return;
            }
            if (!uuid || typeof uuid !== 'string') {
                err = new Error('Not valid type at \'' + property.name + '\', should be array of UUIDs');
            }
        });
        if (err) {
            return callback(err);
        }

        var notFoundUUIDs = _.filter(value, function(uuid) {
            return !Boolean(addedModelObjectsByUUID[uuid]);
        });

        if (notFoundUUIDs.length < 1) {
            return callback();
        }

        async.mapSeries(notFoundUUIDs, function(uuid, nextCallback) {
            this.persist.containsModelObjectWithUUID(uuid, function(err, result) {
                if (err || !result) {
                    err = err || new Error('No such ModelObject \'' + uuid + '\' at \'' + property.name + '\'');
                    return nextCallback(err);
                }
                nextCallback();
            });

        }.bind(this), callback);
    } else {
        if (value === null) {
            return callback();
        }
        if (typeof value !== 'string') {
            return callback(new Error('Cannot set property at \'' + property.name + '\' as non-UUID'));
        }
        if (addedModelObjectsByUUID[value]) {
            return callback();
        }

        this.persist.containsModelObjectWithUUID(value, function(err, result) {
            if (err || !result) {
                err = err || new Error('No such ModelObject \'' + value + '\' at \'' + property.name + '\'');
                return callback(err);
            }
            callback();
        });
    }
};

Scope.prototype._temporalModelObjectForAddSyncFragment = function(fragment, callback) {
    async.waterfall([
        function getModelObjectType(nextCallback) {
            var rootModelObjectType = this._rootModelObjectConstructor;
            var modelObjectType = rootModelObjectType._getSubtypeWithTypeName(fragment.clsName);
            if (!modelObjectType) {
                return nextCallback(new Error('No such class type \'' + fragment.clsName + '\''));
            }
            nextCallback(null, modelObjectType);
        }.bind(this),

        function createModelObject(modelObjectType, nextCallback) {
            var modelObject;
            try {
                var Type = modelObjectType;
                var uuid = fragment.objectUUID;
                modelObject = new Type({
                    uuid: uuid,
                    scope: this
                });
            } catch (err) {
                return nextCallback(err);
            }

            nextCallback(null, modelObject);
        }.bind(this)

    ], callback);
};

Scope.prototype._commitModelObjectForAddSyncFragment = function(temporalModelObject, callback) {
    this.persist.addModelObject(temporalModelObject, function(err) {
        if (err) {
            return callback(err);
        }
        callback();
    });
};

Scope.prototype._applySyncFragmentProperties = function(fragment, modelObject, addedModelObjectsByUUID, callback) {
    async.waterfall([
        function verifyProperties(nextCallback) {
            this._verifyFragmentProperties(fragment, modelObject, addedModelObjectsByUUID, function(err) {
                if (err) {
                    return nextCallback(err);
                }

                nextCallback();
            });
        }.bind(this),

        function setProperties(nextCallback) {
            async.mapSeries(Object.keys(fragment.properties), function(key, doneCallback) {
                var value = fragment.properties[key];
                var property = modelObject.getProperty(key);
                if (property.isModelObjectType) {
                    if (property.isCollectionType) {
                        async.mapSeries(value, function(uuid, nextCallback) {
                            var addedModelObject = addedModelObjectsByUUID[uuid];
                            if (addedModelObject) {
                                return nextCallback(null, addedModelObject);
                            }
                            this.persist.getModelObjectByUUID(uuid, nextCallback);

                        }.bind(this), function(err, modelObjects) {
                            if (err) {
                                return doneCallback(err);
                            }
                            modelObject[key] = modelObjects;
                            doneCallback();
                        });
                    } else {
                        var addedModelObject = addedModelObjectsByUUID[value];
                        if (addedModelObject) {
                            modelObject[key] = addedModelObject;
                            return doneCallback();
                        }
                        this.persist.getModelObjectByUUID(uuid, function(err, modelObject) {
                            if (err) {
                                return doneCallback(err);
                            }
                            modelObject[key] = modelObject;
                            doneCallback();
                        });
                    }
                } else {
                    modelObject[key] = value;
                    doneCallback();
                }

            }.bind(this), function(err) {
                if (err) {
                    return nextCallback(err); 
                }

                nextCallback(null, modelObject);
            });
        }.bind(this)

    ], callback);
};

Scope.prototype._applyChangeSyncFragment = function(fragment, addedModelObjectsByUUID, callback) {
    async.waterfall([
        function getModelObject(nextCallback) {
            this.persist.getModelObjectByUUID(fragment.objectUUID, function(err, modelObject) {
                if (err) {
                    return nextCallback(err);
                }
                if (!modelObject) {
                    return nextCallback(new Error('ModelObject not found'));
                }

                nextCallback(null, modelObject);
            });
        }.bind(this),

        function verifyAndSetProperties(modelObject, nextCallback) {
            this._applySyncFragmentProperties(fragment, modelObject, addedModelObjectsByUUID, function(err) {
                if (err) {
                    return nextCallback(err);
                }

                nextCallback(null, modelObject);
            });
        }.bind(this),

        function updateModelObject(modelObject, nextCallback) {
            this.persist.updateModelObject(modelObject, nextCallback);
        }.bind(this)

    ], callback);
};

Scope.prototype._applyRemoveSyncFragment = function(fragment, callback) {
    async.waterfall([
        function getModelObject(nextCallback) {
            this.persist.getModelObjectByUUID(fragment.objectUUID, function(err, modelObject) {
                if (err) {
                    return nextCallback(err);
                }
                if (!modelObject) {
                    return nextCallback(new Error('ModelObject not found'));
                }

                nextCallback(null, modelObject);
            });
        }.bind(this),

        function getParents(modelObject, nextCallback) {
            modelObject.getParentRelationships(function(err, parentRelationships) {
                if (err) {
                    return nextCallback(err);
                }
                nextCallback(null, modelObject, parentRelationships);
            });
        }.bind(this),

        function verifyRemove(modelObject, parentRelationships, nextCallback) {
            var parentRelationshipsAndFoundIndexes = [];
            var err;
            _.each(parentRelationships, function(parentRelationship) {
                if (err) {
                    return;
                }
                
                var foundIndexes = [];
                var entry = {
                    parentRelationship: parentRelationship, 
                    foundIndexes: foundIndexes
                };
                parentRelationshipsAndFoundIndexes.push(entry);

                var parent = parentRelationship.parent;
                var key = parentRelationship.key;
                var property = parent.getProperty(key);

                if (!property) {
                    err = new Error(
                        'No ModelObject property on parent at \'' + key + '\'');
                    return;
                }

                if (!property.isCollectionType) {
                    if (!parent[key] || parent[key].uuid !== modelObject.uuid) {
                        err = new Error(
                            'Parent property at \'' + key + 
                            '\' not set to same ModelObject instance');
                        return;
                    }
                } else {
                    parent[key].forEach(function(object, index) {
                        if (object.uuid === modelObject.uuid) {
                            foundIndexes.push(index);
                        }
                    });
                    if (foundIndexes.length === 0) {
                        err = new Error(
                            'Parent property at \'' + key + 
                            '\' did not contain ModelObject instance');
                        return;
                    }
                }
            });
            
            if (err) {
                return nextCallback(err);
            }

            nextCallback(null, modelObject, parentRelationshipsAndFoundIndexes);
        }.bind(this),

        function removeModelObject(modelObject, parentRelationshipsAndFoundIndexes, nextCallback) {
            this.persist.removeModelObject(modelObject, function(err) {
                if (err) {
                    return nextCallback(err);
                }

                _.each(parentRelationshipsAndFoundIndexes, function(entry) {
                    if (err) {
                        return;
                    }

                    var parent = entry.parentRelationship.parent;
                    var key = entry.parentRelationship.key;
                    var property = parent.getProperty(key);
                    var foundIndexes = entry.foundIndexes;

                    if (!property.isCollectionType) {
                        parent[key] = null;
                    } else {
                        try {
                            foundIndexes.forEach(function(index) {
                                parent[key].splice(index, 1);
                            });
                        } catch(exc) {
                            err = exc;
                            return;
                        }
                    }
                });

                if (err) {
                    return nextCallback(err);
                }
                
                nextCallback();
            });
        }.bind(this)

    ], callback);
};
