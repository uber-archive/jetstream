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

module.exports = Scope;

var _ = require('lodash');
var AbstractPersistMiddleware = require('./middleware/persist/abstract_persist_middleware');
var async = require('async');
var callbackOrEmitError = require('callback-or-emit-error');
var EventEmitter = require('events').EventEmitter;
var logger = require('./logger');
var maybeCallback = require('maybe-callback');
var MemoryPersistMiddleware = require('./middleware/persist/memory_persist_middleware');
var Query = require('./query/query');
var StorageMiddleware = require('./middleware/storage/storage_middleware');
var SyncFragment = require('./sync_fragment');
var util = require('util');
var uuid = require('node-uuid');

var debug = logger.debug.bind(logger, 'core:scope');

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
    this._orphanedModelObjects = {};
    this._onModelObjectParentAddedListener = this._onModelObjectParentAdded.bind(this);
    this._onModelObjectParentRemovedListener = this._onModelObjectParentRemoved.bind(this);
    this._onModelObjectScopeRemovedListener = this._onModelObjectScopeRemoved.bind(this);

    this.usePersist(options.persist || new MemoryPersistMiddleware());
    this.useStorage(options.storage || null);
}

util.inherits(Scope, EventEmitter);

Scope.prototype.usePersist = function(middleware) {
    if (middleware instanceof AbstractPersistMiddleware) {
        debug('scope "' + this.name + '" using persist middleware "' + middleware.constructor.name + '"');
        this.persist = middleware;
    } else {
        throw new Error('Persist middleware is not supported');
    }
};

Scope.prototype.useStorage = function(middleware) {
    if (middleware === null) {
        debug('scope "' + this.name + '" using no storage');
        this.storage = null;
        return;
    }

    if (middleware instanceof StorageMiddleware) {
        debug('scope "' + this.name + '" using storage middleware "' + middleware.constructor.name + '"');
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

Scope.prototype.getRootModelObjectType = function() {
    return this._rootModelObjectConstructor;
};

Scope.prototype.getRootModelObjectUUID = function() {
    return this._rootModelObjectUUID;
};

Scope.prototype.addModelObject = function(modelObject, callback) {
    this.persist.addModelObject(modelObject, function(err) {
        if (err) {
            return callback(err);
        }
        modelObject.on('parent', this._onModelObjectParentAddedListener);
        modelObject.on('parentDetach', this._onModelObjectParentRemovedListener);
        modelObject.on('scopeDetach', this._onModelObjectScopeRemovedListener);
        callback();
    }.bind(this));
};

Scope.prototype.removeModelObject = function(modelObject, callback) {
    this.persist.removeModelObject(modelObject, function(err) {
        if (err) {
            return callback(err);
        }

        // Explictly trigger removed as our scopeDetach listener is detached before it fires
        this._onModelObjectScopeRemoved(modelObject, this);

        modelObject.removeListener('parent', this._onModelObjectParentAddedListener);
        modelObject.removeListener('parentDetach', this._onModelObjectParentRemovedListener);
        modelObject.removeListener('scopeDetach', this._onModelObjectScopeRemovedListener);
        callback();
    }.bind(this));
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
    this.persist.getModelObjectByUUID(this._rootModelObjectUUID, callback);
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

Scope.prototype.applySyncFragments = function(syncFragments, options, callback) {
    // Queue this call if currently applying a set of sync fragments
    if (this._applyingSyncFragments) {
        return this._applySyncFragmentsQueue.push(arguments);
    }
    this._applyingSyncFragments = true;

    var optionsType = typeof options;
    if (optionsType === 'function') {
        callback = options;
        options = {};
    } else if (optionsType !== 'object' || options === null) {
        options = {};
    }

    if (!Array.isArray(syncFragments)) {
        return callbackOrEmitError(this, callback, new Error('syncFragments must be array'));
    }

    if (!this._hasRootModel) {
        return callbackOrEmitError(this, callback, new Error('No root model set'));
    }

    var addSyncFragments = _.filter(syncFragments, function(syncFragment) {
        return syncFragment.type === SyncFragment.CONST.TYPE_ADD;
    });

    async.waterfall([
        function callSyncProcedure(nextCallback) {
            if (typeof options.procedure !== 'string') {
                return nextCallback();
            }

            var modelNameAndProcedureName = options.procedure.split('.');
            if (modelNameAndProcedureName.length !== 2) {
                return nextCallback(new Error('Procedure must be of the format "ModelName.procedureName"'));
            }

            var modelName = modelNameAndProcedureName[0];
            var procedureName = modelNameAndProcedureName[1];

            var rootTypeClass = this.getRootModelObjectType();
            var typeClass = rootTypeClass.getSubtypeWithTypeName(modelName);
            if (!typeClass) {
                return nextCallback(new Error(
                    'No such model \'' + modelName + '\' for procedure call with procedure \'' + 
                    options.procedure + '\''));
            }

            var procedure = typeClass.getProcedure(procedureName);
            if (!procedure) {
                return nextCallback(new Error(
                    'No such procedure \'' + procedureName + '\' for model \'' + modelName + '\''));
            }

            procedure.verifyAndExecute(this, syncFragments, function(err, result) {
                if (err || !result) {
                    return nextCallback(err || new Error('Procedure result was not return from execution'));
                }
                if (!Array.isArray(result.additionalFragments)) {
                    return nextCallback(new Error('Invalid result returned from procedure'));
                }
                if (result.additionalFragments.length > 0) {
                    syncFragments = syncFragments.concat(result.additionalFragments);
                }
                nextCallback();
            });
        }.bind(this),

        function applySyncFragmentsToStorage(nextCallback) {
            if (!this.hasStorage() || options.skipStorage === true) {
                return nextCallback();
            }

            this.storage.applySyncFragmentsForScope(this, syncFragments, options, function(err, results) {
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
                    var result = SyncFragment.syncFragmentResult(err);
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

                var temporalModelObject = temporalModelObjectsByUUID[syncFragment.objectUUID];
                this._applySyncFragmentProperties(syncFragment, temporalModelObject, temporalModelObjectsByUUID, function(err) {
                    if (err) {
                        // Failed applying properties for add fragment, update result
                        _.each(SyncFragment.syncFragmentResult(err), function(value, key) {
                            result[key] = value;
                        });
                        // Remove as a temporal object so related change fragments fail
                        delete temporalModelObjectsByUUID[temporalModelObject.uuid];
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

        function applyChangeSyncFragments(addResults, temporalModelObjectsByUUID, addResultsByTemporalModelObjectUUID, nextCallback) {
            async.mapSeries(syncFragments, function(syncFragment, doneCallback) {
                // Already processed add fragments
                if (syncFragment.type === SyncFragment.CONST.TYPE_ADD) {
                    doneCallback(null, addResults.shift());

                } else if (syncFragment.type === SyncFragment.CONST.TYPE_CHANGE) {
                    this._applyChangeSyncFragment(syncFragment, temporalModelObjectsByUUID, function(err) {
                        // TODO: actually call doneCallback with error if it was a persist error, 
                        // perhaps use a _commitChangeSyncFragment call instead of doing inside _applyChangeSyncFragment
                        doneCallback(null, SyncFragment.syncFragmentResult(err));
                    }.bind(this));

                } else {
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
            var temporalModelObjects = _.map(temporalModelObjectsByUUID, function(modelObject) {
                return modelObject;
            });
            async.mapSeries(temporalModelObjects, function(modelObject, doneCallback) {
                // Fail any ModelObjects we created that no longer have any parents
                var parents = modelObject.getParentRelationships();
                if (parents.length < 1) {
                    var result = addResultsByTemporalModelObjectUUID[modelObject.uuid];
                    var err = new Error('No parents, parent sync fragment failed');
                    _.each(SyncFragment.syncFragmentResult(err), function(value, key) {
                        result[key] = value;
                    });
                    return doneCallback();
                }

                // Add this and only this object to the scope
                var recursive = false;
                modelObject.setScope(this, recursive, doneCallback);

            }.bind(this), function(err) {
                if (err) {
                    return nextCallback(err);
                }
                nextCallback(null, results);
            });
        }.bind(this),

        function removeOrphanedModelObjects(results, nextCallback) {
            var orphanedModelObjects = _.map(this._orphanedModelObjects, function(modelObject) {
                return modelObject;
            });
            if (orphanedModelObjects.length < 1) {
                return nextCallback(null, results);
            }

            async.mapSeries(orphanedModelObjects, function(modelObject, doneCallback) {
                // This will remove this modelObject and in turn it will also fire 
                // the 'scopeDetach' event which will remove it from the orphaned map.
                var recursive = false;
                modelObject.setScope(null, recursive, doneCallback);

            }, function(err) {
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
            var nextArguments = this._applySyncFragmentsQueue.pop();
            process.nextTick(function() {
                this.applySyncFragments.apply(this, nextArguments);
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
            this.emit('changes', appliedFragments, options);
        }

        maybeCallback(callback)(null, results);

    }.bind(this));
};

Scope.prototype.update = function(query, update, options, callback) {
    Query.update(this, query, update, options, callback);
};

Scope.prototype._onModelObjectParentAdded = function(modelObject) {
    if (this._orphanedModelObjects.hasOwnProperty(modelObject.uuid)) {
        delete this._orphanedModelObjects[modelObject.uuid];
    }
};

Scope.prototype._onModelObjectParentRemoved = function(modelObject) {
    var count = modelObject.getParentRelationships();
    if (count < 1) {
        this._orphanedModelObjects[modelObject.uuid] = modelObject;
    }
};

Scope.prototype._onModelObjectScopeRemoved = function(modelObject, removedScope) {
    if (removedScope === this && this._orphanedModelObjects.hasOwnProperty(modelObject.uuid)) {
        delete this._orphanedModelObjects[modelObject.uuid];
    }
};

Scope.prototype._temporalModelObjectForAddSyncFragment = function(fragment, callback) {
    async.waterfall([
        function getModelObjectType(nextCallback) {
            var rootModelObjectType = this._rootModelObjectConstructor;
            var modelObjectType = rootModelObjectType.getSubtypeWithTypeName(fragment.clsName);
            if (!modelObjectType) {
                return nextCallback(new Error('No such class type \'' + fragment.clsName + '\''));
            }
            nextCallback(null, modelObjectType);
        }.bind(this),

        function createModelObject(modelObjectType, nextCallback) {
            var modelObject;
            try {
                var Type = modelObjectType;
                modelObject = new Type({uuid: fragment.objectUUID});
            } catch (err) {
                return nextCallback(err);
            }

            nextCallback(null, modelObject);
        }.bind(this)

    ], callback);
};

Scope.prototype._applySyncFragmentProperties = function(fragment, modelObject, addedModelObjectsByUUID, callback) {
    async.waterfall([
        function verifyProperties(nextCallback) {
            var options = {
                checkModelObjectsExist: {
                    scope: this,
                    lookup: addedModelObjectsByUUID
                }
            };
            fragment.verifyPropertiesForType(modelObject.constructor, options, function(err) {
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
                        async.mapSeries(value, function(objectUUID, collectionDoneCallback) {
                            var addedModelObject = addedModelObjectsByUUID[objectUUID];
                            if (addedModelObject) {
                                return collectionDoneCallback(null, addedModelObject);
                            }
                            this.persist.getModelObjectByUUID(objectUUID, collectionDoneCallback);

                        }.bind(this), function(err, foundModelObjects) {
                            if (err) {
                                return doneCallback(err);
                            }
                            modelObject[key] = foundModelObjects;
                            doneCallback();
                        });
                    } else {
                        var addedModelObject = addedModelObjectsByUUID[value];
                        if (addedModelObject) {
                            modelObject[key] = addedModelObject;
                            return doneCallback();
                        }
                        this.persist.getModelObjectByUUID(value, function(err, foundModelObject) {
                            if (err) {
                                return doneCallback(err);
                            }
                            modelObject[key] = foundModelObject;
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
