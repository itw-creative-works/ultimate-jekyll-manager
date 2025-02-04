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

// Require
Manager.require = function (path) {
  return require(path);
};
Manager.prototype.require = Manager.require;

// Export
module.exports = Manager;
