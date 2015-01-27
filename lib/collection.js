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

module.exports = Collection;

var _ = require('lodash');
var ModelObject = require('./model_object');
var ModelObjectProperty = require('./model_object_property');

function Collection(options) {
    options = options || {};

    if (!(options.property instanceof ModelObjectProperty)) {
        throw new Error('Invalid property');
    }

    if (!options.property.isCollectionType) {
        throw new Error('Property is not a collection type');
    }

    if (!(options.owningModelObject instanceof ModelObject)) {
        throw new Error('Invalid owningModelObject');
    }

    this.array = [];
    this.property = options.property;
    this.owningModelObject = options.owningModelObject;
}

Object.defineProperty(Collection.prototype, 'length', {
    configurable: false,
    enumerable: true,
    get: function() {
        return this.array.length;
    }
});

Collection.prototype._filterArrayOrThrow = function(array) {
    return _.map(array, function(element) {
        return ModelObjectProperty.filterValueForPropertyOrThrow(element, this.property);
    }.bind(this));
};

Collection.prototype.setAsArray = function(array) {
    var oldArray = this.array;
    this.array = this._filterArrayOrThrow(array);
    if (this.property.isModelObjectType) {
        var removed = _.difference(oldArray, this.array);
        var added = _.difference(this.array, oldArray);

        removed.forEach(function(modelObject) {
            modelObject._removeParent(this.owningModelObject, this.property.name);
        }.bind(this));

        added.forEach(function(modelObject) {
            modelObject._addParent(this.owningModelObject, this.property.name);
        }.bind(this));
    }
    return this.array;
};

Collection.prototype.objectAtIndex = function(index) {
    if (index < 0) {
        if (index === -1) {
            return this.array.slice(-1)[0];
        } else {
            return this.array.slice(index, index+1)[0];
        }
    }
    return this.array[index];
};

Collection.prototype.pop = function() {
    var element = this.array.pop();
    if (this.property.isModelObjectType && element) {
        element._removeParent(this.owningModelObject, this.property.name);
    }
    return element;
};

Collection.prototype.push = function(element) {
    element = ModelObjectProperty.filterValueForPropertyOrThrow(element, this.property);
    if (this.property.isModelObjectType) {
        element._addParent(this.owningModelObject, this.property.name);
    }
    return this.array.push(element);
};

Collection.prototype.shift = function() {
    var element = this.array.shift();
    if (this.property.isModelObjectType && element) {
        element._removeParent(this.owningModelObject, this.property.name);
    }
    return element;
};

Collection.prototype.unshift = function(element) {
    element = ModelObjectProperty.filterValueForPropertyOrThrow(element, this.property);
    if (this.property.isModelObjectType) {
        element._addParent(this.owningModelObject, this.property.name);
    }
    return this.array.unshift(element);
};

Collection.prototype.slice = function() {
    return this.array.slice.apply(this.array, arguments);
};

Collection.prototype.forEach = function() {
    return this.array.forEach.apply(this.array, arguments);
};

Collection.prototype.map = function() {
    return this.array.map.apply(this.array, arguments);
};

Collection.prototype.filter = function() {
    return this.array.filter.apply(this.array, arguments);
};

Collection.prototype.splice = function() {
    var args = Array.prototype.slice.call(arguments, 0);

    if (args.length > 2) {
        var added = this._filterArrayOrThrow(args.slice(2));
        if (this.property.isModelObjectType) {
            added.forEach(function(modelObject) {
                modelObject._addParent(this.owningModelObject, this.property.name);
            }.bind(this));
        }
        args = [args[0], args[1]].concat(added);
    }

    var removed = this.array.splice.apply(this.array, args);
    if (this.property.isModelObjectType && removed.length > 0) {
        removed.forEach(function(modelObject) {
            modelObject._removeParent(this.owningModelObject, this.property.name);
        }.bind(this));
    }

    return removed;
};
