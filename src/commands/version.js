const package = require('../../package.json');

module.exports = async function (options) {
  console.log(package.version);
};
