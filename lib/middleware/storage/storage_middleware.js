//
// storage_middleware.js
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

module.exports = StorageMiddleware;

var _ = require('lodash');
var async = require('async');
var deepequal = require('deepequal');
var Errors = require('../../errors');
var StorageWriteConcern = require('./storage_write_concern');
var SyncFragment = require('../../sync_fragment');

var CONST = {};
CONST.DEFAULT_WRITE_CONCERN_ACCEPT = 'accept';
CONST.DEFAULT_WRITE_CONCERN_DENY = 'deny';
CONST.DEFAULT_WRITE_CONCERNS = [
    CONST.DEFAULT_WRITE_CONCERN_ACCEPT,
    CONST.DEFAULT_WRITE_CONCERN_DENY
];
CONST = Object.freeze(CONST);

function StorageMiddleware() {
    this._rootModelObjectLoaderByScopeName = {};
    this._defaultRootModelObjectLoader = null;
    this._syncFragmentWriterByScopeName = {};
    this._defaultSyncFragmentWriter = null;
    this._defaultWriteConcernByScopeName = {};
    this._defaultWriteConcern = CONST.DEFAULT_WRITE_CONCERN_DENY;
    this._writeConcernsByScopeName = {};
    this._writeConcernByTriggerLookupByScopeName = {};
}

StorageMiddleware.CONST = CONST;

/**
 * Register a storage loader to load a root ModelObject for all scopes by a given name.
 * For further details see the wiki documentation.
 *
 * @param scopeName {String} Name of scope to load with this loader
 * @param loader {Function} Loader method is passed the following arguments:
 *   @param scope {Scope} The scope to fetch the root model for
 *   @param callback {Function} The callback, will be called back with:
 *     @param error {Error} If error should be the error or null
 *     @param fetchedRootModelObject {ModelObject} The fetched root model object on success
 */
StorageMiddleware.prototype.registerRootModelObjectLoaderForScope = function(scopeName, loader) {
    if (typeof scopeName !== 'string') {
        throw new Error('Scope name should be a string');
    }
    if (typeof loader !== 'function') {
        throw new Error('Loader should be a method');
    }
    this._rootModelObjectLoaderByScopeName[scopeName] = loader;
};

/**
 * Register a storage loader to load a root ModelObject for any scope without a 
 * loader registered by name.
 * For further details see the wiki documentation.
 *
 * @param loader {Function} Loader method is passed the following arguments:
 *   @param scope {Scope} The scope to fetch the root model for
 *   @param callback {Function} The callback, will be called back with:
 *     @param error {Error} If error should be the error or null
 *     @param fetchedRootModelObject {ModelObject} The fetched root model object on success
 */
StorageMiddleware.prototype.registerRootModelObjectLoader = function(loader) {
    if (typeof loader !== 'function') {
        throw new Error('Loader should be a method');
    }
    this._defaultRootModelObjectLoader = loader;
};

/** 
 * Register a SyncFragments writer to validate and accept or deny changes with 
 * SyncFragments for all scopes by a given name.
 * For further details see the wiki documentation.
 * 
 * @param scopeName {String} Name of scope to write sync fragments for
 * @param writer {Function} Writer method is passed the following arguments:
 *   @param scope {Scope} The scope to apply the sync fragments for
 *   @param syncFragments {Array} An array of {SyncFragment}s requested to apply
 *   @param callback {Function} The callback, will be called with:
 *     @param error {Error} If error should be the error or null
 *     @param results {Array} An array of {Object} describing the result for each {SyncFragment}
 */
StorageMiddleware.prototype.registerSyncFragmentsWriterForScope = function(scopeName, writer) {
    if (typeof scopeName !== 'string') {
        throw new Error('Scope name should be a string');
    }
    if (typeof writer !== 'function') {
        throw new Error('Writer should be a method');
    }
    this._syncFragmentWriterByScopeName[scopeName] = loader;
};

/** 
 * Register a SyncFragments writer to validate and accept or deny changes with 
 * SyncFragments for any scope without a writer registered by name.
 * For further details see the wiki documentation.
 * 
 * @param writer {Function} Writer method is passed the following arguments:
 *   @param scope {Scope} The scope to apply the sync fragments for
 *   @param syncFragments {Array} An array of {SyncFragment}s requested to apply
 *   @param callback {Function} The callback, will be called with:
 *     @param error {Error} If error should be the error or null
 *     @param results {Array} An array of {Object} describing the result for each {SyncFragment}
 */
StorageMiddleware.prototype.registerSyncFragmentsWriter = function(writer) {
    if (typeof writer !== 'function') {
        throw new Error('Writer should be a method');
    }
    this._defaultSyncFragmentWriter = loader;
};

/** 
 * Register a default write concern strategy to fall back on if no write concern 
 * matches a set of SyncFragments for all scopes by a given name.
 *
 * @param scopeName {String} Name of scope to set default write concern for
 * @param defaultWriteConcern {String} The default write concern strategy to apply
 */
StorageMiddleware.prototype.registerDefaultWriteConcernForScope = function(scopeName, defaultWriteConcern) {
    if (typeof scopeName !== 'string') {
        throw new Error('Scope name should be a string');
    }
    if (CONST.DEFAULT_WRITE_CONCERNS.indexOf(defaultWriteConcern) === -1) {
        throw new Error(
            'Invalid default write concern, should be one of: ' + 
            CONST.DEFAULT_WRITE_CONCERNS.join(', '));
    }
    this._defaultWriteConcernByScopeName[scopeName] = defaultWriteConcern;
};

/** 
 * Register a default write concern strategy to fall back on if no write concern 
 * matches a set of SyncFragments for any scope without a default default write concern.
 *
 * @param defaultWriteConcern {String} The default write concern strategy to apply
 */
StorageMiddleware.prototype.registerDefaultWriteConcern = function(defaultWriteConcern) {
    if (CONST.DEFAULT_WRITE_CONCERNS.indexOf(defaultWriteConcern) === -1) {
        throw new Error(
            'Invalid default write concern, should be one of: ' + 
            CONST.DEFAULT_WRITE_CONCERNS.join(', '));
    }
    this._defaultWriteConcern = defaultWriteConcern;
};

/** 
 * Register a write concern for all scopes by a given name.
 * For further details see the wiki documentation.
 *
 * @param scopeName {String} Name of scope to set write concern for
 * @param options {Object} The write concern strategy to apply
 */
StorageMiddleware.prototype.registerWriteConcernForScope = function(scopeName, options) {
    if (typeof scopeName !== 'string') {
        throw new Error('Scope name should be a string');
    }
    var writeConcern = new StorageWriteConcern(options);

    // Lazy create the write concern trigger lookup
    var writeConcernByTriggerLookup = this._writeConcernByTriggerLookupByScopeName[scopeName];
    if (this._writeConcernByTriggerLookupByScopeName.hasOwnProperty(scopeName)) {
        writeConcernByTriggerLookup = this._writeConcernByTriggerLookupByScopeName[scopeName];
    } else {
        writeConcernByTriggerLookup = {};
        this._writeConcernByTriggerLookupByScopeName[scopeName] = writeConcernByTriggerLookup;
    }

    // Verify no other write concerns have taken these properties
    var writeConcernByPropertyLookup = writeConcernByTriggerLookup[writeConcern.triggerKey];
    if (writeConcernByPropertyLookup) {
        writeConcern.when.forEach(function(propertyName) {
            if (writeConcernByPropertyLookup.hasOwnProperty(propertyName)) {
                if (!writeConcern.constrain.hasOwnProperty(propertyName)) {
                    // Already conflicts with the existing concern as it has no constrain
                    throw new Error(
                        'Type \'' + writeConcern.clsName + '\' with change type \'' + writeConcern.type +
                        '\' already has write concern with property \'' + propertyName + '\' ' +
                        'and this concern has no constrain value to differentiate it');
                }

                var constrain = writeConcern.constrain[propertyName];
                var existing = writeConcernByPropertyLookup[propertyName];
                existing.forEach(function(existingWriteConcern) {
                    if (!existingWriteConcern.constrain.hasOwnProperty(propertyName)) {
                        // Conflicts with the existing concern as the existing concern has no constrain
                        throw new Error(
                            'Type \'' + writeConcern.clsName + '\' with change type \'' + writeConcern.type +
                            '\' already has write concern with property \'' + propertyName + '\' ' +
                            'that has no constrain value and cannot differentiate between the existing ' +
                            'or this concern');
                    } else {
                        var existingConstrain = existingWriteConcern.constrain[propertyName];
                        if (deepequal(contstrain, existingConstrain)) {
                            // Conflicts with the existing concern
                            throw new Error(
                                'Type \'' + writeConcern.clsName + '\' with change type \'' + writeConcern.type +
                                '\' already has write concern with property \'' + propertyName + '\' ' +
                                'that has exact same constrain value');
                        }
                    }
                });
            }
        });
    } else {
        writeConcernByPropertyLookup = {};
        writeConcernByTriggerLookup[writeConcern.triggerKey] = writeConcernByPropertyLookup;
    }

    // Insert the non-conflicting write concern
    writeConcern.when.forEach(function(propertyName) {
        if (writeConcernByPropertyLookup.hasOwnProperty(propertyName)) {
            writeConcernByPropertyLookup[propertyName].push(writeConcern);
        } else {
            writeConcernByPropertyLookup[propertyName] = [];
        }
    });

    // Record into by scope name data structure for later inspection/debugging
    if (this._writeConcernsByScopeName.hasOwnProperty(scopeName)) {
        this._writeConcernsByScopeName[scopeName].push(writeConcern);
    } else {
        this._writeConcernsByScopeName[scopeName] = [writeConcern];
    }
};

StorageMiddleware.prototype.fetchRootModelObjectForScope = function(scope, callback) {
    var loader;
    if (this._rootModelObjectLoaderByScopeName.hasOwnProperty(scope.name)) {
        loader = this._rootModelObjectLoaderByScopeName[scope.name];
    } else {
        loader = this._defaultRootModelObjectLoader;
    }

    if (loader) {
        return loader(scope, callback);
    }

    callback(new Error('No registered loader for scope'));
};

StorageMiddleware.prototype.applySyncFragmentsForScope = function(scope, syncFragments, callback) {
    var writer;
    if (this._syncFragmentWriterByScopeName.hasOwnProperty(scope.name)) {
        writer = this._syncFragmentWriterByScopeName[scope.name];
    } else {
        writer = this._defaultSyncFragmentWriter;
    }

    if (writer) {
        return writer(scope, syncFragments, callback);
    }

    // TODO: apply write concerns for individual fragments instead of always falling 
    // back to the default write concern for this scope

    return async.map(syncFragments, function(fragment, doneCallback) {
        this._applySyncFragmentWithDefaultStrategy(scope, fragment, doneCallback);
    }.bind(this), callback);
};

StorageMiddleware.prototype._applySyncFragmentWithDefaultStrategy = function(scope, syncFragment, callback) {
    var defaultWriteConcern;
    if (this._defaultWriteConcernByScopeName.hasOwnProperty(scope.name)) {
        defaultWriteConcern = this._defaultWriteConcernByScopeName[scope.name];
    } else {
        defaultWriteConcern = this._defaultWriteConcern;
    }

    if (defaultWriteConcern === CONST.DEFAULT_WRITE_CONCERN_ACCEPT) {
        callback(null, SyncFragment.syncFragmentResult());
    } else {
        var err = new Error(
            'The default write concern for scope named \'' + scope.name + 
            '\' is not to accept writes');
        return callback(null, SyncFragment.syncFragmentResult(err));
    }
};
