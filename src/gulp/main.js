// Libraries
const path = require('path');
const jetpack = require('fs-jetpack');
const { series, parallel, watch } = require('gulp');
const Manager = new (require('../index.js'));
const logger = Manager.logger('main');

// Load tasks
const tasks = jetpack.list(path.join(__dirname, 'tasks'));

// Log
// logger.log('---tasks 1', path.join(__dirname, 'tasks'));
// logger.log('---tasks 2', tasks);

// Init global
global.tasks = {};
global.browserSync = null;

// Load tasks
tasks.forEach((file) => {
  const name = file.replace('.js', '');

  // Log
  // logger.log('Loading task:', name);

  // Export task
  exports[name] = require(path.join(__dirname, 'tasks', file));
});

// Log tasks
// logger.log('exports:', exports);

// Set global variable to access tasks in other files
global.tasks = exports;

// Define build process
exports.build = series(
  parallel(exports.sass, exports.webpack, exports.imagemin),
  exports.jekyll,
);

// Watch for changes
exports.watcher = function watcher() {
  watch(
    [
      // Files to include
      'site/**/*',
      // '**/*.html',
      // '**/*.md',
      // '**/*.yml',
      // '**/*.scss',
      // '**/*.js',

      // Files to exclude
      '!_site/**',
      '!site/.jekyll-cache/**',
      '!site/.jekyll-metadata',
      // '!site/compiled/**',
      // '!./node_modules/**/*',
    ],
    { delay: 500 },
    series(exports.jekyll, (complete) => {
      // Log
      logger.log('Reloading browser...');

      // Reload
      global.browserSync.notify('Rebuilt Jekyll');
      global.browserSync.reload();

      // Complete
      return complete();
    })
  );
}

// Compose task scheduler
exports.default = series(
  exports.build,
  exports.serve,
  exports.watcher,
);

