// Libraries
const Manager = new (require('../build.js'));
const logger = Manager.logger('deploy');
const { execute } = require('node-powertools');
const jetpack = require('fs-jetpack');
const path = require('path');

// Load package
const project = Manager.getPackage('project');

module.exports = async function (options) {
  options = options || {};

  // Check for local packages
  const allDeps = JSON.stringify(project.dependencies || {}) + JSON.stringify(project.devDependencies || {});

  if (allDeps.includes('file:')) {
    throw new Error('Please remove local packages before deploying!');
  }

  // Build
  await execute('npm run build', { log: true });

  // Deploy
  await execute(`npu sync --message='Deploy'`, { log: true });
};
