// Libraries
const Manager = new (require('../../index.js'));
const logger = Manager.logger('sass');
const { src, dest, watch, series } = require('gulp');
const compiler = require('gulp-sass')(require('sass'));
const cleanCSS = require('gulp-clean-css');

// Glob
const input = [
  // Files to include
  'src/assets/css/**/*.{css,scss,sass}',

  // Files to exclude
  // '!dist/**',
];
const output = 'dist/assets/css';

// SASS Compilation Task
function sass(complete) {
  // Log
  logger.log('Starting SASS compilation...');

  // Compile
  return src(input)
    .pipe(compiler({ outputStyle: 'compressed' }).on('error', compiler.logError))
    .pipe(cleanCSS())
    .pipe(dest(output))
    .on('end', () => {
      // Log
      logger.log('Finished SASS compilation');

      // Complete
      return complete();
    });
}

// Watcher Task
function sassWatcher(complete) {
  // Quit if in build mode
  if (process.env.UJ_BUILD_MODE === 'true') {
    logger.log('Skipping SASS watcher in build mode');
    return complete();
  }

  // Log
  logger.log('Watching for SASS changes...');

  // Watch for changes
  watch(input, { delay: 250 }, sass);

  // Complete
  return complete();
}

// Default Task
module.exports = series(sass, sassWatcher);
