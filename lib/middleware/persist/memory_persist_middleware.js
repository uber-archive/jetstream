//
// memory_persist_middleware.js
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
'use strict';

module.exports = MemoryPersistMiddleware;

var _ = require('lodash');
var AbstractPersistMiddleware = require('./abstract_persist_middleware');
var callbackOrEmitError = require('callback-or-emit-error');
var maybeCallback = require('maybe-callback');
var util = require('util');

function MemoryPersistMiddleware() {
    this._modelObjects = [];
    this._modelObjectsByUUID = {};
}

util.inherits(MemoryPersistMiddleware, AbstractPersistMiddleware);

MemoryPersistMiddleware.prototype.addModelObject = function(modelObject, callback) {
    if (this._modelObjects.indexOf(modelObject) !== -1) {
        return callbackOrEmitError(this, callback, new Error('modelObject already exists'));
    }

    this._modelObjects.push(modelObject);
    this._modelObjectsByUUID[modelObject.uuid] = modelObject;

    maybeCallback(callback)();
};

MemoryPersistMiddleware.prototype.removeModelObject = function(modelObject, callback) {
    if (this._modelObjects.indexOf(modelObject) === -1) {
        return callbackOrEmitError(this, callback, new Error('modelObject does not exist'));
    }

    this._modelObjects = _.without(this._modelObjects, modelObject);
    delete this._modelObjectsByUUID[modelObject.uuid];

    maybeCallback(callback)();
};

MemoryPersistMiddleware.prototype.updateModelObject = function(modelObject, callback) {
    if (!this._modelObjectsByUUID.hasOwnProperty(modelObject.uuid)) {
        return callbackOrEmitError(this, callback, new Error('modelObject does not exist'));
    }

    // No-op, we already have this model object in 
    // memory and any updates were already applied
    maybeCallback(callback)();
};

MemoryPersistMiddleware.prototype.containsModelObjectWithUUID = function(uuid, callback) {
    callback(null, Boolean(this._modelObjectsByUUID[uuid]));
};

MemoryPersistMiddleware.prototype.getModelObjectByUUID = function(uuid, callback) {
    callback(null, this._modelObjectsByUUID[uuid]);
};

MemoryPersistMiddleware.prototype.getModelObjectsByUUIDs = function(uuids, callback) {
    var err;
    var results = new Array(uuids.length);
    uuids.forEach(function(uuid) {
        if (err) {
            return;
        }
        var modelObject = this._modelObjectsByUUID[uuid];
        if (!modelObject) {
            err = new Error('\'' + uuid + '\' not found');
            return;
        }
        results.push(modelObject);
    }.bind(this));

    if (err) {
        return callback(err);
    }
    callback(null, results);
};
