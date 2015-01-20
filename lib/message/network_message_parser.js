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

module.exports = NetworkMessageParser;

var AbstractNetworkMessage = require('./abstract_network_message');
var async = require('async');
var JSONReader = require('./json_reader');
var PingMessage = require('./ping_message');
var ReplyMessage = require('./reply_message');
var ScopeFetchMessage = require('./scope_fetch_message');
var ScopeStateMessage = require('./scope_state_message');
var ScopeSyncMessage = require('./scope_sync_message');
var SessionCreateMessage = require('./session_create_message');
var SessionCreateReplyMessage = require('./session_create_reply_message');

function NetworkMessageParser() {

}

NetworkMessageParser.parseAsRawJSON = function(input, callback) {
    JSONReader.read(input, function (err, json) {
        if (err) {
            return callback(err);
        }
        NetworkMessageParser.parseAsJSON(json, callback);
    });
};

NetworkMessageParser.parseAsJSON = function(json, callback) {
    if (!json) {
        return callback(new Error('No message(s) to parse'));
    }
    if (Array.isArray(json)) {
        return async.map(json, NetworkMessageParser.parseAsJSON, function(err, results) {
            if (err) {
                return callback(err);
            }
            callback(null, results);
        });
    }

    switch (json.type) {
        case ReplyMessage.type:
            ReplyMessage.parseAsJSON(json, callback);
            break;
        case SessionCreateMessage.type:
            SessionCreateMessage.parseAsJSON(json, callback);
            break;
        case SessionCreateReplyMessage.type:
            SessionCreateReplyMessage.parseAsJSON(json, callback);
            break;
        case ScopeFetchMessage.type:
            ScopeFetchMessage.parseAsJSON(json, callback);
            break;
        case ScopeStateMessage.type:
            ScopeStateMessage.parseAsJSON(json, callback);
            break;
        case ScopeSyncMessage.type:
            ScopeSyncMessage.parseAsJSON(json, callback);
            break;
        case PingMessage.type:
            PingMessage.parseAsJSON(json, callback);
            break;
        default:
            return callback(new Error('Unrecognized message type'));
    }
};

NetworkMessageParser.composeAsJSON = function(input, callback) {
    if (!input) {
        return callback(new Error('No message(s) to compose'));
    }
    if (Array.isArray(input)) {
        return async.map(input, NetworkMessageParser.composeAsJSON, function(err, results) {
            if (err) {
                return callback(err);
            }
            callback(null, results);
        });
    }
    if (!(input instanceof AbstractNetworkMessage)) {
        return callback(new Error('Invalid input, not message(s)'));
    }
    var json;
    try {
        json = input.toJSON();
    } catch (err) {
        return callback(err);
    }
    callback(null, json);
};
