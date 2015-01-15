//
// abstract_network_message.js
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

var AbstractNetworkMessage = require('../../lib/message/abstract_network_message');
var createTestContext = require('../test/test_context');
var test = require('redtape')();
var util = require('util');

var context = createTestContext('AbstractNetworkMessage');
var describe = context.describe;
var method = context.method;
var property = context.property;

function TestMessage() {
    AbstractNetworkMessage.apply(this, arguments);
}
util.inherits(TestMessage, AbstractNetworkMessage);
TestMessage.type = 'Test';

describe(property('type'), function(thing) {

    test(thing('should match its message type'), function t(assert) {
        assert.equal(AbstractNetworkMessage.type, 'Abstract');
        assert.end();
    });

});

describe(method('constructor'), function(thing) {

    test(thing('should throw if given invalid index'), function t(assert) {
        var message;
        assert.throws(function() {
            message = new AbstractNetworkMessage({index: 'str'});    
        }, /requires to be reliably sent/);

        assert.end();
    });

    test(thing('should be able to set a replyCallback'), function t(assert) {
        var replyCallback = function(){};
        var message = new AbstractNetworkMessage({
            index: 0, 
            replyCallback: replyCallback
        });

        assert.equal(message.replyCallback, replyCallback);
        assert.end();
    });

});

describe(method('toJSON'), function(thing) {

    test(thing('should throw when called for an AbstractNetworkMessage'), function t(assert) {
        var message = new AbstractNetworkMessage({index: 0});

        assert.throws(function() { 
            message.toJSON(); 
        }, /Cannot call/);

        assert.end();
    });

    test(thing('should include index of message if set'), function t(assert) {
        var message = new TestMessage({index: 1});
        assert.equal(message.toJSON().index, 1);

        assert.end();
    });

});
