//
// network_message_parser.js
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

var createTestContext = require('../test/test_context');
var NetworkMessageParser = require('../../lib/message/network_message_parser');
var ReplyMessage = require('../../lib/message/reply_message');
var SessionCreateMessage = require('../../lib/message/session_create_message');
var test = require('redtape')();
var underscore = require('underscore');

var context = createTestContext('NetworkMessageParser');
var describe = context.describe;
var method = context.method;

describe(method('parseAsRawJSON'), 'when reading input', function(thing) {

    test(thing('should callback with error if reading fails'), function t(assert) {
        var input = 'bah-humbug';
        NetworkMessageParser.parseAsRawJSON(input, function(err, message) {
            assert.ok(err);
            assert.notOk(message);
            assert.end();
        });
    });

    test(thing('should parse a ReplyMessage as string'), function t(assert) {
        var input = '{"type": "Reply", "replyTo": 1, "index": 1}';
        NetworkMessageParser.parseAsRawJSON(input, function(err, message) {
            assert.ifError(err);
            assert.equal(message instanceof ReplyMessage, true);
            assert.end();
        });
    });

});

describe(method('parseAsJSON'), 'when reading JSON', function(thing) {

    test(thing('should parse a Reply message'), function t(assert) {
        var json = {type: 'Reply', replyTo: 0, index: 0};
        NetworkMessageParser.parseAsJSON(json, function(err, message) {
            assert.ifError(err);
            assert.equal(message instanceof ReplyMessage, true);
            assert.end();
        });
    });

    test(thing('should parse a SessionCreate message'), function t(assert) {
        var json = {
            type: 'SessionCreate',
            params: {},
            version: '1.0.0',
            index: 0
        };
        NetworkMessageParser.parseAsJSON(json, function(err, message) {
            assert.ifError(err);
            assert.equal(message instanceof SessionCreateMessage, true);
            assert.end();
        });
    });

    test(thing('should parse arrays of messages'), function t(assert) {
        var json = [
            {type: 'Reply', replyTo: 0, index: 0},
            {type: 'Reply', replyTo: 1, index: 1}
        ];
        NetworkMessageParser.parseAsJSON(json, function(err, messages) {
            assert.ifError(err);
            assert.equal(Array.isArray(messages), true);
            assert.equal(messages.length, 2);
            messages.forEach(function(message) {
                assert.equal(message instanceof ReplyMessage, true);
            });        
            assert.end();
        });
    });

    test(thing('should callback with error for no input'), function t(assert) {
        NetworkMessageParser.parseAsJSON(null, function(err, message) {
            assert.ok(err);
            assert.notOk(message);
            assert.end();
        });
    });

    test(thing('should callback with error for invalid JSON'), function t(assert) {
        NetworkMessageParser.parseAsJSON('bah-humbug', function(err, message) {
            assert.ok(err);
            assert.notOk(message);
            assert.end();
        });
    });

    test(thing('should callback with error for unrecognized message'), function t(assert) {
        var json = {
            type: 'SomethingUnknown',
            someKey: 'someValue'
        };
        NetworkMessageParser.parseAsJSON(json, function(err, message) {
            assert.ok(err);
            assert.notOk(message);
            assert.end();
        });
    });

    test(thing('should callback with error for JSON array with non-objects'), function t(assert) {
        NetworkMessageParser.parseAsJSON(['bah-humbug'], function(err, message) {
            assert.ok(err);
            assert.notOk(message);
            assert.end();
        });
    });

    test(thing('should callback with error for JSON array with non-messages'), function t(assert) {
        NetworkMessageParser.parseAsJSON([{}], function(err, message) {
            assert.ok(err);
            assert.notOk(message);
            assert.end();
        });
    });

});

describe(method('composeAsJSON'), 'when creating JSON', function(thing) {

    test(thing('should be able to compose a Reply message'), function t(assert) {
        var message = new ReplyMessage({replyTo: 0, index: 0});
        NetworkMessageParser.composeAsJSON(message, function(err, json) {
            assert.ifError(err);
            assert.ok(json);
            assert.equal(json instanceof ReplyMessage, false);

            var predicate = underscore.matches(message.toJSON());
            assert.equal(predicate(json), true);

            assert.end();
        });
    });

    test(thing('should be able to compose arrays of messages'), function t(assert) {
        var messages = [
            new ReplyMessage({replyTo: 0, index: 0}),
            new ReplyMessage({replyTo: 1, index: 1})
        ];
        NetworkMessageParser.composeAsJSON(messages, function(err, json) {
            assert.ifError(err);
            assert.ok(json);
            assert.equal(Array.isArray(json), true);

            messages.forEach(function (message, i) {
                assert.equal(message instanceof ReplyMessage, true);

                var predicate = underscore.matches(message.toJSON());
                assert.equal(predicate(json[i]), true);
            });

            assert.end();
        });
    });

    test(thing('should callback with error for no input'), function t(assert) {
        NetworkMessageParser.composeAsJSON(null, function(err, json) {
            assert.ok(err);
            assert.notOk(json);
            assert.end();
        });
    });

    test(thing('should callback with error for bad input'), function t(assert) {
        NetworkMessageParser.composeAsJSON('bah-humbug', function(err, json) {
            assert.ok(err);
            assert.notOk(json);
            assert.end();
        });
    });

    test(thing('should callback with error for array of bad input'), function t(assert) {
        NetworkMessageParser.composeAsJSON(['bah-humbug'], function(err, json) {
            assert.ok(err);
            assert.notOk(json);
            assert.end();
        });
    });

    test(thing('should callback with error when failing to JSONify message'), function t(assert) {
        var message = new ReplyMessage({replyTo: 0, index: 0});
        message.toJSON = function() {
            throw new Error('Mock error');
        };
        NetworkMessageParser.composeAsJSON(message, function(err, json) {
            assert.ok(err);
            assert.notOk(json);
            assert.end();
        });
    });

});
