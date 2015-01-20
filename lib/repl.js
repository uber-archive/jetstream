//
// repl.js
// Jetstream
// 
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

module.exports = Repl;

var _ = require('lodash');
var cluster = require('cluster');
var logger = require('./logger');
var replr = require('replr');

var CONST = {};
CONST.DEFAULT_PORT = 2323;
CONST = Object.freeze(CONST);

function Repl() {

}

Repl.CONST = CONST;

Repl.enable = function(options) {
    options = options || {};
    options.port = options.port || CONST.DEFAULT_PORT;
    if (options.hasOwnProperty('useColors')) {
        options.useColors = options.useColors;
    } else {
        options.useColors = true;
    }

    // You should extend helpful commands to access your objects with exports
    options.exports = options.exports || {};

    var opts = {
        name: 'Jetstream REPL',
        prompt: options.useColors ? 'jetstream> '.grey : 'jetstream> ',
        port: options.port,
        useColors: options.useColors,
        exports: function() {
            return _.extend(options.exports, {
                setLoggerLevel: function(level) {
                    /* jshint ignore:start */
                    doc: 'Sets the logger level';
                    /* jshint ignore:end */
                    return logger.setLevel(level);
                }
            });
        }
    };

    if (cluster.isMaster) {
        return replr.create(opts);
    } else {
        return replr.configureAsWorker(opts);
    }
};
