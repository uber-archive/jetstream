//
// incoming_expression_evaluator.js
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

module.exports = IncomingExpressionEvaluator;

var Expression = require('./expression');
var SyncFragment = require('../sync_fragment');

function IncomingExpressionEvaluator() {

}

IncomingExpressionEvaluator.evaluate = function(value, incoming, callback) {
    var split = value.split('.');
    if (split.length !== 4) {
        return callback(new Error(
            'Incoming expression must be of the form "$incoming.ModelObjectType.changeType.value"'));
    }

    var expressionType = split[0];
    if (expressionType !== Expression.CONST.EXPRESSION_TYPE_INCOMING) {
        return callback(new Error(
            'Incoming expression must be of the form "$incoming.ModelObjectType.changeType.value"'));
    }

    var modelObjectType = split[1];
    var changeType = split[2];
    var field = split[3];

    if (SyncFragment.CONST.TYPES.indexOf(changeType) === -1) {
        return callback(new Error(
            'Incoming expression used bad change type, should be one of: ' + 
            SyncFragment.CONST.TYPES.join(', ')));
    }

    var incomingKey = modelObjectType + '.' + changeType;
    var syncFragment = incoming[incomingKey];
    if (!syncFragment) {
        return callback(new Error('Incoming did not contain the change \'' + incomingKey + '\''));
    }

    if (field === 'uuid') {
        return callback(null, syncFragment.objectUUID);
    }

    if (!syncFragment.properties.hasOwnProperty(field)) {
        return callback(new Error('Incoming change did not contain the field \'' + field + '\''));
    }

    callback(null, syncFragment.properties[field]);
};
