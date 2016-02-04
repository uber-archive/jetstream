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

/* global console */

'use strict';

module.exports = Log;

var _levels = ['debug', 'error', 'info', 'trace', 'warn'];
var _noop = function() {};

function _bindMethod(level, prefix) {
  var fn = (console && console[level]) || _noop;
  return function() {
    if (!window.DEBUG) {
      return;
    }

    var args = Array.prototype.slice.call(arguments);
    fn.apply(console, [prefix].concat(args));
  };
}

function Log(namespace) {
  var prefix = [namespace, '-'].join(' ');
  var fn = _bindMethod('log', prefix);

  _levels.forEach(function(level) {
    fn[level] = _bindMethod(level, prefix);
  });

  return fn;
}
