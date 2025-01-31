// Libraries
const path = require('path');
const { src, dest, watch, series } = require('gulp');
const sharp = require('sharp');

// Glob
const input = [
  // Files to include
  'site/assets/images/**/*.{jpg,jpeg,png}',

  // Files to exclude
  // '!site/compiled/**',
];
const output = 'site/compiled/images';

// SASS Compilation Task
function imagemin(done) {
  // Log
  console.log('*** Compiling IMAGES ***');

  // Compile
  return src(input)
    .pipe(sharp({
      progressive: true,
      quality: 70,
    }))
    .pipe(dest(output))
    .on('end', done);
}

// Watcher Task
function watcher(complete) {
  // Watch for changes
  watch(
    input,
    { delay: 250 },
    imagemin
  );

  // Complete
  return complete();
}

// Default Task
module.exports = series(imagemin, watcher);
