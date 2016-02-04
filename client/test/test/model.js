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

var ModelObject = require('../../lib/model-object');

var TestModel = ModelObject.create({
  name: 'TestModel',
  definition: function() {
    this.has('boolean', Boolean);
    this.has('date', Date);
    this.has('number', Number);
    this.has('numberTwo', Number);
    this.has('string', String);
    this.has('booleans', [Boolean]);
    this.has('dates', [Date]);
    this.has('numbers', [Number]);
    this.has('numberTwos', [Number]);
    this.has('strings', [String]);
  }
});

TestModel.has('model', TestModel);
TestModel.has('modelTwo', TestModel);
TestModel.has('models', [TestModel]);

module.exports = TestModel;
