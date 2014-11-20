//
// errors.js
// Jetstream
// 
// Copyright (c) 2014 Uber Technologies, Inc.
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

function Errors() {

}

Errors.create = function(code, slug, message) {
    var error = new Error(message);
    error.code = code;
    error.slug = slug;
    error.toJSON = Errors.jsonify.bind(null, error);
    return error;
};

Errors.jsonify = function(error) {
    var json = {message: error.message};
    if (error.code) {
        json.code = error.code;
    }
    if (error.slug) {
        json.slug = error.slug;
    }
    return json;
};

Errors.REJECTED = Errors.create(
    1, 'rejected', 
    'Connection was rejected'
);

Errors.NO_VERSION_IDENTIFIER = Errors.create(
    2, 'no-version-identifier', 
    'A version identifier was not supplied'
);

Errors.CONNECTION_HANDSHAKE_UNRECOGNIZED = Errors.create(
    3, 'unrecognized-handshake',
    'Unrecognized handshake, should send SessionCreate message as first and only message'
);

Errors.CONNECTION_SESSION_TOKEN_UNRECOGNIZED = Errors.create(
    4, 'session-token-unrecognized',
    'Session token unrecognized'
);

Errors.CONNECTION_SESSION_ESTABLISH_TIMEDOUT = Errors.create(
    5, 'session-establish-timedout',
    'Session took long to establish and timed out'
);

Errors.SERVER_ERROR = Errors.create(
    6, 'server-error',
    'Internal server error'
);

Errors.SCOPE_NOT_FOUND = Errors.create(
    7, 'scope-not-found',
    'Scope not found'
);

Errors.COULD_NOT_APPLY_SYNC_MESSAGE = Errors.create(
    8, 'could-not-apply-sync-message',
    'Could not apply SyncMessage'
);
