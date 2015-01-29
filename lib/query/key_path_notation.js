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

module.exports = KeyPathNotation;

var _ = require('lodash');
var Err = require('rust-result').Err;
var ModelObject = require('../model_object');
var Ok = require('rust-result').Ok;
var ResolvePropertyResult = require('./resolve_property_result');

var CONST = {};
CONST.INDEX_REGEX = /^(.+)\[(-?\d+)\]$/;
CONST = Object.freeze(CONST);

/**
 * Currently supported: 
 * - Simple property of property access: 
 *  e.g. 'property.anotherProperty.yetAnotherProperty'
 * - Single array index property access with either [] or . separator: 
 *  e.g. 'property.arrayProperty[0].elementProperty' or 
 *  'property.arrayProperty.0.elementProperty'
 * - Single array index with negative indices, for instance -1 would give you the last element:
 *  e.g. 'property.arrayProperty[-1]' or
 *  'property.arrayProperty.-1'
 */
function KeyPathNotation() {

}

KeyPathNotation.CONST = CONST;

/**
 * Get a ModelObject at a key path relative from a ModelObject
 *
 * @param modelObject {ModelObject} The starting ModelObject to resolve from
 * @param keyPath {String} The key path to the child ModelObject to resolve
 * @returns {Result} Result with {Error} or the resolved child {ModelObject} 
 */
KeyPathNotation.resolveModelObject = function(modelObject, keyPath) {
    if (!(modelObject instanceof ModelObject)) {
        return Err(new Error('Requires modelObject'));
    }
    if (keyPath === '') {
        return Ok(modelObject);
    }

    var paths = keyPath.split('.');
    var traversedKeyPath = '';
    var current = modelObject;
    while (paths.length > 0) {
        var preparsed = paths.shift();
        var str = preparsed;
        var index = null;

        // Potentially parse an array index for this path
        var matches = CONST.INDEX_REGEX.exec(str);
        if (matches) {
            str = matches[1];
            index = parseInt(matches[2]);
        }

        var property = current.getProperty(str);
        if (!property) {
            return Err(new Error(
                'No property \'' + str + '\' at keyPath: ' + modelObject.typeName + '(\'' + 
                modelObject.uuid + '\')' + traversedKeyPath + '.' + preparsed));
        }
        if (!property.isModelObjectType) {
            return Err(new Error(
                'Property \'' + str + '\' is not a ModelObject property at keyPath: ' + 
                modelObject.typeName + '(\'' + modelObject.uuid + '\')' + 
                traversedKeyPath + '.' + preparsed));
        }

        if (property.isCollectionType) {
            if (index === null) {
                // Did not parse index as array-index like, check next part of dot-notation for index
                if (paths.length < 1) {
                    index = NaN;
                } else {
                    var strIndex = paths.shift();
                    preparsed += '.' + strIndex;
                    index = parseInt(strIndex);
                }
                if (isNaN(index)) {
                    return Err(new Error(
                        'No index found for ModelObject in collection on property \'' + str + 
                        '\' at keyPath: ' +  modelObject.typeName + '(\'' + modelObject.uuid + 
                        '\')' + traversedKeyPath + '.' + preparsed));
                }
            }
            current = current[str].objectAtIndex(index);
            if (!current) {
                return Err(new Error(
                    'No ModelObject instance at index ' + index +' on property \'' + 
                    str + '\' at keyPath: ' + modelObject.typeName + '(\'' + modelObject.uuid + 
                    '\')' + traversedKeyPath + '.' + preparsed));
            }
        } else {
            current = current[str];
            if (!current) {
                return Err(new Error(
                    'No ModelObject instance on property \'' + str + '\' at keyPath: ' + 
                    modelObject.typeName + '(\'' + modelObject.uuid + '\')' + 
                    traversedKeyPath + '.' + preparsed));
            }
        }

        traversedKeyPath += '.' + preparsed;
    }

    return Ok(current);
};

/**
 * Get a ModelObjectProperty at a key path relative from an instance of a ModelObject constructor
 *
 * @param typeClass {Function} The starting ModelObject constructor to resolve property from
 * @param keyPath {String} The key path from an instance of typeClass to the child property
 * @returns {Result} Result with {Error} or {ResolvePropertyResult} with the property, property owner type and key path
 */
KeyPathNotation.resolveProperty = function(typeClass, keyPath) {
    if (!ModelObject.isChildClass(typeClass)) {
        return Err(new Error('Requires typeClass to derive from ModelObject'));
    }

    var originatingTypeClass = typeClass;
    var paths = keyPath.split('.');
    var traversedKeyPath = '';
    var lastPathWasIndex;
    var property;
    var str;
    while (paths.length > 0) {
        var preparsed = paths.shift();
        str = preparsed;
        var index = null;
        lastPathWasIndex = false;

        // Potentially remove array index for this path
        var matches = CONST.INDEX_REGEX.exec(str);
        if (matches) {
            str = matches[1];
            index = parseInt(matches[2]);
        }

        property = typeClass.getProperty(str);
        if (!property) {
            // Try all derived classes if present
            var err;
            _.each(typeClass.getAllChildClasses(), function(childTypeClass) {
                var childProperty = childTypeClass.getProperty(str);
                if (childProperty && !property) {
                    property = childProperty;
                    typeClass = childTypeClass;
                } else if (childProperty && property) {
                    err = new Error(
                        'Property \'' + str + '\' is ambiguous as derived classes ' + 
                        typeClass.typeName + ' and ' + childTypeClass.typeName + ' ' +
                        'both declare the same property at keyPath: ' + 
                        originatingTypeClass.typeName + traversedKeyPath + '.' + preparsed);
                    return false;
                }
            });
            if (err) {
                return Err(err);
            }
        }
        if (!property) {
            return Err(new Error(
                'No property \'' + str + '\' at keyPath: ' + originatingTypeClass.typeName + 
                traversedKeyPath + '.' + preparsed));
        }
        if (paths.length > 0) {
            // Further key paths to lookup, make sure this property is ModelObject type and remove any indices
            if (!property.isModelObjectType) {
                return Err(new Error(
                    'Property \'' + str + '\' is not a ModelObject property at keyPath: ' + 
                    originatingTypeClass.typeName + traversedKeyPath + '.' + preparsed));
            }
            if (property.isCollectionType && index === null) {
                // Did not parse index as array-index like, check next part of dot-notation for index
                var strIndex = paths.shift();
                preparsed += '.' + strIndex;
                index = parseInt(strIndex);
                if (isNaN(index)) {
                    return Err(new Error(
                        'No index found for ModelObject in collection on property \'' +
                        str + '\' at keyPath: ' +  originatingTypeClass.typeName + 
                        traversedKeyPath + '.' + preparsed));
                }
                lastPathWasIndex = true;
            }
            typeClass = property.singleType;
        }

        traversedKeyPath += '.' + preparsed;
    }

    var keyPathsToOwner = traversedKeyPath.split('.').filter(function(element) {
        return element !== '';
    });

    // Ensure that if the last two parts were an array property and its index
    // to restore to the base of that property rather than just slicing off the index
    var ownerKeyPath;
    if (lastPathWasIndex) {
        ownerKeyPath = keyPathsToOwner.slice(0, -2).join('.');
    } else {
        ownerKeyPath = keyPathsToOwner.slice(0, -1).join('.');
    }

    return Ok(new ResolvePropertyResult({
        property: property,
        ownerTypeClass: typeClass,
        ownerKeyPath: ownerKeyPath
    }));
};
