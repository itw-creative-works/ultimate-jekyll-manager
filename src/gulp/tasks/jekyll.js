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
  buildpre: loadHook('build:pre'),
  buildpost: loadHook('build:post'),
}

// Flags
let browserSyncLaunched = false;

// Task
module.exports = async function jekyll(complete) {
  // Log
  logger.log('Starting...');

  // Increment index
  index++;

  // Run buildpre hook
  await hooks.buildpre(index);

  // Build Jekyll
  const command = [
    'bundle exec jekyll build',
    '--source dist',
    '--config ' + [
      './node_modules/ultimate-jekyll-manager/dist/defaults/src/_config.yml',
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

  // Run buildpost hook
  await hooks.buildpost(index);

  // Log
  logger.log('Finished!');

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

async function launchBrowserSync() {
  // Quit if in build mode
  if (process.env.UJ_BUILD_MODE === 'true') {
    // Log
    logger.log('Skipping browser sync since in build mode');

    // Return
    return;
  }

  // Get external URL
  const externalUrl = global.browserSync.instance.options.get('urls').get('external');

  // Check if the tab is already open
  const isOpen = await isBrowserTabOpen(externalUrl);

  // Set flag
  browserSyncLaunched = true

  // Log
  if (isOpen) {
    logger.log('Switched to existing browser tab');
    return;
  }

  // Log
  logger.log(`Opening browser to: ${externalUrl}`);

  // Open the browser with the external URL
  return execute(`open ${externalUrl}`);
}

async function isBrowserTabOpen(url) {
  try {
    const script = `
      set logOutput to ""
      set foundMatch to false
      tell application "Google Chrome"
        set windowList to every window
        repeat with w in windowList
          set tabList to every tab of w
          set tabIndex to 1
          repeat with t in tabList
            set tabURL to URL of t
            set logOutput to logOutput & "Checking: " & tabURL & "\\n"
            if tabURL contains "${url}" then
              tell w to set active tab index to tabIndex
              tell application "System Events" to tell process "Google Chrome" to perform action "AXRaise" of window 1
              activate
              set foundMatch to true
              tell t to reload
            end if
            set tabIndex to tabIndex + 1
          end repeat
        end repeat
      end tell
      return foundMatch
    `;

    // Execute
    const result = await execute(`osascript -e '${script}'`);

    // Convert to boolean
    return result.trim() === 'true'; // Convert to boolean
  } catch (error) {
    return false;
  }
}
