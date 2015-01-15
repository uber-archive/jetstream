//
// json_reader.js
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

module.exports = JSONReader;

function JSONReader() {

}

JSONReader.read = function(input, callback) {        
    // Convert to string to try and parse first if only using raw input parser
    if (input instanceof Buffer) {
        input = input.toString();
    }

    if (!input) {
        return callback(new Error('Could not parse message input, missing input'));
    }

    // If using text parser will be string, otherwise it  
    // might already be JSON using a JSON input parser
    if (typeof input === 'string') {
        // Text, parse as json
        var json;
        try {
            json = JSON.parse(input);
        } catch (err) {
            return callback(new Error('Could not parse message input, input was not JSON'));
        }
        return callback(null, json);
    } else if (typeof input === 'object') {
        // Already JSON
        return callback(null, input);
    } else {
        return callback(new Error('Could not parse message input, unrecognized input'));
    }
};
