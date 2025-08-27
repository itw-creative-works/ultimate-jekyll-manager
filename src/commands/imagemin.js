// Libraries
const Manager = new (require('../build.js'));
const logger = Manager.logger('imagemin');
const { execute } = require('node-powertools');

// Load package
const package = Manager.getPackage('main');
const project = Manager.getPackage('project');

module.exports = async function (options) {
  // Log
  logger.log(`Starting imagemin...`);

  await execute('npx uj clean && UJ_IMAGEMIN_FORCE=true bundle exec npm run gulp -- imagemin', { log: true })
};
