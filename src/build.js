// Libraries
const path = require('path');
const jetpack = require('fs-jetpack');
const fs = require('fs');
const JSON5 = require('json5');
const argv = require('yargs').argv;
const { force } = require('node-powertools');
const yaml = require('js-yaml');
const version = require('wonderful-version');

// Class
function Manager() {
  const self = this;

  // Properties
  self._logger = null;

  // Return
  return self;
}

// Initialize
Manager.prototype.initialize = function () {
  console.log('initialize:');
};

// Logger
Manager.prototype.logger = function (name) {
  // Create logger
  if (!this._logger) {
    this._logger = new (require('./lib/logger'))(name);
  }

  return this._logger;
};

// argv
Manager.getArguments = function () {
  const options = argv || {};

  // Fix
  options._ = options._ || [];
  options.browser = force(options.browser === undefined ? true : options.browser, 'boolean');
  options.debug = force(options.debug === undefined ? false : options.debug, 'boolean');

  // Return
  return options;
};
Manager.prototype.getArguments = Manager.getArguments;

// isServer
Manager.isServer = function () {
  return process.env.UJ_IS_SERVER === 'true';
}
Manager.prototype.isServer = Manager.isServer;

// isBuildMode
Manager.isBuildMode = function () {
  return process.env.UJ_BUILD_MODE === 'true';
}
Manager.prototype.isBuildMode = Manager.isBuildMode;

// getEnvironment (calls isServer ? 'production' : 'development')
Manager.getEnvironment = function () {
  return Manager.isServer() ? 'production' : 'development';
}
Manager.prototype.getEnvironment = Manager.getEnvironment;

// getConfig: requires and parses config.yml
Manager.getConfig = function (type) {
  const basePath = type === 'project'
    ? 'src'
    : 'dist';
  const resolvedPath = path.join(basePath, '_config.yml');

  return yaml.load(jetpack.read(resolvedPath));
}
Manager.prototype.getConfig = Manager.getConfig;

// getPackage: requires and parses package.json
Manager.getPackage = function (type) {
  const basePath = type === 'project'
    ? process.cwd()
    : path.resolve(__dirname, '..')

  const pkgPath = path.join(basePath, 'package.json');

  return JSON5.parse(jetpack.read(pkgPath));
}
Manager.prototype.getPackage = Manager.getPackage;

// getRootPath: returns the root path of the project or package
Manager.getRootPath = function (type) {
  return type === 'project'
    ? process.cwd()
    : path.resolve(__dirname, '..')
}
Manager.prototype.getRootPath = Manager.getRootPath;

// Create dummy file in project dist to force jekyll to build
Manager.triggerRebuild = function (files, logger) {
  // Ensure logger is defined
  logger = logger || console;

  // Normalize files into an array of file names
  if (typeof files === 'string') {
    files = [files]; // Single string file name
  } else if (Array.isArray(files)) {
    // Already an array, no changes needed
  } else if (typeof files === 'object' && files !== null) {
    files = Object.keys(files); // Extract keys from object
  } else {
    logger.error('[sass] Invalid files argument');
    return;
  }

  // Set current time
  const now = new Date();

  // Touch all files to update mtime (so Jekyll notices)
  files.forEach((file) => {
    try {
      fs.utimesSync(file, now, now);
      logger.log(`Triggered build: ${file}`);
    } catch (e) {
      logger.error(`Failed to trigger build ${file}`, e);
    }
  });
}
Manager.prototype.triggerRebuild = Manager.triggerRebuild;

// Require
Manager.require = function (path) {
  return require(path);
};
Manager.prototype.require = Manager.require;

// Export
module.exports = Manager;
