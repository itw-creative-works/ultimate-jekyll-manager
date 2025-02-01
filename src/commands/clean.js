// Libraries
const path = require('path');
const jetpack = require('fs-jetpack');

// Load package
const package = jetpack.read(path.join(__dirname, '../../', 'package.json'), 'json');
const project = jetpack.read(path.join(process.cwd(), 'package.json'), 'json');

// Const dirs
const dirs = [
  '_site',
  'dist',
  '.temp',
]

module.exports = async function (options) {
  // Log
  console.log(`Cleaning up _site, .jekyll-cache, and .jekyll-metadata...`);

  try {
    // Loop through dirs
    dirs.forEach((dir) => {
      // Remove
      jetpack.remove(dir);

      // Create empty dir
      jetpack.dir(dir);
    });
  } catch (e) {
    console.error(`Error clearing directories: ${e}`);
  }
};
