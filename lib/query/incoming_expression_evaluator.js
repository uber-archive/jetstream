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

var _ = require('lodash');
var Collection = require('../collection');
var Expression = require('./expression');
var SyncFragment = require('../sync_fragment');

var CONST = {};
CONST.INDEX_REGEX = /^(.+)\[((-?\d+)|(removed\[-?\d+\])|(inserted\[-?\d+\]))\]$/;
CONST.DYNAMIC_INDEX_TYPE_REMOVED = 'removed';
CONST.DYNAMIC_INDEX_TYPE_INSERTED = 'inserted';
CONST.DYNAMIC_INDEX_TYPES = Object.freeze([
    CONST.DYNAMIC_INDEX_TYPE_REMOVED,
    CONST.DYNAMIC_INDEX_TYPE_INSERTED
]);
CONST = Object.freeze(CONST);

function IncomingExpressionEvaluator() {

}

IncomingExpressionEvaluator.CONST = CONST;

IncomingExpressionEvaluator.evaluate = function(value, scope, incoming, options, callback) {
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
    var dynamicIndexType = null;
    var unparsedIndex = null;
    var index = null;
    if (split.length === 6) {
        unparsedIndex = split[5];
    } else if (split.length === 7 && CONST.DYNAMIC_INDEX_TYPES.indexOf(split[5]) !== -1) {
        dynamicIndexType = split[5];
        unparsedIndex = split[6];
    } else {
        var matches = CONST.INDEX_REGEX.exec(field);
        if (matches) {
            field = matches[1];
            if (matches[2].indexOf('[') !== -1) {
                matches = CONST.INDEX_REGEX.exec(matches[2]);
                dynamicIndexType = matches[1];
                unparsedIndex = matches[2];
            } else {
                unparsedIndex = matches[2];
            }
        }
    }

    if (unparsedIndex !== null) {
        index = parseInt(unparsedIndex);
        if (isNaN(index)) {
            return callback(new Error(
                'Incoming expression used bad index \'' + unparsedIndex + 
                '\'; expr: \'' + value + '\''));
        }
    }

    if (!syncFragment.properties.hasOwnProperty(field)) {
        return callback(new Error(
            'Incoming change did not contain the field \'' + field + 
            '\'; expr: \'' + value + '\''));
    }

    var fieldValue = syncFragment.properties[field];
    if (index !== null) {
        if (!Array.isArray(fieldValue)) {
            return callback(new Error(
                'Incoming change was not an array value for field \'' + field + 
                '\'; expr: \'' + value + '\''));
        }
        if (dynamicIndexType === null) {
            return callback(null, Collection.objectAtIndex(fieldValue, index));
        } else {
            scope.getModelObjectByUUID(syncFragment.objectUUID, function(err, modelObject) {
                if (err) {
                    return callback(new Error(
                        'Incoming change with dynamic index encounted error ' + 
                        'finding existing ModelObject \'' + syncFragment.objectUUID + 
                        '\': ' + err.message +'; expr: \'' + value + '\''));
                }
                if (!modelObject) {
                    return callback(new Error(
                        'Incoming change with dynamic index unable to find ' + 
                        'existing ModelObject \'' + syncFragment.objectUUID + 
                        '\'; expr: \'' + value + '\''));
                }

                var property = modelObject.getProperty(field);
                if (!property || !property.isCollectionType) {
                    return callback(new Error(
                        'Incoming change with dynamic index unable to resolve value ' + 
                        'as ModelObject type \'' + syncFragment.clsName + 
                        '\' has no collection at key \'' + field + '\'; expr: \'' + value + '\''));
                }

                var oldValues = modelObject[field].map(function(element) {
                    if (property.isModelObjectType) {
                        return element.uuid;
                    } else {
                        return element;
                    }
                });
                if (dynamicIndexType === CONST.DYNAMIC_INDEX_TYPE_INSERTED) {
                    var inserted = _.difference(fieldValue, oldValues);
                    return callback(null, Collection.objectAtIndex(inserted, index));
                } else {
                    var removed = _.difference(oldValues, fieldValue);
                    return callback(null, Collection.objectAtIndex(removed, index));
                }
            });
        }
    } else {
        return callback(null, fieldValue);
    }
};
