// Libraries
const path = require('path');
const jetpack = require('fs-jetpack');
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

// getCleanVersions
Manager.getCleanVersions = function () {
  const package = Manager.getPackage('main');

  // loop through package.engines and run version.clean on each, then return the object
  return Object.keys(package.engines).reduce((acc, key) => {
    acc[key] = version.clean(package.engines[key]);
    return acc;
  }
  , {});
}
Manager.prototype.getCleanVersions = Manager.getCleanVersions;

// Require
Manager.require = function (path) {
  return require(path);
};
Manager.prototype.require = Manager.require;

// Export
module.exports = Manager;
