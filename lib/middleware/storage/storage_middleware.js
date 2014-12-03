//
// storage_middleware.js
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

module.exports = StorageMiddleware;

function StorageMiddleware(options) {
    options = options || {};

    if (typeof options.fetchRootModelObjectForScope !== 'function') {
        throw new Error('Requires fetchRootModelObjectForScope method');
    }

    if (typeof options.applySyncFragmentsForScope !== 'function') {
        throw new Error('Requires applySyncFragmentsForScope method');
    }

    // This method is passed the following arguments:
    // @param scope {Scope} The scope to fetch the root model for
    // @param callback {Function} The callback, should be called back with:
    //   @param error {Error} If error should be the error or null
    //   @param fetchedRootModelObject {ModelObject} The fetched root model object on success
    //
    // For further details see the wiki documentation
    this.fetchRootModelObjectForScope = options.fetchRootModelObjectForScope.bind(options);

    // This method is passed the following arguments:
    // @param scope {Scope} The scope to apply the sync fragments for
    // @param syncFragments {Array} An array of {SyncFragment}s requested to apply
    // @param callback {Function} The callback, should be called with:
    //   @param error {Error} If error should be the error or null
    //   @param results {Array} An array of {Object} describing the result for each {SyncFragment}
    //
    // For further details see the wiki documentation
    this.applySyncFragmentsForScope = options.applySyncFragmentsForScope.bind(options);
}
