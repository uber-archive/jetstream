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

module.exports = CaseExpressionEvaluator;

var Expression = require('./expression');
var tryit = require('tryit');

var CONST = {};
CONST.INNER_EXPRESSION_REGEX = /^([a-zA-Z]{1}[a-zA-Z0-9-_]*)\((.+)\)$/;
CONST = Object.freeze(CONST);

function CaseExpressionEvaluator() {

}

CaseExpressionEvaluator.CONST = CONST;

CaseExpressionEvaluator.evaluate = function(value, scope, incoming, options, callback) {
    var split = value.split('.');
    if (split.length < 2) {
        return callback(new Error(
            'Case expression must be of the form "$case.caseType(innerExpression)"' + 
            '; expr: \'' + value + '\''));
    }

    var expressionType = split[0];
    if (expressionType !== Expression.CONST.EXPRESSION_TYPE_CASE) {
        return callback(new Error(
            'Case expression must be of the form "$case.caseType(innerExpression)"' + 
            '; expr: \'' + value + '\''));
    }

    var matches = CONST.INNER_EXPRESSION_REGEX.exec(value.substr(split[0].length + 1));
    if (!matches) {
        return callback(new Error(
            'Case expression must be of the form "$case.caseType(innerExpression)"' + 
            '; expr: \'' + value + '\''));
    }

    var caseName = matches[1];
    var caseExpressionValue = matches[2];

    if (typeof options.cases !== 'object' || typeof options.cases[caseName] !== 'object') {
        return callback(new Error(
            'Case expression options is missing case values for \'' + caseName + '\'' + 
            '; expr: \'' + value + '\''));
    }

    var caseEntries = options.cases[caseName];
    if (Object.keys(caseEntries).length < 1) {
        return callback(new Error(
            'Case expression options is missing entries for \'' + caseName + '\'' + 
            '; expr: \'' + value + '\''));
    }

    var caseExpression;
    var caseExpressionError;
    tryit(function() {
        caseExpression = new Expression({value: caseExpressionValue});
    }, function(err) {
        caseExpressionError = err;
    });

    if (caseExpressionError) {
        return callback(new Error(
            'Case expression inner expression \'' + caseExpressionValue + 
            '\' could not be constructed: ' + caseExpressionError.message +
             '; expr: \'' + value + '\''));
    }

    caseExpression.evaluator(scope, incoming, options, function(err, expressionValue) {
        if (err) {
            return callback(new Error(
                'Case expression inner expression error: ' + 
                err.message + '; expr: \'' + value + '\''));
        }

        if (!caseEntries.hasOwnProperty(expressionValue)) {
            return callback(new Error(
                'Case expression has no entry for returned expression result: ' + 
                expressionValue + '; expr: \'' + value + '\''));
        }

        callback(null, caseEntries[expressionValue]);
    });
};
