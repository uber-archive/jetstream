//
// query_result.js
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

module.exports = QueryResult;

var _ = require('lodash');

function QueryResult(options) {
    options = options || {};

    if (options.matched instanceof Array) {
        this.matched = options.matched;
    } else {
        this.matched = [];
    }
    if (options.created instanceof Array) {
        this.created = options.created;
    } else {
        this.created = [];
    }
    if (options.modified instanceof Array) {
        this.modified = options.modified;
    } else {
        this.modified = [];
    }
    if (options.writeErrors instanceof Array) {
        this.writeErrors = options.writeErrors;
    } else {
        this.writeErrors = [];
    }
}

QueryResult.mergeResults = function(queryResults) {
    if (queryResults.length === 1) {
        return queryResults[0];
    }

    var matchedLookup = {};
    var createdLookup = {};
    var modifiedLookup = {};
    var writeErrors = [];

    queryResults.forEach(function(result) {
        result.matched.forEach(function(entry) {
            matchedLookup[entry.uuid] = entry;
        });
        result.created.forEach(function(entry) {
            createdLookup[entry.uuid] = entry;
        });
        result.modified.forEach(function(entry) {
            modifiedLookup[entry.uuid] = entry;
        });
        writeErrors = writeErrors.concat(result.writeErrors);
    });

    return new QueryResult({
        matched: _.values(matchedLookup),
        created: _.values(createdLookup),
        modified: _.values(modifiedLookup),
        writeErrors: writeErrors
    });
};

QueryResult.prototype.toJSON = function() {
    return {
        matched: this.matched,
        created: this.created,
        modified: this.modified,
        writeErrors: this.writeErrors
    };
};
