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
const config = Manager.getConfig('project');
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
      // Add browsersync config IF BUILD_MODE is not true
      Manager.isBuildMode() ? '' : '.temp/_config_browsersync.yml',
      // Add development config IF BUILD_MODE is not true
      Manager.isBuildMode() ? '' : `./node_modules/${package.name}/dist/config/_config_development.yml`,
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

  // Create build JSON with runtime config
  await createBuildJSON();

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
    logger.log(`[watcher] File changed (${path})`);

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

// Get git info
async function getGitInfo() {
  return await execute('git remote -v')
  .then((r) => {
    // Split on whitespace
    const split = r.split(/\s+/);
    const url = split[1];

    // Get user and repo
    const user = url.split('/')[3];
    const name = url.split('/')[4].replace('.git', '');

    // Return
    return {user, name};
  })
}

// Get runtime Jekyll config
async function getRuntimeConfig() {
  try {
    // Check if Jekyll generated the site config file
    const siteConfigPath = '_site/config.json';
    if (jetpack.exists(siteConfigPath)) {
      const runtimeConfig = jetpack.read(siteConfigPath, 'json');
      logger.log('Using runtime Jekyll config from config.json');
      return runtimeConfig;
    }

    // Fallback to static config if runtime config not found
    logger.log('No runtime config found at _site/config.json, using static config');
    return config;
  } catch (e) {
    logger.error('Error reading runtime config:', e);
    return config;
  }
}

// Create build.json
async function createBuildJSON() {
  // Create build log JSON
  try {
    // Get info first
    const git = await getGitInfo();

    // Get runtime config
    const runtimeConfig = await getRuntimeConfig();

    // Create JSON
    const json = {
      timestamp: new Date().toISOString(),
      repo: {
        user: git.user,
        name: git.name,
      },
      environment: Manager.getEnvironment(),
      packages: {
        'web-manager': require('web-manager/package.json').version,
        [package.name]: package.version,
      },
      config: runtimeConfig,
    }

    // Add legacy properties
    // TODO: REMOVE WHEN THE SITE HAS BEEN ACTIVE FOR SOME TIME SO USERS ARE FORCED TO NEW BUILD.JSON
    {
      json['npm-build'] = new Date().toISOString();
      // json.brand = config.brand;
      // json['admin-dashboard'] = JSON.parse(config['admin-dashboard']);
    }

    // Write to file
    jetpack.write('_site/build.json', JSON.stringify(json, null, 2));

    // Write to legacy file /@output/build/build.json
    // TODO: REMOVE WHEN THE SITE HAS BEEN ACTIVE FOR SOME TIME SO USERS ARE FORCED TO NEW BUILD.JSON
    jetpack.write('_site/@output/build/build.json', JSON.stringify(json, null, 2));

    // Log
    logger.log('Created build.json with runtime config');
  } catch (e) {
    console.error('Error updating build.json', e);
  }
}
