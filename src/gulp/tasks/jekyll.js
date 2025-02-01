// Libraries
const path = require('path');
const { execute } = require('node-powertools');
const jetpack = require('fs-jetpack');
const Manager = new (require('../../index.js'));
const logger = Manager.logger('jekyll');

// Set index
let index = -1;

// Hooks
const hooks = {
  prebuild: loadHook('prebuild'),
  postbuild: loadHook('postbuild'),
}

// Task
module.exports = async function jekyll(complete) {
  // Log
  logger.log('Starting Jekyll build...');

  // Increment index
  index++;

  // Clean if on index 0
  if (index === 0) {
    await execute('npx uj clean', {log: true});
  }

  // Wait 5 seconds
  // await new Promise((resolve) => setTimeout(resolve, 5000));

  // Run prebuild hook
  await hooks.prebuild(index);

  // Build Jekyll
  const command = [
    'bundle exec jekyll build',
    '--source site',
    '--config ./node_modules/ultimate-jekyll-manager/dist/config/_config_main.yml,site/_config.yml,.temp/_config_browsersync.yml',
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
