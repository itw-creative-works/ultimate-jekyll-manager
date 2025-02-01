// Libraries
const Manager = new (require('../../index.js'));
const logger = Manager.logger('distribute');
const { src, dest, watch, series } = require('gulp');

// Glob
const input = [
  // Files to include
  'src/**/*',

  // Files to exclude
  // '!dist/**',
];
const output = 'dist';

// Main task
function distribute(complete) {
  // Log
  logger.log('Starting distribute...');

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
    logger.log('Skipping distribute watcher in build mode');
    return complete();
  }

  // Log
  logger.log('Watching for distribute changes...');

  // Watch for changes
  watch(input, { delay: 250 }, distribute);

  // Complete
  return complete();
}

// Default Task
module.exports = series(distribute, distributeWatcher);
