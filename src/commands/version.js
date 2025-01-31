// Libraries
const path = require('path');
const jetpack = require('fs-jetpack');

// Load package
const package = jetpack.read(path.join(__dirname, '../../', 'package.json'), 'json');
const project = jetpack.read(path.join(process.cwd(), 'package.json'), 'json');

module.exports = async function (options) {
  // Log
  console.log(package.version);
};
