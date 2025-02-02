// Libraries
const Manager = new (require('../index.js'));
const logger = Manager.logger('main');
const { series, parallel, watch } = require('gulp');
const path = require('path');
const jetpack = require('fs-jetpack');
const { execute } = require('node-powertools');

// Load tasks
const tasks = jetpack.list(path.join(__dirname, 'tasks'));

// Init global
global.tasks = {};
global.browserSync = null;

// Load tasks
tasks.forEach((file) => {
  const name = file.replace('.js', '');

  // Log
  logger.log('Loading task:', name);

  // Export task
  exports[name] = require(path.join(__dirname, 'tasks', file));
});

// Set global variable to access tasks in other files
global.tasks = exports;

// Define build process
exports.build = series(
  exports.clean,
  exports.distribute,
  parallel(exports.sass, exports.webpack, exports.imagemin),
  exports.jekyll,
);

// Watch for changes
exports.watcher = function watcher(complete) {
  // Log
  logger.log('Watching for main changes...');

  // Watcher: jekyll
  watch(
    [
      // Files to include
      'dist/**/*',

      // Files to exclude
      '!_site/**',
      '!dist/.jekyll-cache/**',
      '!dist/.jekyll-metadata',
      // '!./node_modules/**/*',
    ],
    { delay: 500 },
    series(exports.jekyll, (complete) => {
      // Log
      logger.log('Reloading browser...');

      // Open the browser with the external URL
      global.browserSync.notify('Rebuilt Jekyll');
      global.browserSync.reload();

      // Complete
      return complete();
    })
  )
  .on('change', function(path) {
    logger.log(`[watcher] File ${path} was changed`);
  });

  // Complete
  return complete();
}

// Compose task scheduler
exports.default = series(
  exports.clean,
  exports.serve,
  exports.build,
  exports.watcher,
);


