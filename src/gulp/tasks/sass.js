// Libraries
const path = require('path');
const { src, dest, watch, series } = require('gulp');
const compiler = require('gulp-sass')(require('sass'));
const cleanCSS = require('gulp-clean-css');

// Glob
const input = [
  // Files to include
  'site/assets/css/**/*.{css,scss,sass}',

  // Files to exclude
  // '!site/compiled/**',
];
const output = 'site/compiled/css';

// SASS Compilation Task
function sassTask(done) {
  // Log
  console.log('*** Compiling SASS ***');

  // Compile
  return src(input)
    .pipe(compiler({ outputStyle: 'compressed' }).on('error', compiler.logError))
    .pipe(cleanCSS())
    .pipe(dest(output))
    .on('end', done);
}

// Watcher Task
function watcher(complete) {
  // Watch for changes
  watch(
    input,
    { delay: 250 },
    sassTask
  );

  // Complete
  return complete();
}

// Default Task
module.exports = series(sassTask, watcher);
