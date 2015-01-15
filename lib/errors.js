//
// errors.js
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

module.exports = Errors;

var TypedError = require('error/typed');

function Errors() {

}

Errors.jsonify = function(error) {
    var json = {message: error.message};
    if (error.type) {
        json.type = error.type;
    }
    return json;
};

Errors.Rejected = TypedError({
    type: 'rejected',
    message: 'Connection was rejected'
});

Errors.ConnectionHandshakeUnrecognized = TypedError({
    type: 'unrecognized-handshake',
    message: 'Unrecognized handshake, should send SessionCreate message as first and only message'
});

Errors.ConnectionSessionTokenUnrecognized = TypedError({
    type: 'session-token-unrecognized',
    message: 'Session token unrecognized'
});

Errors.ConnectionSessionEstablishTimeout = TypedError({
    type: 'session-establish-timedout',
    message: 'Session took long to establish and timed out'
});

Errors.ScopeAtIndexNotFound = TypedError({
    type: 'scope-index-not-found',
    message: 'Scope at index {index} was not found'
});

Errors.CouldNotApplySyncMessage = TypedError({
    type: 'could-not-apply-sync-message',
    message: 'Could not apply SyncMessage: {reason}'
});

Errors.DefaultWriteConcernForScopeIsDeny = TypedError({
    type: 'default-write-concern-for-scope-is-deny',
    message: 'Could not apply SyncMessage: {reason}'
});
