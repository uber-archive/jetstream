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

module.exports = Query;

var _ = require('lodash');
var async = require('async');
var PullQueryOperation = require('./pull_query_operation');
var PushQueryOperation = require('./push_query_operation');
var QueryResult = require('./query_result');
var Scope = require('../scope');
var SetQueryOperation = require('./set_query_operation');

var CONST = {};
CONST.OPERATOR_PUSH = '$push';
CONST.OPERATOR_PULL = '$pull';
CONST.OPERATOR_SET = '$set';
CONST = Object.freeze(CONST);

function Query() {
    // Static class
}

Query.CONST = CONST;

Query.update = function(scope, query, update, options, callback) {
    // Options argument is optional
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    if (!(scope instanceof Scope)) {
        throw new Error('Requires scope to be a valid scope');
    }
    if (typeof callback !== 'function') {
        throw new Error('Requires callback as function');
    }
    if (typeof query !== 'object' && query !== null) {
        return callback(new Error('Requires query as update object or null'));
    }
    if (typeof update !== 'object') {
        return callback(new Error('Requires update as update object'));
    }
    if (typeof options !== 'object') {
        return callback(new Error('Requires options as object'));
    }

    async.waterfall([
        // Currently we only support looking up the root object 
        // (null or empty query) and by the UUID and class of the ModelObject.
        function findModelObjectByQuery(nextCallback) {
            var keys = query ? Object.keys(query) : [];
            if (keys.length < 1) {
                return scope.getRootModelObject(function(err, modelObject) {
                    if (err || !modelObject) {
                        return nextCallback(err || new Error('No root ModelObject for scope'));
                    }
                    nextCallback(null, modelObject);
                });
            }
            if (keys.length !== 2 || typeof query.$uuid !== 'string' || typeof query.$cls !== 'string') {
                return nextCallback(new Error('Supports only updating by root or $uuid and $cls'));
            }
            scope.getModelObjectByUUID(query.$uuid, function(err, modelObject) {
                if (err) {
                    return nextCallback(err);
                }
                if (modelObject && query.$cls !== modelObject.typeName) {
                    return nextCallback(
                        new Error('ModelObject with uuid \'' + query.$uuid + 
                            '\' has type name \'' + modelObject.typeName + 
                            '\' and does not match $cls \'' + query.$cls + '\''));
                }
                nextCallback(null, modelObject);
            });
        },

        function parseUpdates(modelObject, nextCallback) {
            if (!modelObject) {
                return nextCallback(null, null, null);
            }

            var operators = Object.keys(update);
            async.mapSeries(operators, function(operator, doneCallback) {
                var modification = update[operator];

                var operation;
                try {
                    switch (operator) {
                        case CONST.OPERATOR_PUSH: 
                            operation = new PushQueryOperation(_.extend(options, {
                                typeClass: modelObject.constructor,
                                modification: modification
                            }));
                            break;
                        case CONST.OPERATOR_PULL: 
                            operation = new PullQueryOperation(_.extend(options, {
                                typeClass: modelObject.constructor,
                                modification: modification
                            }));
                            break;
                        case CONST.OPERATOR_SET: 
                            operation = new SetQueryOperation(_.extend(options, {
                                typeClass: modelObject.constructor,
                                modification: modification
                            }));
                            break;
                        default: 
                            throw new Error('Unrecognized operator \'' + operator + '\'');
                    }
                } catch (err) {
                    return doneCallback(err);
                }

                operation.prepareAndValidate(function(err) {
                    doneCallback(err, operation);
                });

            }, function(err, preparedOperations) {
                if (err) {
                    return nextCallback(err);
                }
                nextCallback(null, modelObject, preparedOperations);
            });
        },

        function applyOperations(modelObject, operations, nextCallback) {
            if (!modelObject) {
                return nextCallback(null, null);
            }

            async.mapSeries(operations, function(operation, doneCallback) {
                operation.execute(scope, modelObject, doneCallback);

            }, nextCallback);
        },

        function aggregateQueryResults(queryResults, nextCallback) {
            if (!queryResults) {
                return nextCallback(null, new QueryResult());
            }

            nextCallback(null, QueryResult.mergeResults(queryResults));
        }

    ], callback);
};
