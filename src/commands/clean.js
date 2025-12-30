// Libraries
const Manager = new (require('../build.js'));
const logger = Manager.logger('clean');
const { execSync } = require('child_process');
const jetpack = require('fs-jetpack');

// Load package
const package = Manager.getPackage('main');
const project = Manager.getPackage('project');

// Const dirs
const dirs = [
  '.temp',
  'dist',
  '_site',
]

module.exports = async function (options) {
  options = options || {};

  // Build list of directories to clean
  const dirsToClean = [...dirs];

  // Add .cache if requested (skip if explicitly set to 'false')
  if (options.cache !== 'false') {
    dirsToClean.push('.cache');
  }

  // Log
  logger.log(`Cleaning up [${dirsToClean.join(', ')}] directories (including .jekyll-cache and .jekyll-metadata)`);

  try {
    // Loop through dirs
    dirsToClean.forEach((dir) => {
      // Remove (use rm -rf on Unix for speed, fallback to jetpack on Windows)
      if (process.platform !== 'win32') {
        execSync(`rm -rf ${dir}`, { stdio: 'ignore' });
      } else {
        jetpack.remove(dir);
      }

      // Create empty dir
      jetpack.dir(dir);
    });
  } catch (e) {
    logger.error(`Error clearing directories: ${e}`);
  }
};
