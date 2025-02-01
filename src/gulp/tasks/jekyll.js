// Libraries
const Manager = new (require('../../index.js'));
const logger = Manager.logger('jekyll');
const path = require('path');
const { execute } = require('node-powertools');
const jetpack = require('fs-jetpack');

// Set index
let index = -1;

// Hooks
const hooks = {
  prebuild: loadHook('prebuild'),
  postbuild: loadHook('postbuild'),
}

// Flags
let browserSyncLaunched = false;

// Task
module.exports = async function jekyll(complete) {
  // Log
  logger.log('Starting Jekyll build...');

  // Increment index
  index++;

  // Run prebuild hook
  await hooks.prebuild(index);

  // Build Jekyll
  const command = [
    'bundle exec jekyll build',
    '--source dist',
    '--config ' + [
      './node_modules/ultimate-jekyll-manager/dist/templates/src/_config.yml',
      'dist/_config.yml',
      // Add browsesrsync IF BUILD_MODE is not true
      process.env.UJ_BUILD_MODE === 'true' ? '' : '.temp/_config_browsersync.yml',
    ].join(','),
    '--incremental',
  ]

  // Log command
  logger.log(`Running command: ${logger.format.gray(command.join(' '))}`);

  // Build Jekyll
  await execute(command.join(' '), {log: true});

  // Run postbuild hook
  await hooks.postbuild(index);

  // Log
  logger.log('Finished Jekyll build!');

  // Launch browser sync
  if (!browserSyncLaunched) {
    launchBrowserSync();
  }

  // Complete
  return complete();
};


function loadHook(file) {
  // Full path
  const fullPath = path.join(process.cwd(), 'hooks', `${file}.js`);

  // Log
  // logger.log(`Loading hook: ${fullPath}`);

  try {
    // Check if it exists
    if (!jetpack.exists(fullPath)) {
      throw new Error('Hook not found');
    }

    return require(fullPath);
  } catch (e) {
    // Log
    logger.error(`Error executing hook: ${fullPath}`, e);

    // Return a noop function
    return () => {};
  }
}

function launchBrowserSync() {
  // Quit if in build mode
  if (process.env.UJ_BUILD_MODE === 'true') {
    // Log
    logger.log('Skipping browser sync since in build mode');

    // Return
    return;
  }

  // Get external URL
  const externalUrl = global.browserSync.instance.options.get('urls').get('external');

  // Log
  logger.log(`Opening browser to: ${externalUrl}`);

  // Set flag
  browserSyncLaunched = true

  // Open the browser with the external URL
  return execute(`open ${externalUrl}`);
}
