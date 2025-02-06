// Libraries
const Manager = new (require('../build.js'));
const logger = Manager.logger('setup');
const path = require('path');
const jetpack = require('fs-jetpack');
const version = require('wonderful-version');
const { execute, template } = require('node-powertools');
const NPM = require('npm-api');
const glob = require('glob').globSync;
const { minimatch } = require('minimatch');

// Load package
const package = jetpack.read(path.join(__dirname, '../../', 'package.json'), 'json');
const project = jetpack.read(path.join(process.cwd(), 'package.json'), 'json');
const templating = {
  nodeVersion: version.clean(package.engines.node),
  bundlerVersion: version.clean(package.engines.bundler),
  rubyVersion: version.clean(package.engines.ruby),
};

// Dependency MAP
const DEPENDENCY_MAP = {
  'gulp': 'dev',
}

// File MAP
const FILE_MAP = {
  // Files to skip overwrite
  'hooks/**/*': {overwrite: false},
  'src/**/*': {overwrite: false},

  // Files to rename
  '_.gitignore': {rename: '.gitignore'},

  // Files to run templating on
  '.github/workflows/build.yml': {template: templating},
}

module.exports = async function (options) {
  // Log
  logger.log(`Welcome to Ultimate Jekyll v${package.version}!`);
  logger.log(`Environment variables`, process.env);

  // Prefix project
  project.dependencies = project.dependencies || {};
  project.devDependencies = project.devDependencies || {};

  try {
    // Ensure this package is up-to-date
    await updateManager();

    // Ensure proper node version
    await ensureNodeVersion();

    // Ensure proper bundler version
    await ensureBundlerVersion();

    // Ensure proper ruby version
    await ensureRubyVersion();

    // Run the setup
    await ensurePeerDependencies();

    // Setup scripts
    await setupScripts();

    // Build files
    await buildSiteFiles();

    // Check which locality we are using
    await checkLocality();

  } catch (e) {
    logger.error(`Error during setup:`, e);
  }
};

async function updateManager() {
  const npm = new NPM();

  // Get the latest version
  const installedVersion = project.devDependencies['ultimate-jekyll-manager'];
  const latestVersion = await npm.repo('ultimate-jekyll-manager')
  .package()
    .then((pkg) => {
      return pkg.version;
    }, (e) => {
      return '0.0.0';
    });

  // Quit if local
  if (installedVersion.startsWith('file:')) {
    return logger.log('Local version detected. Skipping update check.');
  }

  // Log
  logger.log('Installed Version:', installedVersion);
  logger.log('Latest Version:', latestVersion);

  // Check if we need to update
  if (version.is(installedVersion, '>=', latestVersion)) {
    return logger.log('Ultimate Jekyll Manager is up-to-date.');
  } else {
    await install('ultimate-jekyll-manager', latestVersion);
  }
}

async function ensureNodeVersion() {
  const installedVersion = version.clean(process.version);
  const requiredVersion = version.clean(package.engines.node);

  // Log
  logger.log('Installed Node Version:', installedVersion);
  logger.log('Required Node Version:', requiredVersion);

  // Check if we need to update
  if (version.is(installedVersion, '>=', requiredVersion)) {
    return logger.log('Node version is up-to-date.');
  } else {
    throw new Error(`Node version is out-of-date. Required version is ${requiredVersion}.`);
  }
}

async function ensureBundlerVersion() {
  const installedVersion = version.clean(
    (await execute('bundler -v', { log: false })).match(/(\d+\.\d+\.\d+)/)[0]
  );
  const requiredVersion = version.clean(package.engines.bundler);

  // Log
  logger.log('Installed Bundler Version:', installedVersion);
  logger.log('Required Bundler Version:', requiredVersion);

  // Check if we need to update
  if (version.is(installedVersion, '>=', requiredVersion)) {
    return logger.log('Bundler version is up-to-date.');
  } else {
    throw new Error(`Bundler version is out-of-date. Required version is ${requiredVersion}.`);
  }
}

async function ensureRubyVersion() {
  const installedVersion = version.clean(
    (await execute('ruby -v', { log: false })).match(/(\d+\.\d+\.\d+)/)[0]
  );
  const requiredVersion = version.clean(package.engines.ruby);

  // Log
  logger.log('Installed Ruby Version:', installedVersion);
  logger.log('Required Ruby Version:', requiredVersion);

  // Check if we need to update
  if (version.is(installedVersion, '>=', requiredVersion)) {
    return logger.log('Ruby version is up-to-date.');
  } else {
    throw new Error(`Ruby version is out-of-date. Required version is ${requiredVersion}.`);
  }
}

async function ensurePeerDependencies() {
  const requiredPeerDependencies = package.peerDependencies || {};

  // Loop through and make sure project has AT LEAST the required version
  for (const [dependency, ver] of Object.entries(requiredPeerDependencies)) {
    const projectDependencyVersion = project.dependencies[dependency] || project.devDependencies[dependency];
    const location = DEPENDENCY_MAP[dependency] === 'dev' ? '--save-dev' : '';

    // Log
    logger.log('Checking peer dep:', dependency, '-->', projectDependencyVersion, '>=', ver);

    // Install if not found
    if (
      // Not found
      !projectDependencyVersion
      // Not the right version
      || version.is(projectDependencyVersion, '<', ver)
    ) {
      await install(dependency, ver, location);
    }
  }
}

function setupScripts() {
  // Setup the scripts
  project.scripts = project.scripts || {};

  // Setup the scripts
  Object.keys(package.projectScripts).forEach((key) => {
    project.scripts[key] = package.projectScripts[key];
  });

  // Save the project
  jetpack.write(path.join(process.cwd(), 'package.json'), project);
}

function checkLocality() {
  const installedVersion = project.devDependencies['ultimate-jekyll-manager'];

  if (installedVersion.startsWith('file:')) {
    console.warn('⚠️⚠️⚠️ You are using the local version of Ultimate Jekyll Manager. This WILL NOT WORK when published. ⚠️⚠️⚠️');
  }
}

function install(package, ver, location) {
  // Default to latest
  ver || 'latest';

  // Clean version if needed
  ver = ver === 'latest' ? ver : version.clean(ver);

  // Build the command
  let command = `npm install ${package}@${ver} ${location || '--save'}`;

  // Log
  logger.log('Installing:', command);

  // Execute
  return execute(command, { log: true })
  .then(async () => {
    // Read new project
    const projectUpdated = jetpack.read(path.join(process.cwd(), 'package.json'), 'json');

    // Log
    logger.log('Installed:', package, ver);

    // Update package object
    project.dependencies = projectUpdated.dependencies;
    project.devDependencies = projectUpdated.devDependencies;
  });
}

function buildSiteFiles() {
  // Loop through all files in /defaults directory
  const dir = path.join(__dirname, '..', 'defaults');
  const input = [
    // Files to include
    '**/*',

    // Files to exclude
    '!**/.DS_Store', // TODO: NOT WORKING
  ]

  // Get all files
  const files = glob(input, {
    cwd: dir,
    dot: true,
    nodir: true,
  });

  // Log
  // logger.log('Files:', files)

  // Loop
  for (const file of files) {
    // Get the destination
    const source = path.join(dir, file);
    let destination = path.join(process.cwd(), file.replace('defaults/', ''));
    const filename = path.basename(destination);
    const options = getFileOptions(file);

    // Quit if file is '_'
    if (filename === '_') {
      // First, create the directory around the file
      jetpack.dir(destination.split(path.sep).slice(0, -1).join(path.sep));

      // Skip
      continue;
    }

    // Rename if needed
    if (options.rename) {
      destination = destination.replace(filename, options.rename);
    }

    // Check if the file exists
    const exists = jetpack.exists(destination);

    // Log
    // logger.log('File:', file);
    // logger.log('filename:', filename);
    // logger.log('options:', options);
    // logger.log('contents:', jetpack.read(source));
    // logger.log('source:', source);
    // logger.log('Destination:', destination);

    // Skip if exists and we don't want to overwrite
    if (exists && !options.overwrite) {
      continue;
    }

    // Run templating if needed
    if (options.template) {
      // Log
      // logger.log('Running templating on:', destination);

      // Run the templating
      const contents = jetpack.read(source);
      const templated = template(contents, options.template);

      // Write the file
      jetpack.write(destination, templated);
    } else {
      // Copy the file
      jetpack.copy(source, destination, { overwrite: true });
    }
  }
}
function getFileOptions(filePath) {
  const defaults = {
    overwrite: true,
    rename: null,
    template: null,
  };

  // Loop through all patterns
  for (const pattern in FILE_MAP) {
    if (minimatch(filePath, pattern)) {
      return { ...defaults, ...FILE_MAP[pattern] };
    }
  }

  // Default
  return defaults;
}
