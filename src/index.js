function Manager() {

}

Manager.prototype.initialize = function () {
  console.log('initialize:');
};


Manager.require = function (path) {
  return require(path);
};

module.exports = Manager;
