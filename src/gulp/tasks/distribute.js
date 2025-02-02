// Libraries
const Manager = new (require('../../index.js'));
const logger = Manager.logger('distribute');
const { src, dest, watch, series } = require('gulp');
const jetpack = require('fs-jetpack');
const path = require('path');

// Glob
const input = [
  // Files to include
  'src/**/*',

  // Files to exclude
  // '!dist/**',
];
const output = 'dist';

// Index
let index = -1;

// Main task
function distribute(complete) {
  // Increment index
  index++;

  // Log
  logger.log('Starting distribute...');

  // Copy all files from src/defaults/dist on first run
  if (index === 0) {
    // Get the directory
    const dir = path.join(__dirname, '..', '..', 'defaults', 'dist');

    // Log
    logger.log(`Copying default dist files from ${dir}`);

    // Copy the files
    jetpack.copy(dir, 'dist', { overwrite: true });
  }

  // Complete
  return src(input)
    .pipe(dest(output))
    .on('end', () => {
      // Log
      logger.log('Finished distribute');

      // Complete
      return complete();
    });
}

// Watcher task
function distributeWatcher(complete) {
  // Quit if in build mode
  if (process.env.UJ_BUILD_MODE === 'true') {
    logger.log('[watcher] Skipping distribute watcher in build mode');
    return complete();
  }

  // Log
  logger.log('[watcher] Watching for distribute changes...');

  // Watch for changes
  watch(input, { delay: 250 }, distribute)
  .on('change', function(path) {
    logger.log(`[watcher] File ${path} was changed`);
  });

  // Complete
  return complete();
}

// Default Task
module.exports = series(distribute, distributeWatcher);
