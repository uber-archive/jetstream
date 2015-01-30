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

module.exports = AddToSetQueryOperation;

var _ = require('lodash');
var PushQueryOperation = require('./push_query_operation');
var Query = require('./query');
var util = require('util');

function AddToSetQueryOperation(options) {
    PushQueryOperation.call(this, options);

    this.operator = Query.CONST.OPERATOR_ADD_TO_SET;
}

util.inherits(AddToSetQueryOperation, PushQueryOperation);

AddToSetQueryOperation.prototype._bindFragmentProperties = function(target, key, properties) {
    var uuidsToAdd = properties[key];
    var propertyUUIDsLookup = {};
    var propertyUUIDs = target[key].map(function(element) {
        propertyUUIDsLookup[element.uuid] = true;
        return element.uuid;
    });

    uuidsToAdd.forEach(function(element) {
        if (!propertyUUIDsLookup.hasOwnProperty(element)) {
            propertyUUIDs.push(element);
        }
    });

    properties[key] = propertyUUIDs;
};
