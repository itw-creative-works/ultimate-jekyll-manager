// Libraries
const Manager = new (require('../../build.js'));
const logger = Manager.logger('jekyll');
const argv = Manager.getArguments();
const { series, watch } = require('gulp');
const glob = require('glob').globSync;
const path = require('path');
const { execute } = require('node-powertools');
const jetpack = require('fs-jetpack');

// Load package
const package = Manager.getPackage('main');
const project = Manager.getPackage('project');
const rootPathPackage = Manager.getRootPath('main');
const rootPathProject = Manager.getRootPath('project');

// Set index
let index = -1;

// Flags
let browserSyncLaunched = false;

// Glob
const input = [
  // Files to include
  'dist/**/*',

  // Include plugin so we can live-reload it
  `${rootPathPackage}/../jekyll-uj-powertools/**/*`,

  // Files to exclude
  '!dist/.jekyll-cache/**',
  '!dist/.jekyll-metadata',
];
const output = '';
const delay = 500;

// Task
async function jekyll(complete) {
  // Log
  logger.log('Starting...');

  // Increment index
  index++;

  // Notify
  if (global.browserSync) {
    global.browserSync.notify('Rebuilding...');
  }

  // Run buildpre hook
  await hook('build:pre', index);

  // Build Jekyll
  const command = [
    // Jekyll command
    'bundle exec jekyll build',
    '--source dist',
    '--config ' + [
      // This is the base config file with all the user-editable settings
      `./node_modules/${package.name}/dist/defaults/src/_config.yml`,
      // This is the default config with NON user-editable settings
      `./node_modules/${package.name}/dist/config/_config_default.yml`,
      // This is the user's project config file
      'dist/_config.yml',
      // Add browsesrsync IF BUILD_MODE is not true
      Manager.isBuildMode() ? '' : '.temp/_config_browsersync.yml',
    ].join(','),
    '--incremental',
    // '--disable-disk-cache',
  ]

  // Log command
  logger.log(`Running command: ${logger.format.gray(command.join(' '))}`);

  // Build Jekyll
  await execute(command.join(' '), {log: true});

  // Run buildpost hook
  await hook('build:post', index);

  // QUIT
  // QUIT

  // Log
  logger.log('Finished!');

  // Launch browser sync
  if (!browserSyncLaunched) {
    launchBrowserSync();
  }

  // Reload browser
  if (global.browserSync) {
    global.browserSync.reload();
  }

  // Complete
  return complete();
};

// Watch for changes
function jekyllWatcher(complete) {
  // Quit if in build mode
  if (Manager.isBuildMode()) {
    logger.log('[watcher] Skipping watcher in build mode');
    return complete();
  }

  // Log
  logger.log('[watcher] Watching for changes...');

  // Watch for changes
  watch(input, { delay: delay, dot: true }, jekyll)
  .on('change', (path) => {
    logger.log(`[watcher] File ${path} was changed`);

    // Check if changed file is a .rb file
    if (path.endsWith('.rb')) {
      logger.log(`[watcher] Detected .rb file, removing Jekyll cache...`);
      jetpack.remove('dist/.jekyll-cache');
      jetpack.remove('dist/.jekyll-metadata');
    }
  });

  // Complete
  return complete();
}

// Default Task
module.exports = series(jekyll, jekyllWatcher);

// Run hooks
async function hook(file, index) {
  // Full path
  const fullPath = path.join(process.cwd(), 'hooks', `${file}.js`);

  // Log
  // logger.log(`Loading hook: ${fullPath}`);

  // Check if it exists
  if (!jetpack.exists(fullPath)) {
    return console.warn(`Hook not found: ${fullPath}`);
  }

  // Log
  logger.log(`Running hook: ${fullPath}`);

  // Load hook
  let hook;
  try {
    // Load the hook
    hook = require(fullPath);
  } catch (e) {
    throw new Error(`Error loading hook: ${fullPath} ${e.stack}`);
  }

  // Execute hook
  try {
    return await hook(index);
  } catch (e) {
    throw new Error(`Error running hook: ${fullPath} ${e.stack}`);
  }
}

// Launch browser sync
async function launchBrowserSync() {
  // Quit if in build mode
  if (Manager.isBuildMode()) {
    // Log
    return logger.log('Skipping browser sync since in build mode');
  }

  // Quit if browser argument is false
  if (argv.browser === false) {
    // Log
    return logger.log('Skipping browser sync since browser argument is false');
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

// Check if browser tab is open
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
