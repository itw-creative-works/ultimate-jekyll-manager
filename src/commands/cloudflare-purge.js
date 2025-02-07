// Libraries
const Manager = new (require('../build.js'));
const logger = Manager.logger('cloudflare-purge');
const path = require('path');
const jetpack = require('fs-jetpack');
const { execute } = require('node-powertools');
const fetch = require('wonderful-fetch');

// Load package
const package = jetpack.read(path.join(__dirname, '../../', 'package.json'), 'json');
const project = jetpack.read(path.join(process.cwd(), 'package.json'), 'json');

// Get config
const config = Manager.getConfig();

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
