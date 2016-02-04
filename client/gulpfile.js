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

var browserify = require('browserify');
var gulp = require('gulp');
var jshint = require('gulp-jshint');
var rename = require('gulp-rename');
var transform = require('vinyl-transform');
var uglify = require('gulp-uglify');
var util = require('gulp-util');

gulp.task('build', function() {
  var browserified = transform(function(filename) {
    return browserify(filename, { standalone: 'Jetstream' }).bundle();
  });

  var stream = gulp.src(['./index.js'])
    .pipe(browserified)
    .pipe(rename({ basename: 'jetstream' }))
    .pipe(gulp.dest('./build'));

  if (util.env.production) {
    stream
      .pipe(util.env.production ? uglify() : util.noop())
      .pipe(util.env.production ? rename({ extname: '.min.js' }) : util.noop())
      .pipe(gulp.dest('./build'));
  }

  return stream;
});

gulp.task('jshint', function() {
  return gulp.src(['./**/*.js', '!build/**', '!node_modules/**'])
    .pipe(jshint())
    .pipe(jshint.reporter('jshint-stylish'));
});

gulp.task('watch', function() {
  gulp.watch(['./index.js', './lib/**/*.js'], ['build']);
});
