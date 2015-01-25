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

module.exports = ScopeExpressionEvaluator;

var dotty = require('dotty');
var Expression = require('./expression');

var CONST = {};
CONST.PROPERTY_NAME = 'name';
CONST.PROPERTY_PARAMS = 'params';
CONST.AVAILABLE_PROPERTIES = Object.freeze([
    CONST.PROPERTY_NAME,
    CONST.PROPERTY_PARAMS
]);
CONST = Object.freeze(CONST);

function ScopeExpressionEvaluator() {

}

ScopeExpressionEvaluator.CONST = CONST;

ScopeExpressionEvaluator.evaluate = function(value, scope, callback) {
    var split = value.split('.');
    if (split.length < 2) {
        return callback(new Error(
            'Scope expression must be of the form "$scope.property[.value]"'));
    }

    var expressionType = split[0];
    if (expressionType !== Expression.CONST.EXPRESSION_TYPE_SCOPE) {
        return callback(new Error(
            'Scope expression must be of the form "$scope.property[.value]"'));
    }

    var property = split[1];

    switch (property) {
        case CONST.PROPERTY_NAME:
            callback(null, scope.name);
            break;
        case CONST.PROPERTY_PARAMS:
            if (split.length < 3) {
                return callback(new Error(
                    'Scope expression for params must be of the form "$scope.params.paramsFieldName"'));
            }

            var keyPath = split.slice(2);
            var paramValue = dotty.get(scope.params, keyPath);
            if (paramValue === undefined) {
                return callback(new Error(
                    'Scope expression for params was not able to be resolved, ' + 
                    'field or key path given did not exist in params object'));
            }

            callback(null, paramValue);
            break;
        default:
            return callback(new Error(
                'Scope expression unrecognized field \'' + property + 
                '\', should be one of: ' + CONST.AVAILABLE_PROPERTIES.join(', ')));
    }
};
