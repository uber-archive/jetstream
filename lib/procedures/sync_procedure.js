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

module.exports = SyncProcedure;

var Constraint = require('./constraint');
var deepFreeze = require('deep-freeze-strict');
var SyncProcedureResult = require('./sync_procedure_result');

function SyncProcedure(options) {
    options = options || {};

    if (typeof options.name !== 'string') {
        throw new Error('Requires name');
    }

    if (!Array.isArray(options.constraints) || options.constraints.length < 1) {
        throw new Error('Procedure \'' + options.name + '\' has no constraints');
    }

    this.name = options.name;
    this.constraints = options.constraints.map(function(options) {
        return new Constraint(options);
    });
    this.options = deepFreeze(options);
}

SyncProcedure.validateSyncProcedureTypeOrThrow = function(procedureType) {
    if (typeof procedureType !== 'function') {
        throw new Error('Not a valid procedure type, not a function');
    }
    if (typeof procedureType.prototype.execute !== 'function') {
        throw new Error('Not a valid procedure type, no \'execute\' method');
    }
};

SyncProcedure.prototype.verifyAndExecute = function(scope, syncFragments, callback) {
    var constraintsMatches = false;
    if (scope.disableProcedureConstraints) {
        constraintsMatches = true;
    } else {
        constraintsMatches = Constraint.matchesAllConstraints(scope, this.constraints, syncFragments);
    }

    if (!constraintsMatches) {
        return callback(new Error('Changes do not match the procedure constraints'));
    }
    this.execute(scope, syncFragments, callback);
};

SyncProcedure.prototype.execute = function(scope, syncFragments, callback) {
    // This is a no-op, derived sync procedures should override this method
    callback(null, new SyncProcedureResult({additionalFragments: []}));
};
