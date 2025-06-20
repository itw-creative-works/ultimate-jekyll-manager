// Libraries
const Manager = new (require('../build.js'));
const logger = Manager.logger('audit');
const { execute } = require('node-powertools');

// Load package
const package = Manager.getPackage('main');
const project = Manager.getPackage('project');

module.exports = async function (options) {
  // Log
  logger.log(`Starting audit...`);

  await execute('UJ_AUDIT_FORCE=true bundle exec npm run gulp -- audit', { log: true })
};
