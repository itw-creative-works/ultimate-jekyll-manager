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

  // Parse lighthouse URL from arguments
  let lighthouseUrl = null;

  // Check if it's in the parsed options
  if (options.lighthouseUrl) {
    lighthouseUrl = options.lighthouseUrl;
  } else if (options._ && options._.length > 0) {
    // Look for --lighthouseUrl= in the _ array
    const urlArg = options._.find(arg => arg.startsWith('--lighthouseUrl='));
    if (urlArg) {
      lighthouseUrl = urlArg.split('=')[1];
    }
  }

  // Build environment variables
  let envVars = 'UJ_AUDIT_FORCE=true UJ_AUDIT_AUTOEXIT=true';

  // Add lighthouse URL if provided
  if (lighthouseUrl) {
    envVars += ` UJ_AUDIT_LIGHTHOUSE_URL="${lighthouseUrl}"`;
  }

  // Run the full build process with audit force enabled
  await execute(`npx uj clean && ${envVars} bundle exec npm run gulp --`, { log: true })
};
