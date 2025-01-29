// Libraries
const path = require('path');
const { execute } = require('node-powertools');

// Load package
const package = require('../../package.json');
const project = require(path.join(process.cwd(), 'package.json'));

module.exports = async function (options) {
  console.log(`Welcome to Ultimate Jekyll v${package.version}!`);

  // Log
  console.log('options:', options);
  console.log('project:', project);
  console.log('project:', project);

  // Get type
  const type = options._[1] || 'prod';

  try {
    // Install production
    if (['prod', 'p', 'production'].includes(type)) {
      await install('npm uninstall ultimate-jekyll-manager');
      await install('npm install ultimate-jekyll-manager@latest --save-dev');

      return console.log('Production installation complete.');
    }

    // Install development
    if (['dev', 'd', 'development', 'local', 'l'].includes(type)) {
      await install('npm uninstall ultimate-jekyll-manager');
      await install('npm install ../../ITW-Creative-Works/ultimate-jekyll-manager --save-dev');

      return console.log('Development installation complete.');
    }

  } catch (e) {
    console.error(`Error during install:`, e);
  }
};

function install(command) {
  return execute(command, { log: true });
}
