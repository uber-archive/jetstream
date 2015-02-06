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

module.exports = ModelExpressionEvaluator;

var Err = require('rust-result').Err;
var Expression = require('./expression');
var KeyPathNotation = require('./key_path_notation');
var Ok = require('rust-result').Ok;
var tryit = require('tryit');

var CONST = {};
CONST.FIND_EXPRESSION_REGEX = /^find\((.+)\)\.(.+)$/;
CONST = Object.freeze(CONST);

function ModelExpressionEvaluator() {

}

ModelExpressionEvaluator.CONST = CONST;

ModelExpressionEvaluator.evaluate = function(value, scope, incoming, options, callback) {
    var split = value.split('.');
    if (split.length < 3) {
        return callback(new Error(
            'Model expression must be of the form "$model.find(innerExpression).path[.to.property.value]"' + 
            '; expr: \'' + value + '\''));
    }

    var expressionType = split[0];
    if (expressionType !== Expression.CONST.EXPRESSION_TYPE_MODEL) {
        return callback(new Error(
            'Model expression must be of the form "$model.find(innerExpression).path[.to.property.value]"' + 
            '; expr: \'' + value + '\''));
    }

    var matches = CONST.FIND_EXPRESSION_REGEX.exec(value.substr(split[0].length + 1));
    if (!matches) {
        return callback(new Error(
            'Model expression must be of the form "$model.find(innerExpression).path[.to.property.value]"' + 
            '; expr: \'' + value + '\''));
    }

    var findExpressionValue = matches[1];
    split = matches[2].split('.');
    var findExpression;
    var findExpressionError;
    tryit(function() {
        findExpression = new Expression({value: findExpressionValue});
    }, function(err) {
        findExpressionError = err;
    });

    if (findExpressionError) {
        return callback(new Error(
            'Model expression inner find expression \'' + findExpressionValue + 
            '\' could not be constructed: ' + findExpressionError.message +
             '; expr: \'' + value + '\''));
    }

    findExpression.evaluator(scope, incoming, options, function(err, uuid) {
        if (err) {
            return callback(new Error(
                'Model expression inner find expression error: ' + 
                err.message + '; expr: \'' + value + '\''));
        }

        scope.getModelObjectByUUID(uuid, function(err, foundModelObject) {
            if (err || !foundModelObject) {
                return callback(err || new Error(
                    'Model expression could not find ModelObject with UUID \'' + 
                    uuid + '\'; expr: \'' + value + '\''));
            }

            var modelKeyPath = split.slice(0, -1).join('.');
            var propertyName =  split.slice(-1)[0];
            var resolveModelObjectResult = KeyPathNotation.resolveModelObject(foundModelObject, modelKeyPath);
            var modelObject = Ok(resolveModelObjectResult);
            if (!modelObject) {
                return callback(Err(resolveModelObjectResult));
            }

            var property = modelObject.getProperty(propertyName);
            if (!property) {
                return callback(new Error(
                    'No property \'' + propertyName + '\' at keyPath: ' + foundModelObject.typeName + '(\'' + 
                    foundModelObject.uuid + '\').' + modelKeyPath + '.' + propertyName));
            }

            if (property.isModelObjectType) {
                return callback(new Error(
                    'Property \'' + propertyName + '\' is a ModelObject property type not a value property type ' + 
                    'at keyPath: ' + foundModelObject.typeName + '(\'' + foundModelObject.uuid + '\').' + 
                    modelKeyPath + '.' + propertyName));
            }

            callback(null, modelObject[propertyName]);
        });
    });
};
