// Libraries
const Manager = new (require('../../build.js'));
const logger = Manager.logger('setup');
const { execute } = require('node-powertools');

// Load package
const package = Manager.getPackage('main');
const project = Manager.getPackage('project');
const config = Manager.getConfig('project');
const rootPathPackage = Manager.getRootPath('main');
const rootPathProject = Manager.getRootPath('project');

// Task
module.exports = async function setup(complete) {
  // Log
  logger.log('Starting setup...');

  // Run clean and setup
  await require('../../commands/clean.js')();
  // await require('../../commands/setup.js')();

  // Complete
  return complete();
}
