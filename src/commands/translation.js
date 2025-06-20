// Libraries
const Manager = new (require('../build.js'));
const logger = Manager.logger('translation');
const { execute } = require('node-powertools');

// Load package
const package = Manager.getPackage('main');
const project = Manager.getPackage('project');

module.exports = async function (options) {
  // Log
  logger.log(`Starting translation...`);

  await execute('UJ_TRANSLATION_FORCE=true bundle exec npm run gulp -- translation', { log: true })
};
