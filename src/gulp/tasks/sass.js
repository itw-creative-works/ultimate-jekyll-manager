// Libraries
const Manager = new (require('../../build.js'));
const logger = Manager.logger('sass');
const { src, dest, watch, series } = require('gulp');
const compiler = require('gulp-sass')(require('sass'));
const cleanCSS = require('gulp-clean-css');

// Glob
const input = [
  // Files to include
  'src/assets/css/**/*.{css,scss,sass}',

  // Main files
  `${__dirname}/../../assets/css/main.scss`,

  // Files to exclude
  // '!dist/**',
];
const output = 'dist/assets/css';
const delay = 250;

// SASS Compilation Task
function sass(complete) {
  // Log
  logger.log('Starting...');

  // Compile
  return src(input)
    .pipe(compiler({ outputStyle: 'compressed' }).on('error', compiler.logError))
    .pipe(cleanCSS())
    .pipe(dest(output))
    .on('end', () => {
      // Log
      logger.log('Finished!');

      // Complete
      return complete();
    });
}

// Watcher Task
function sassWatcher(complete) {
  // Quit if in build mode
  if (process.env.UJ_BUILD_MODE === 'true') {
    logger.log('[watcher] Skipping watcher in build mode');
    return complete();
  }

  // Log
  logger.log('[watcher] Watching for changes...');

  // Watch for changes
  watch(input, { delay: delay }, sass)
  .on('change', function(path) {
    logger.log(`[watcher] File ${path} was changed`);
  });

  // Complete
  return complete();
}

// Default Task
module.exports = series(sass, sassWatcher);
