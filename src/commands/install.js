// Libraries
const Manager = new (require('../build.js'));
const logger = Manager.logger('install');
const path = require('path');
const jetpack = require('fs-jetpack');
const { execute } = require('node-powertools');
const os = require('os');

// Load package
const package = jetpack.read(path.join(__dirname, '../../', 'package.json'), 'json');
const project = jetpack.read(path.join(process.cwd(), 'package.json'), 'json');

module.exports = async function (options) {
  // Log
  logger.log(`Installing Ultimate Jekyll Manager...`);

  // Get type
  const type = options._[1] || 'prod';

  try {
    // Install production
    if (['prod', 'p', 'production'].includes(type)) {
      // Log
      logger.log('Installing production...');

      // Install
      await install('npm uninstall ultimate-jekyll-manager');
      await install('npm install ultimate-jekyll-manager@latest --save-dev');

      // Return
      return logger.log('Production installation complete.');
    }

    // Install development
    if (['dev', 'd', 'development', 'local', 'l'].includes(type)) {
      // Log
      logger.log('Installing development...');

      // Install
      await install('npm uninstall ultimate-jekyll-manager');
      await install(`npm install ${os.homedir()}/Developer/Repositories/ITW-Creative-Works/ultimate-jekyll-manager --save-dev`);

      // Return
      return logger.log('Development installation complete.');
    }

  } catch (e) {
    logger.error(`Error during install:`, e);
  }
};

function install(command) {
  return execute(command, { log: true });
}
