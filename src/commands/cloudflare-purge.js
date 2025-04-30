// Libraries
const Manager = new (require('../build.js'));
const logger = Manager.logger('cloudflare-purge');
const fetch = require('wonderful-fetch');

// Load package
const package = Manager.getPackage('main');
const project = Manager.getPackage('project');
const config = Manager.getConfig('project');

// Export
module.exports = async function (options) {
  // Log
  logger.log(`Running Cloudflare purge...`);

  // Get delay
  const delay = options.delay
    || (Manager.isServer() ? 60000 : 0);

  // Make request to Cloudflare
  try {
    await fetch('https://api.itwcreativeworks.com/wrapper', {
      method: 'post',
      response: 'json',
      log: true,
      body: {
        service: 'cloudflare',
        command: `client/v4/zones/${config.cloudflare.zone}/purge_cache`,
        method: 'post',
        body: {
          purge_everything: true
        },
        delay: delay,
      },
    })
    .then((r) => {
      logger.log('Cloudflare purge complete.', r);
    })
  } catch (e) {
    logger.error(`Error during install:`, e);
  }
};
