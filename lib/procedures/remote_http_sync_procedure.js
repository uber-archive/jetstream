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

module.exports = RemoteHttpSyncProcedure;

var _ = require('lodash');
var async = require('async');
var Expression = require('../query/expression');
var logger = require('../logger');
var request = require('request');
var robb = require('robb/src/robb');
var SyncFragment = require('../sync_fragment');
var SyncProcedure = require('./sync_procedure');
var SyncProcedureResult = require('./sync_procedure_result');
var util = require('util');

var debug = logger.debug.bind(logger, 'procedure:remoteHttpSyncProcedure');
var debugIsEnabled = logger.getDebugLogger('procedure:remoteHttpSyncProcedure').enabled;

if (debugIsEnabled) {
    // Only attach request debugger if debug is enabled as it is expensive
    require('request-debug')(request, function(type, data, r) {
        debug(type, data);
    });
}

var CONST = {};
CONST.HTTP_VERB_GET = 'GET';
CONST.HTTP_VERBS = Object.freeze([
    'GET',
    'DELETE',
    'HEAD',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT'
]);
CONST.DEFAULT_HEADERS = Object.freeze({
    'Content-Type': 'application/json'
});
CONST.DEFAULT_TIMEOUT_MS = 10 * 1000;
CONST.ASYNC_PARALLELISM_LIMIT = 10;
CONST = Object.freeze(CONST);

// TODO: implement the following
// 1. provide option for following redirects
// 2. provide option for retries on failure
// 3. provide option for bodies that are not JSON, e.g. string interpolated, xml, etc
function RemoteHttpSyncProcedure(options) {
    options = options || {};
    SyncProcedure.call(this, options);

    if (typeof options.remote.url !== 'string') {
        throw new Error('Requires url');
    }

    var hasMethod = options.remote.hasOwnProperty('method');
    if (hasMethod && typeof options.remote.method !== 'string') {
        throw new Error('Method is required to be a string');
    } else if (hasMethod && CONST.HTTP_VERBS.indexOf(options.remote.method.toUpperCase()) === -1) {
        throw new Error('Method is not valid, should be one of: ' + CONST.HTTP_VERBS.join(', '));
    } else if (!hasMethod) {
        options.remote.method = CONST.HTTP_VERB_GET;
    }

    var hasParams = options.remote.hasOwnProperty('params');
    if (hasParams && typeof options.remote.params !== 'object') {
        throw new Error('Params are required to be passed by object');
    } else if (!hasParams) {
        options.remote.params = {};
    }

    var hasHeaders = options.remote.hasOwnProperty('headers');
    if (hasHeaders && typeof options.remote.headers !== 'object') {
        throw new Error('Headers are required to be passed by object');
    } else if (!hasHeaders) {
        options.remote.headers = {};
    }

    var hasBody = options.remote.hasOwnProperty('body');
    if (hasBody && typeof options.remote.body !== 'object') {
        throw new Error('Body is required to be passed by object');
    } else if (!hasBody) {
        options.remote.body = null;
    }

    var hasTimeout = options.remote.hasOwnProperty('timeout');
    if (hasTimeout && !robb.isUnsignedInt(options.remote.timeout)) {
        throw new Error('Timeout is required to be milliseconds as positive integer');
    }

    var hasHttpClient = options.remote.hasOwnProperty('httpClient');
    if (hasHttpClient && typeof options.remote.httpClient !== 'function') {
        throw new Error('HttpClient is required to be a function that matches the `request` module interface');
    }

    this.url = options.remote.url;
    this.params = options.remote.params;
    this.method = options.remote.method.toUpperCase();
    this.headers = _.extend(_.extend({}, CONST.DEFAULT_HEADERS), options.remote.headers);
    this.body = options.remote.body;
    this.timeout = options.remote.timeout || CONST.DEFAULT_TIMEOUT_MS;
    this.httpClient = options.remote.httpClient || request;
    this._verifyUrlParamsSetOrThrow();
    this._verifyParamsHeadersBodyBindingsOrThrow();
}

util.inherits(RemoteHttpSyncProcedure, SyncProcedure);

RemoteHttpSyncProcedure.prototype.execute = function(scope, syncFragments, callback) {
    var url, headers, body;
    var incoming = SyncFragment.toIncoming(syncFragments);
    async.series([
        function getBoundUrl(nextCallback) {
            this._getBoundValues(this.params, scope, incoming, function(err, boundValues) {
                if (err) {
                    return nextCallback(err);
                }
                url = this.url;
                _.each(boundValues, function(value, key) {
                    url = url.replace(new RegExp(':' + key, 'g'), value);
                });
                nextCallback();
            }.bind(this));
        }.bind(this),

        function getBoundHeaders(nextCallback) {
            this._getBoundValues(this.headers, scope, incoming, function(err, boundValues) {
                headers = boundValues;
                nextCallback(err);
            });
        }.bind(this),

        function getBoundBody(nextCallback) {
            this._getBoundValues(this.body, scope, incoming, function(err, boundValues) {
                body = boundValues;
                nextCallback(err);
            });
        }.bind(this),

    ], function executeRequest(err) {
        if (err) {
            return callback(err);
        }
        this._executeRequest(url, headers, body, callback);
    }.bind(this));
};

RemoteHttpSyncProcedure.prototype._verifyUrlParamsSetOrThrow = function() {
    var paramsRequiredByUrl = [];
    this.url.split('/').forEach(function(str) {
        if (/^:([a-zA-Z]+[a-zA-Z0-9-_]*)$/.exec(str)) {
            paramsRequiredByUrl.push(str.substr(1));
        }
    });

    var missing = _.difference(paramsRequiredByUrl, Object.keys(this.params));
    if (missing.length > 0) {
        throw new Error('Params is missing some required keys: ' + missing.map(function(key) {
            return '\'' + key + '\'';
        }).join(', '));
    }
};

RemoteHttpSyncProcedure.prototype._verifyParamsHeadersBodyBindingsOrThrow = function() {
    // TODO: should ensure to some good degree that the bindings for values are formed relatively well
};

RemoteHttpSyncProcedure.prototype._getBoundValues = function(keyValues, scope, incoming, callback) {
    var boundValues = {};
    var limit = CONST.ASYNC_PARALLELISM_LIMIT;
    async.eachLimit(Object.keys(keyValues), limit, function(key, doneCallback) {
        var value = keyValues[key];
        if (value instanceof Expression) {
            value.evaluator(scope, incoming, function(err, boundValue) {
                boundValues[key] = boundValue;
                doneCallback(err);
            });
        } else if (typeof value === 'object') {
            this._getBoundValues(value, scope, incoming, function(err, innerBoundValues) {
                boundValues[key] = innerBoundValues;
                doneCallback(err);
            });
        } else {
            boundValues[key] = value;
            doneCallback();
        }
    }.bind(this), function(err) {
        if (err) {
            return callback(err);
        }
        callback(null, boundValues);
    }.bind(this));
};

RemoteHttpSyncProcedure.prototype._executeRequest = function(url, headers, body, callback) {
    var options = {
        url: url,
        method: this.method,
        headers: headers,
        json: body,
        timeout: this.timeout
    };

    this.httpClient(options, function(err, response, body) {
        if (err || !response) {
            return callback(err || new Error('No response was returned'));
        }
        if (response.statusCode !== 200) {
            return callback(new Error(
                'Expected response 200 status code, received ' + response.statusCode + ' status code'));
        }

        // TODO: add ability to map inline edits on the data to add fragments to additionalFragments
        callback(null, new SyncProcedureResult({additionalFragments: []}));
    });
};
