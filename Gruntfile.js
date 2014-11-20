//
// Gruntfile.js
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

var exec = require('child_process').exec;

module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        run: {
            test: {
                exec: './node_modules/.bin/cached-tape test/index.js | ./node_modules/.bin/tap-spec'
            },

            'test-cover': {
                exec: './node_modules/.bin/istanbul cover ./node_modules/.bin/cached-tape test/index.js'
            },

            'report-cover': {
                exec: './node_modules/.bin/istanbul report html'
            },

            'open-cover': {
                exec: './node_modules/.bin/opn ./coverage/index.html'
            },

            'demo-shapes': {
                exec: './node_modules/.bin/nodemon demos/shapes/app.js'
            }
        },

        watch: {
            test: {
                files: ['lib/**/*.js', 'test/**/*.js'],
                tasks: ['run:test']
            },

            'test-cover': {
                files: ['lib/**/*.js', 'test/**/*.js'],
                tasks: ['run:test', 'run:test-cover', 'run:report-cover']
            }
        }
    });

    grunt.loadNpmTasks('grunt-run');
    grunt.loadNpmTasks('grunt-contrib-watch');

    grunt.registerTask('test', ['run:test']);
    grunt.registerTask('test:file', function(file) {
        var done = this.async();
        var cmd = './node_modules/.bin/cached-tape ' + file + ' | ./node_modules/.bin/tap-spec';
        exec(cmd, function(err, stdout, stderr) {
            if (stdout) {
                process.stdout.write(stdout);
            }
            if (stderr) {
                process.stderr.write(stderr);
            }
            if (err) {
                done(false);
            } else {
                done();
            }
        });
    });

    grunt.registerTask('devtest', [
        'run:test',
        'run:test-cover', 
        'run:report-cover', 
        'watch:test-cover'
    ]);
};
