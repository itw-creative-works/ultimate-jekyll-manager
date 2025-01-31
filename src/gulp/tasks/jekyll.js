// Libraries
const Manager = require('../../index.js');
const path = require('path');
const { execute } = require('node-powertools');

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
  console.log('---- 1');

  // Increment index
  index++;

  // Clean if on index 0
  if (index === 0) {
    await execute('npx uj clean', {log: true});
  }

  // Wait 5 seconds
  // await new Promise((resolve) => setTimeout(resolve, 5000));

  // Run prebuild hook
  await hooks.prebuild(Manager, index);

  // Build Jekyll
  const command = [
    'bundle exec jekyll build',
    '--source site',
    '--config ./node_modules/ultimate-jekyll-manager/dist/config/_config_main.yml,site/_config.yml,.temp/_config_browsersync.yml',
    '--incremental',
  ]

  // Log command
  console.log(`Running command: ${command.join(' ')}`);

  // Build Jekyll
  await execute(command.join(' '), {log: true});

  // Run postbuild hook
  await hooks.postbuild(Manager, index);

  // Complete
  return complete();
};


function loadHook(file) {
  const fullPath = path.join(process.cwd(), 'hooks', `${file}.js`);

  try {
    return require(fullPath);
  } catch (e) {
    // Log
    console.warn(`Hook not found: ${fullPath}`, e);

    // Return a noop function
    return () => {};
  }
}
