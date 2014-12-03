//
// index.js
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

var _ = require('lodash');
var Enumeration = require('./lib/enumeration');
var ModelObject = require('./lib/model_object');
var Scope = require('./lib/scope');
var Server = require('./lib/server');
var StorageMiddleware = require('./lib/middleware/storage/storage_middleware');

// Framework server constructor helper
module.exports = function(options) {
    var server = new Server(options);
    server.start();
    return server;
}

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

    storage: function(options) {
        return new StorageMiddleware(options);
    },

    // Classes
    middleware: {
        persist: {
            Memory: require('./lib/middleware/persist/memory_persist_middleware')
        },
        Storage: StorageMiddleware
    },

    transport: {
        WebsocketTransport: require('./lib/transport/websocket_transport'),
        SyntheticTransport: require('./lib/transport/synthetic_transport'),
        SyntheticConnection: require('./lib/transport/synthetic_connection')
    },

    ModelObject: ModelObject,
    Scope: Scope,

    // Shared instances
    logger: require('./lib/logger')
});
