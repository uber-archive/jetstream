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

module.exports = IncomingExpressionEvaluator;

var Collection = require('../collection');
var Expression = require('./expression');
var KeyPathNotation = require('./key_path_notation');
var SyncFragment = require('../sync_fragment');

function IncomingExpressionEvaluator() {

}

IncomingExpressionEvaluator.evaluate = function(value, incoming, callback) {
    var split = value.split('.');
    if (split.length !== 4) {
        return callback(new Error(
            'Incoming expression must be of the form "$incoming.ModelObjectType.changeType.value"' + 
            '; expr: \'' + value + '\''));
    }

    var expressionType = split[0];
    if (expressionType !== Expression.CONST.EXPRESSION_TYPE_INCOMING) {
        return callback(new Error(
            'Incoming expression must be of the form "$incoming.ModelObjectType.changeType.value"' + 
            '; expr: \'' + value + '\''));
    }

    var modelObjectType = split[1];
    var changeType = split[2];
    var field = split[3];

    if (SyncFragment.CONST.TYPES.indexOf(changeType) === -1) {
        return callback(new Error(
            'Incoming expression used bad change type, should be one of: ' + 
            SyncFragment.CONST.TYPES.join(', ') + '; expr: \'' + value + '\''));
    }

    var incomingKey = modelObjectType + '.' + changeType;
    var syncFragment = incoming[incomingKey];
    if (!syncFragment) {
        return callback(new Error(
            'Incoming did not contain the change \'' + incomingKey + 
            '\'; expr: \'' + value + '\''));
    }

    if (field === 'uuid') {
        return callback(null, syncFragment.objectUUID);
    }

    // Potentially parse an array index for this path
    var index = null;
    if (split.length === 6) {
        index = parseInt(split[5]);
        if (isNaN(index)) {
            return callback(new Error(
                'Incoming expression used bad index \'' + split[5] + 
                '\'; expr: \'' + value + '\''));
        }
    } else {
        var matches = KeyPathNotation.CONST.INDEX_REGEX.exec(field);
        if (matches) {
            field = matches[1];
            index = parseInt(matches[2]);
        }
    }

    if (!syncFragment.properties.hasOwnProperty(field)) {
        return callback(new Error('Incoming change did not contain the field \'' + field + 
            '\'; expr: \'' + value + '\''));
    }

    var fieldValue = syncFragment.properties[field];
    if (index !== null) {
        if (!Array.isArray(fieldValue)) {
            return callback(new Error('Incoming change was not an array value for field \'' + field + 
                '\'; expr: \'' + value + '\''));
        }
        return callback(null, Collection.objectAtIndex(fieldValue, index));
    }

    callback(null, fieldValue);
};
