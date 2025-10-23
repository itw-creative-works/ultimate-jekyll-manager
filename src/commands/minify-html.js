// Libraries
const Manager = new (require('../build.js'));
const logger = Manager.logger('minify');
const { execute } = require('node-powertools');

// Load package
const package = Manager.getPackage('main');
const project = Manager.getPackage('project');

module.exports = async function (options) {
  // Log
  logger.log(`Starting minify...`);

  // Build environment variables with all options
  const envVars = `UJ_MINIFY_HTML_FORCE=true`;

  // Run the full build process with minify force enabled
  await execute(`${envVars} bundle exec npm run gulp -- minifyHtml`, { log: true })
};
