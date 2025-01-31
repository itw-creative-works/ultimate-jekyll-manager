// Libraries
const path = require('path');
const jetpack = require('fs-jetpack');

// Load package
const package = jetpack.read(path.join(__dirname, '../../', 'package.json'), 'json');
const project = jetpack.read(path.join(process.cwd(), 'package.json'), 'json');

module.exports = async function (options) {
  // Log
  console.log(`Cleaning up _site, .jekyll-cache, and .jekyll-metadata...`);

  try {
    // Delete _site, .jekyll-cache
    jetpack.remove('_site');
    jetpack.remove('site/.jekyll-cache');
    jetpack.remove('site/.jekyll-metadata');

  } catch (e) {
    console.error(`Error during setup:`, e);
  }
};
