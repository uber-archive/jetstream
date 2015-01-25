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

module.exports = RootModelExpressionEvaluator;

var Err = require('rust-result').Err;
var Expression = require('./expression');
var KeyPathNotation = require('./key_path_notation');
var Ok = require('rust-result').Ok;

function RootModelExpressionEvaluator() {

}

RootModelExpressionEvaluator.evaluate = function(value, scope, callback) {
    var split = value.split('.');
    if (split.length < 2) {
        return callback(new Error(
            'Root model expression must be of the form "$rootModel.path[.to.property.value]"'));
    }

    var expressionType = split[0];
    if (expressionType !== Expression.CONST.EXPRESSION_TYPE_ROOT_MODEL) {
        return callback(new Error(
            'Root model expression must be of the form "$rootModel.path[.to.property.value]"'));
    }

    scope.getRootModelObject(function(err, rootModelObject) {
        if (err || !rootModelObject) {
            return callback(err || new Error(
                'Root model expression not able to derive value with no attached root model on scope'));
        }

        var modelKeyPath = split.slice(1, -1).join('.');
        var propertyName =  split.slice(-1)[0];
        var resolveModelObjectResult = KeyPathNotation.resolveModelObject(rootModelObject, modelKeyPath);
        var modelObject = Ok(resolveModelObjectResult);
        if (!modelObject) {
            return callback(Err(resolveModelObjectResult));
        }

        var property = modelObject.getProperty(propertyName);
        if (!property) {
            return callback(new Error(
                'No property \'' + propertyName + '\' at keyPath: ' + rootModelObject.typeName + '(\'' + 
                rootModelObject.uuid + '\').' + modelKeyPath + '.' + propertyName));
        }

        if (property.isModelObjectType) {
            return callback(new Error(
                'Property \'' + propertyName + '\' is a ModelObject property type not a value property type ' + 
                'at keyPath: ' + rootModelObject.typeName + '(\'' + rootModelObject.uuid + '\').' + 
                modelKeyPath + '.' + propertyName));
        }

        callback(null, modelObject[propertyName]);
    });
};
