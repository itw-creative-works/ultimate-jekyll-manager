// Libraries
const Manager = new (require('../build.js'));
const logger = Manager.logger('repo');
const { execute } = require('node-powertools');

module.exports = async function () {
  // Log
  logger.log(`Opening GitHub repository...`);

  try {
    // Get the remote URL
    const result = await execute('git remote get-url origin', { log: false });
    let url = result.stdout.trim();

    if (!url) {
      throw new Error('No git remote origin found');
    }

    // Convert SSH URL to HTTPS URL if needed
    // git@github.com:user/repo.git -> https://github.com/user/repo
    if (url.startsWith('git@')) {
      url = url
        .replace('git@', 'https://')
        .replace(':', '/')
        .replace(/\.git$/, '');
    }

    // Remove .git suffix if present
    url = url.replace(/\.git$/, '');

    logger.log(`Repository URL: ${url}`);

    // Open the URL in the default browser
    await execute(`open "${url}"`, { log: false });

    logger.log(logger.format.green('✓ Opened repository in browser'));
  } catch (e) {
    logger.error('Failed to open repository:', e.message);
    throw e;
  }
};
