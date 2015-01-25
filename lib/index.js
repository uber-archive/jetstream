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

var _ = require('lodash');
var ArrayPropertyConstraint = require('./procedures/array_property_constraint');
var Enumeration = require('./enumeration');
var Expression = require('./query/expression');
var HasNewValuePropertyConstraint = require('./procedures/has_new_value_property_constraint');
var ModelObject = require('./model_object');
var RemoteHttpSyncProcedure = require('./procedures/remote_http_sync_procedure');
var Repl = require('./repl');
var rustResult = require('rust-result');
var Scope = require('./scope');
var Server = require('./server');
var StorageMiddleware = require('./middleware/storage/storage_middleware');

// Framework server constructor helper
module.exports = function(options) {
    var server = new Server(options);
    server.start();
    return server;
};

// Register bundled remote procedures
ModelObject.registerRemoteProcedureType('http', RemoteHttpSyncProcedure);

// Export useful parts of the library
module.exports = _.extend(module.exports, {
    // Framework methods
    enumeration: function(name, type, values) {
        return Enumeration.type(name, type, values);
    },

    model: function(name, definition) {
        return ModelObject.model(name, definition);
    },

    scope: function(options) {
        return new Scope(options);
    },

    expr: function(expressionValue, options) {
        options = options || {};
        options = _.extend({value: expressionValue}, options);
        return new Expression(options);
    },

    hasNewValuePropertyConstraint: function(options) {
        return new HasNewValuePropertyConstraint(options);
    },

    arrayPropertyConstraint: function(options) {
        return new ArrayPropertyConstraint(options);
    },

    storage: function(options) {
        return new StorageMiddleware(options);
    },

    enableRepl: function(options) {
        Repl.enable(options);
    },

    // Classes
    middleware: {
        persist: {
            Memory: require('./middleware/persist/memory_persist_middleware')
        },
        Storage: StorageMiddleware
    },

    transport: {
        WebsocketTransport: require('./transport/websocket_transport'),
        SyntheticTransport: require('./transport/synthetic_transport'),
        SyntheticConnection: require('./transport/synthetic_connection')
    },

    ModelObject: ModelObject,
    Scope: Scope,

    // Shared instances
    logger: require('./logger'),

    // For external library to test rust-result values
    Ok: rustResult.Ok,
    Err: rustResult.Err,
    Result: rustResult.Result
});
