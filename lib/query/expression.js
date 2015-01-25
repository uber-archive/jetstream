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

module.exports = Expression;

var evaluateIncomingExpression = require('./incoming_expression_evaluator').evaluate;
var evaluateRootModelExpression = require('./root_model_expression_evaluator').evaluate;
var evaluateScopeExpression = require('./scope_expression_evaluator').evaluate;

var CONST = {};
CONST.EXPRESSION_TYPE_INCOMING = '$incoming';
CONST.EXPRESSION_TYPE_ROOT_MODEL = '$rootModel';
CONST.EXPRESSION_TYPE_SCOPE = '$scope';
CONST = Object.freeze(CONST);

function Expression(options) {
    options = options || {};

    if (typeof options.value !== 'string') {
        throw new Error('Requires value');
    }

    this.value = options.value;
    this.evaluator = Expression.createEvaluatorOrThrow(options.value);
}

Expression.CONST = CONST;

Expression.createEvaluatorOrThrow = function(value) {
    if (typeof value !== 'string') {
        throw new Error('Expression value must be a string to evaluate');
    }

    var indexOfFirstOperatorEnd = value.indexOf('.');
    if (indexOfFirstOperatorEnd === -1) {
        throw new Error('Expression value must be of the form "$expressionType.expressionArgument"');
    }

    var expressionType = value.substr(0, indexOfFirstOperatorEnd);
    switch (expressionType) {
        case CONST.EXPRESSION_TYPE_INCOMING:
            return function incomingExpressionEvaluator(scope, incoming, callback) {
                return evaluateIncomingExpression(value, incoming, callback);
            };
        case CONST.EXPRESSION_TYPE_ROOT_MODEL:
            return function rootModelExpressionEvaluator(scope, incoming, callback) {
                return evaluateRootModelExpression(value, scope, callback);
            };
        case CONST.EXPRESSION_TYPE_SCOPE:
            return function scopeExpressionEvaluator(scope, incoming, callback) {
                return evaluateScopeExpression(value, scope, callback);
            };
        default:
            throw new Error('Expression type \'' + expressionType + '\' is unrecognized');
    }
};
