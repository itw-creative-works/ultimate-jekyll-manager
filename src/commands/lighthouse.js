// Libraries
const Manager = new (require('../build.js'));
const logger = Manager.logger('lighthouse');
const { execute } = require('node-powertools');

// Load package
const package = Manager.getPackage('main');
const project = Manager.getPackage('project');

module.exports = async function (options) {
  // Log
  logger.log(`Starting Lighthouse audit...`);

  // Parse lighthouse URL from arguments
  let lighthouseUrl = null;
  
  // Check if it's in the parsed options
  if (options.url || options.lighthouseUrl) {
    lighthouseUrl = options.url || options.lighthouseUrl;
  } else if (options._ && options._.length > 0) {
    // Look for --url= or --lighthouseUrl= in the _ array
    const urlArg = options._.find(arg => arg.startsWith('--url=') || arg.startsWith('--lighthouseUrl='));
    if (urlArg) {
      lighthouseUrl = urlArg.split('=')[1];
    }
  }
  
  // Set lighthouse URL if found
  if (lighthouseUrl) {
    process.env.UJ_AUDIT_LIGHTHOUSE_URL = lighthouseUrl;
    logger.log(`Lighthouse URL set to: ${lighthouseUrl}`);
  }

  // Build environment variables
  let envVars = 'UJ_AUDIT_FORCE=true UJ_AUDIT_AUTOEXIT=true';
  
  // Add lighthouse URL if provided (defaults to root if not specified)
  if (lighthouseUrl) {
    envVars += ` UJ_AUDIT_LIGHTHOUSE_URL="${lighthouseUrl}"`;
  } else {
    // Default to testing the root page
    envVars += ' UJ_AUDIT_LIGHTHOUSE_URL="/"';
  }
  
  // Run the full build process with audit enabled
  let command = `${envVars} bundle exec npm run gulp --`;

  await execute(command, { log: true })
};