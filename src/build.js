// Libraries
const jetpack = require('fs-jetpack');
const path = require('path');
const yaml = require('js-yaml');
const { execute } = require('node-powertools');

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

// isServer
Manager.isServer = function () {
  return process.env.UJ_IS_SERVER === 'true';
}
Manager.prototype.isServer = Manager.isServer;

// getEnvironment (calls isServer ? 'production' : 'development')
Manager.getEnvironment = function () {
  return this.isServer() ? 'production' : 'development';
}
Manager.prototype.getEnvironment = Manager.getEnvironment;

// getConfig: requires and parses config.yml
Manager.getConfig = function () {
  return yaml.load(jetpack.read('src/_config.yml'));
}
Manager.prototype.getConfig = Manager.getConfig;

// Require
Manager.require = function (path) {
  return require(path);
};
Manager.prototype.require = Manager.require;

// Export
module.exports = Manager;
