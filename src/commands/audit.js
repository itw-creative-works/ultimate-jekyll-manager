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

  // Get options with defaults
  const lighthouseUrl = options.lighthouseUrl || '/';
  const autoExit = options.autoExit !== 'false'; // Default true unless explicitly 'false'

  // Build environment variables with all options
  const envVars = `UJ_AUDIT_FORCE=true UJ_AUDIT_AUTOEXIT=${autoExit} UJ_AUDIT_LIGHTHOUSE_URL="${lighthouseUrl}"`;

  // Run the full build process with audit force enabled
  await execute(`npx uj clean && ${envVars} bundle exec npm run gulp --`, { log: true })
};
