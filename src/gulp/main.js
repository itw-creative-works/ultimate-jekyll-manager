// Libraries
const Manager = new (require('../build.js'));
const logger = Manager.logger('main');
const argv = Manager.getArguments();
const { series, parallel, watch } = require('gulp');
const path = require('path');
const jetpack = require('fs-jetpack');

// Load package
const package = Manager.getPackage('main');
const project = Manager.getPackage('project');

// Log
logger.log('Starting...', argv);

// Load tasks
const tasks = jetpack.list(path.join(__dirname, 'tasks'));

// Init global
global.tasks = {};
global.browserSync = null;

// Set default env variables
process.env.UJ_BUILD_MODE = Manager.isBuildMode() ? 'true' : 'false';
process.env.UJ_IS_SERVER = Manager.isServer() ? 'true' : 'false';

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
  // exports.setup,
  // exports.clean,
  // exports.setup,
  exports.defaults,
  exports.distribute,
  parallel(exports.sass, exports.webpack, exports.imagemin),
  exports.jekyll,
  exports.translation,
);

// Compose task scheduler
exports.default = series(
  // exports.setup,
  // exports.clean,
  exports.serve,
  exports.build,
  exports.developmentRebuild,
  // exports.watcher,
);
