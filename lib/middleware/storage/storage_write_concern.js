//
// storage_write_concern.js
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

module.exports = StorageWriteConcern;

var CONST = {};
CONST.CONSTRAIN_BY_NULL = '$null';
CONST.CONSTRAIN_BY_NOTNULL = '$notnull';
CONST = Object.freeze(CONST);

function StorageWriteConcern(options) {
    options = options || {};

    // TODO: type check a lot of the propertiess
    this.type = options.type;
    this.clsName = options.clsName;
    this.triggerKey = StorageWriteConcern.triggerKey(this.type, this.clsName);
    this.when = options.when;
    this.constrain = options.constrain || {};
    this.verify = options.verify || {};
    this.send = options.send || null;
    this.accept = options.accept || null;
}

StorageWriteConcern.CONST = CONST;

StorageWriteConcern.triggerKey = function(type, clsName) {
    return type + ':' + clsName;
};
