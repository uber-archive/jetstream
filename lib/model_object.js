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

module.exports = ModelObject;

var _ = require('lodash');
var async = require('async');
var callbackOrEmitError = require('callback-or-emit-error');
var Collection = require('./collection');
var Err = require('rust-result').Err;
var EventEmitter = require('events').EventEmitter;
var logger = require('./logger');
var maybeCallback = require('maybe-callback');
var ModelObjectProperty = require('./model_object_property');
var Ok = require('rust-result').Ok;
var ParentRelationship = require('./parent_relationship');
var Result = require('rust-result').Result;
var Scope = require('./scope');
var SyncFragment = require('./sync_fragment');
var SyncProcedure = require('./procedures/sync_procedure');
var util = require('util');
var uuid = require('node-uuid');

var debug = logger.debug.bind(logger, 'core:modelObject');

function ModelObject(options) {
    options = options || {};

    if (typeof options.uuid === 'string') {
        this.uuid = options.uuid;
    } else {
        this.uuid = uuid.v4();
    }

    this.scope = options.scope instanceof Scope ? options.scope : null;
    this.isScopeRoot = false;
    this._resolvedProperties = null;
    this._resolvedPropertiesLookup = null;
    this._resolvedProceduresLookup = null;
    this._parentRelationships = [];
    this._parentRelationshipsByParentUUID = {};

    this._setPropertyDefaultValues();
}

util.inherits(ModelObject, EventEmitter);

ModelObject.baseType = ModelObject;
ModelObject.typeName = 'ModelObject';
ModelObject.prototype.typeName = 'ModelObject';
ModelObject._supertypeByTypeName = {};
ModelObject._subtypesByTypeName = {};
ModelObject._propertiesByTypeName = {};
ModelObject._propertiesByTypeName[ModelObject.typeName] = [];
ModelObject._propertiesLookupByTypeName = {};
ModelObject._propertiesLookupByTypeName[ModelObject.typeName] = {};
ModelObject._proceduresLookupByTypeName = {};
ModelObject._proceduresLookupByTypeName[ModelObject.typeName] = {};
ModelObject._remoteProcedureTypesByName = {};


ModelObject.isChildClass = function(cls) {
    if (!cls || !cls.baseType) {
        return false;
    }

    return cls.baseType === this.baseType;
};

ModelObject.model = function(name, definition, methods) {
    if (typeof name !== 'string') {
        throw new Error('Invalid model name');
    }

    // Methods being passed and definition left out
    if (typeof definition === 'object') {
        methods = definition;
        definition = undefined;
    }

    // Inherit from ModelObject
    var typeClass = function() {
        ModelObject.apply(this, arguments);
    };
    util.inherits(typeClass, ModelObject);
    Object.keys(ModelObject).forEach(function(key) {
        var value = ModelObject[key];
        if (typeof value === 'function') {
            typeClass[key] = value.bind(typeClass);
        } else {
            typeClass[key] = value;
        }
    });
    typeClass.baseType = ModelObject;
    typeClass._inheritedChildren = [];

    // Set any instance methods
    if (typeof methods === 'object') {
        Object.keys(methods).forEach(function(key) {
            typeClass.prototype[key] = methods[key];
        });
    }

    // Set the type properties
    typeClass.typeName = name;
    typeClass.prototype.typeName = name;
    typeClass._setProperties([]);
    typeClass._setPropertiesLookup({});
    typeClass._setProceduresLookup({});

    // Inherit from supertype if required
    if (this !== ModelObject) {
        typeClass.inherit(this);
    }

    // Call inline definition if passed
    if (typeof definition === 'function') {
        definition.call(typeClass);
    }

    return typeClass;
};

ModelObject.inherit = function(supertype) {
    if (!ModelObject.isChildClass(supertype)) {
        throw new Error('Can only extend from ModelObject');
    }

    if (supertype === ModelObject) {
        throw new Error('All models already inherit from ModelObject');
    }

    if (!(this instanceof supertype)) {
        util.inherits(this, supertype);

        // Reset newly overriden prototype.typeName
        this.prototype.typeName = this.typeName;

        // Child classes need to inherit parent values but have own copy
        supertype._getProperties().forEach(function(property) {
            this._addProperty(property);
        }.bind(this));

        // Track as inherited child on the class to get new properties
        supertype._inheritedChildren.push(this);
    }
};

ModelObject.has = function(propertyName, propertyType, options) {
    options = options || {};
    options.name = propertyName;
    options.type = propertyType;

    var property = new ModelObjectProperty(options);

    this._addProperty(property);
};

ModelObject.defineProcedure = function(procedureName, options) {
    options = options || {};
    options.name = procedureName;

    if (typeof options.name !== 'string') {
        throw new Error('Requires name');
    }

    var lookup = this._getProceduresLookup();
    if (lookup.hasOwnProperty(procedureName)) {
        throw new Error('Procedure \'' + procedureName + '\' already exists');
    }

    if (options.hasOwnProperty('remote')) {
        if (!options.remote || typeof options.remote.type !== 'string') {
            throw new Error('Procedure \'' + procedureName + '\' has no remote type set');
        }

        var remoteType = options.remote.type;
        if (!ModelObject._remoteProcedureTypesByName.hasOwnProperty(remoteType)) {
            throw new Error('Procedure \'' + procedureName + '\' has unknown remote type \'' + remoteType + '\'');
        }

        var RemoteSyncProcedure = ModelObject._remoteProcedureTypesByName[remoteType];
        lookup[procedureName] = new RemoteSyncProcedure(options);
    } else {
        lookup[procedureName] = new SyncProcedure(options);
    }
};

ModelObject.getProperties = function() {
    return this._getProperties();
};

ModelObject.getProperty = function(propertyName) {
    var lookup = this._getPropertiesLookup();
    return lookup[propertyName];
};

ModelObject.getProcedure = function(procedureName) {
    var lookup = this._getProceduresLookup();
    return lookup[procedureName];
};

ModelObject.getChildClassWithTypeName = function(typeName) {
    var result;
    _.each(this._inheritedChildren, function(typeClass) {
        if (typeName === typeClass.typeName) {
            result = Ok(typeClass);
            return false;
        }
        var childTypeClass = typeClass.getChildClassWithTypeName(typeName);
        if (Ok(childTypeClass)) {
            result = childTypeClass;
            return false;
        }
    });
    if (result instanceof Result) {
        return result;
    }
    return Err(new Error('No child class found'));
};

ModelObject.getAllChildClasses = function() {
    var result = [];
    _.each(this._inheritedChildren, function(typeClass) {
        result.push(typeClass);
        result = result.concat(typeClass.getAllChildClasses());
    });
    return result;
};

ModelObject.getSubtypeWithTypeName = function(typeName) {
    return ModelObject._subtypesByTypeName[this.typeName][typeName];
};

ModelObject.registerRemoteProcedureType = function(name, type) {
    if (typeof name !== 'string') {
        throw new Error('Requires name');
    }
    SyncProcedure.validateSyncProcedureTypeOrThrow(type);

    if (ModelObject._remoteProcedureTypesByName.hasOwnProperty(name)) {
        throw new Error('Already registered remote procedure type \'' + name + '\'');
    }

    ModelObject._remoteProcedureTypesByName[name] = type;
};

ModelObject._addSubtype = function(typeClass) {
    if (!this._subtypesByTypeName.hasOwnProperty(this.typeName)) {
        this._subtypesByTypeName[this.typeName] = {};
    }
    if (!this._subtypesByTypeName[this.typeName].hasOwnProperty(typeClass.typeName)) {
        this._subtypesByTypeName[this.typeName][typeClass.typeName] = typeClass;

        // Add all of the subtype's children subtypes as well
        typeClass._getSubtypes().forEach(this._addSubtype.bind(this));
    }
    var supertype = this._getSupertype();
    if (supertype) {
        supertype._addSubtype(typeClass);
    }
};

ModelObject._getSubtypes = function() {
    var subtypesLookup = ModelObject._subtypesByTypeName[this.typeName];
    if (!subtypesLookup) {
        return [];
    }

    var subtypes = [];
    Object.keys(subtypesLookup).forEach(function(key) {
        subtypes.push(subtypesLookup[key]);
    });
    return subtypes;
};

ModelObject._setSupertype = function(supertype) {
    ModelObject._supertypeByTypeName[this.typeName] = supertype;
};

ModelObject._getSupertype = function() {
    return ModelObject._supertypeByTypeName[this.typeName];
};

ModelObject._setProperties = function(properties) {
    ModelObject._propertiesByTypeName[this.typeName] = properties;
};

ModelObject._getProperties = function() {
    return ModelObject._propertiesByTypeName[this.typeName];
};

ModelObject._setPropertiesLookup = function(propertiesLookup) {
    ModelObject._propertiesLookupByTypeName[this.typeName] = propertiesLookup;
};

ModelObject._getPropertiesLookup = function() {
    return ModelObject._propertiesLookupByTypeName[this.typeName];
};

ModelObject._setProceduresLookup = function(procedures) {
    ModelObject._proceduresLookupByTypeName[this.typeName] = procedures;
};

ModelObject._getProceduresLookup = function() {
    return ModelObject._proceduresLookupByTypeName[this.typeName];
};

ModelObject._addProperty = function(property) {
    var propertiesLookup = this._getPropertiesLookup();
    if (propertiesLookup.hasOwnProperty(property.name)) {
        throw new Error('Property \'' + property.name + '\' already exists');
    }

    this._getProperties().push(property);
    propertiesLookup[property.name] = property;

    if (Array.isArray(property.type)) {
        this._initCollectionProperty(property);
    } else {
        this._initValueProperty(property);
    }

    if (property.isModelObjectType) {
        this._addSubtype(property.singleType);
    }

    // If this is a late added property then ensure children add this property too
    this._inheritedChildren.forEach(function(inheritedChild) {
        inheritedChild._addProperty(property);
    });
};

ModelObject._initCollectionProperty = function(property) {
    Object.defineProperty(this.prototype, property.name, {
        configurable: false,
        enumerable: true,
        get: function() {
            return this[property.key];
        },
        set: function(newValue) {
            if (!Array.isArray(newValue)) {
                debug('Bad non-array value for property \'' + property.name + '\'');
                return this[property.key];
            }

            var newArray;
            try {
                newArray = this[property.key].setAsArray(newValue);
            } catch(err) {
                debug(err.message);
                return this[property.key];
            }

            return this[property.key];
        }
    });
};

ModelObject._initValueProperty = function(property) {
    Object.defineProperty(this.prototype, property.name, {
        configurable: false,
        enumerable: true,
        get: function() {
            return this[property.key];
        },
        set: function(newValue) {
            if (newValue === this[property.key]) {
                return;
            }

            try {
                newValue = ModelObjectProperty.filterValueForPropertyOrThrow(newValue, property);
            } catch(err) {
                debug(err.message);
                return this[property.key];
            }

            var oldValue = this[property.key];
            if (property.isModelObjectType && oldValue) {
                oldValue._removeParent(this, property.name);
            }

            if (property.isModelObjectType && newValue) {
                newValue._addParent(this, property.name);
            }

            this[property.key] = newValue;

            return this[property.key];
        }
    });
};

ModelObject.prototype._setPropertyDefaultValues = function() {
    this.getProperties().forEach(function(property) {
        if (property.isCollectionType) {
            this[property.key] = new Collection({
                property: property,
                owningModelObject: this
            });
        } else {
            this[property.key] = property.defaultValue;
        }
    }.bind(this));
};

ModelObject.prototype._addParent = function(parent, key) {
    if (!(parent instanceof ModelObject) || typeof key !== 'string') {
        throw new Error('Invalid parent or key');
    }
    if (parent.scope && this.scope && this.scope !== parent.scope) {
        throw new Error('Cannot add parent with differing scope');
    }

    var parentRelationship = new ParentRelationship({
        parent: parent,
        key: key
    });

    if (!this._parentRelationshipsByParentUUID.hasOwnProperty(parent.uuid)) {
        this._parentRelationshipsByParentUUID[parent.uuid] = {};
    }
    if (!this._parentRelationshipsByParentUUID[parent.uuid].hasOwnProperty(key)) {
        this._parentRelationships.push(parentRelationship);
        this._parentRelationshipsByParentUUID[parent.uuid][key] = parentRelationship;
    }

    this.emit('parent', this, parentRelationship);
};

ModelObject.prototype._removeParent = function(parent, key) {
    if (!(parent instanceof ModelObject) || typeof key !== 'string') {
        throw new Error('Invalid parent or key');
    }

    if (!this._parentRelationshipsByParentUUID.hasOwnProperty(parent.uuid)) {
        throw new Error('No such parent');
    }
    if (!this._parentRelationshipsByParentUUID[parent.uuid].hasOwnProperty(key)) {
        throw new Error('No such parent on key');
    }

    var parentRelationship = this._parentRelationshipsByParentUUID[parent.uuid][key];
    var array = this._parentRelationships;
    array.splice(array.indexOf(parentRelationship), 1);

    delete this._parentRelationshipsByParentUUID[parent.uuid][key];
    if (Object.keys(this._parentRelationshipsByParentUUID[parent.uuid]).length === 0) {
        delete this._parentRelationshipsByParentUUID[parent.uuid];
    }

    this.emit('parentDetach', this, parentRelationship);
};

ModelObject.prototype.setScope = function(scope, recursive, callback) {
    if (typeof recursive === 'function') {
        callback = recursive;
        recursive = true;
    }

    if (this.scope === scope) {
        return maybeCallback(callback)();
    }

    var oldScope = this.scope;

    async.series([
        function removeFromCurrentScope(nextCallback) {
            if (!oldScope) {
                return nextCallback();
            }

            oldScope.removeModelObject(this, function(err) {
                if (err) {
                    return nextCallback(err);
                }

                this.emit('scopeDetach', this, oldScope);
                nextCallback();
            }.bind(this));
        }.bind(this),

        function addModelObjectToScope(nextCallback) {
            if (!scope) {
                return nextCallback();
            }

            scope.containsModelObject(this, function(err, result) {
                if (err) {
                    return nextCallback(err);
                }

                if (result) {
                    // For setting root scope ModelObject we add it 
                    // before setting scope of this ModelObject
                    return nextCallback();
                } else {
                    scope.addModelObject(this, nextCallback);
                }
            }.bind(this));
        }.bind(this),

    ], function scopeAttached(err) {
        if (err){
            return callbackOrEmitError(this, callback, err);
        }

        this.scope = scope;
        this.emit('scope', this, scope);

        this.getChildModelObjects(function(err, childModelObjects) {
            if (err) {
                return callbackOrEmitError(this, callback, err);
            }

            if (recursive) {
                async.each(childModelObjects, function(modelObject, doneCallback) {
                    modelObject.setScope(scope, recursive, doneCallback);
                }, function(err) {
                    if (err) {
                        return callbackOrEmitError(this, callback, err);
                    }

                    maybeCallback(callback)();
                }.bind(this));
            } else {
                maybeCallback(callback)();
            }
        }.bind(this));
    }.bind(this));
};

ModelObject.prototype.setIsScopeRoot = function(isScopeRoot, callback) {
    isScopeRoot = Boolean(isScopeRoot);

    if (this.isScopeRoot !== isScopeRoot) {
        if (!isScopeRoot) {
            this.setScope(null, function(err) {
                if (err) {
                    return callbackOrEmitError(this, callback, err);
                }   

                this.isScopeRoot = false;
                maybeCallback(callback)();
            }.bind(this));
        } else {
            var scope = new Scope({
                name: this.typeName
            });
            this.setScopeAndMakeRootModel(scope, function(err) {
                if (err) {
                    debug('setting ModelObject as scope root failed', err);
                    return callbackOrEmitError(this, callback, err);
                }

                maybeCallback(callback)(null, scope);
            }.bind(this));
        } 
    } else {
        maybeCallback(callback)(null, this.scope);
    }
};

ModelObject.prototype.setScopeAndMakeRootModel = function(scope, callback) {
    scope.addModelObjectAsRootModelObject(this, function(err) {
        if (err) {
            debug('setting ModelObject as root for scope failed', err);
            return callbackOrEmitError(this, callback, err);
        }

        this.setScope(scope, function(err) {
            if (err) {
                return callbackOrEmitError(this, callback, err);
            }   

            this.isScopeRoot = true;
            maybeCallback(callback)();
        }.bind(this));
    }.bind(this));
};

ModelObject.prototype.getChildModelObjectUUIDs = function() {
    var uuids = [];
    this.getProperties().forEach(function(property) {
        if (property.isModelObjectType) {
            if (property.isCollectionType) {
                this[property.name].forEach(function(modelObject) {
                    uuids.push(modelObject.uuid);
                });
            } else  {
                var modelObject = this[property.name];
                if (modelObject) {
                    uuids.push(this[property.name].uuid);
                }
            }
        }
    }.bind(this));
    return uuids;
};

ModelObject.prototype.getChildModelObjects = function(callback) {
    var results = [];
    async.each(this.getProperties(), function(property, doneCallback) {
        if (!property.isModelObjectType) {
            return doneCallback();
        }

        if (property.isCollectionType) {
            // Prepare the splice
            var args = [results.length, 0].concat(this[property.name].slice(0));
            // Splice results in
            results.splice.apply(results, args);
        } else if (this[property.name]) {
            results.push(this[property.name]);
        }

        doneCallback();

    }.bind(this), function(err) {
        if (err) {
            return callback(err);
        }

        callback(null, results);
    });
};

ModelObject.prototype.getTreeModelObjects = function(callback) {
    var exploredModelObjectsByUUID = {};
    return getRecursively(this, callback);

    function getRecursively(modelObject, doneCallback) {
        if (exploredModelObjectsByUUID.hasOwnProperty(modelObject.uuid)) {
            return doneCallback(null, []);
        }
        exploredModelObjectsByUUID[modelObject.uuid] = true;

        var results = [modelObject];
        modelObject.getChildModelObjects(function(err, modelObjects) {
            if (err) {
                return doneCallback(err);
            }

            if (modelObjects.length === 0) {
                return doneCallback(null, results);
            }

            async.map(modelObjects, getRecursively, function(err, modelObjectArrays) {
                if (err) {
                    return doneCallback(err);
                }

                if (modelObjectArrays.length > 0) {
                    modelObjectArrays.forEach(function(modelObjects) {
                        if (modelObjects.length > 0) {
                            results = results.concat(modelObjects);
                        }
                    });
                }

                doneCallback(null, results);
            });
        });
    }
};

ModelObject.prototype.getValues = function() {
    var results = {};
    this.getProperties().forEach(function(property) {
        if (!property.isModelObjectType) {
            if (property.isCollectionType) {
                results[property.name] = this[property.name].slice(0);
            } else {
                results[property.name] = this[property.name];
            }
        } else {
            if (property.isCollectionType) {
                results[property.name] = this[property.name].map(function(modelObject) {
                    return modelObject.uuid;
                });
            } else {
                var modelObject = this[property.name];
                if (modelObject) {
                    results[property.name] = modelObject.uuid;
                }
            }
        }
    }.bind(this));
    return results;
};

ModelObject.prototype.getAddSyncFragment = function() {
    return new SyncFragment({
        type: 'add',
        modelObject: this,
        properties: this.getValues()
    });
};

ModelObject.prototype.getProperty = function(propertyName) {
    if (!this._resolvedPropertiesLookup) {
        this._resolvedPropertiesLookup = ModelObject._getPropertiesLookup.call(this);
    }
    return this._resolvedPropertiesLookup[propertyName];
};

ModelObject.prototype.getProperties = function() {
    if (!this._resolvedProperties) {
        this._resolvedProperties = ModelObject._getProperties.call(this);
    }
    // Return a shallow copy to preserve integrity
    return this._resolvedProperties.concat();
};

ModelObject.prototype.getProcedure = function(procedureName) {
    if (!this._resolvedProceduresLookup) {
        this._resolvedProceduresLookup = ModelObject._getProceduresLookup.call(this);
    }
    return this._resolvedProceduresLookup[procedureName];
};

ModelObject.prototype.getParentRelationships = function() {
    // Return a shallow copy to preserve integrity
    return this._parentRelationships.concat();
};
