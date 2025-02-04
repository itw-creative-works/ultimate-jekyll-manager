// Libraries
const path = require('path');
const jetpack = require('fs-jetpack');
const wonderfulVersion = require('wonderful-version');
const { execute } = require('node-powertools');
const NPM = require('npm-api');
const glob = require('glob').globSync;

// Load package
const package = jetpack.read(path.join(__dirname, '../../', 'package.json'), 'json');
const project = jetpack.read(path.join(process.cwd(), 'package.json'), 'json');

// Dependency MAP
const DEPENDENCY_MAP = {
  'gulp': 'dev',
}

// File MAP
const FILE_MAP = {
  'hooks/build:pre.js': {overwrite: false},
  'hooks/build:post.js': {overwrite: false},
  'src/_config.yml': {overwrite: false},
  '_.gitignore': {rename: '.gitignore'},
}

module.exports = async function (options) {
  // Log
  console.log(`Welcome to Ultimate Jekyll v${package.version}!`);

  // Prefix project
  project.dependencies = project.dependencies || {};
  project.devDependencies = project.devDependencies || {};

  try {
    // Ensure this package is up-to-date
    await updateManager();

    // Ensure proper node version
    await ensureNodeVersion();

    // Run the setup
    await ensurePeerDependencies();

    // Setup scripts
    setupScripts();

    // Build files
    await buildSiteFiles();

    // Check which locality we are using
    checkLocality();

  } catch (e) {
    console.error(`Error during setup:`, e);
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
    return console.log('Local version detected. Skipping update check.');
  }

  // Log
  console.log('Installed Version:', installedVersion);
  console.log('Latest Version:', latestVersion);

  // Check if we need to update
  if (wonderfulVersion.is(installedVersion, '>=', latestVersion)) {
    return console.log('Ultimate Jekyll Manager is up-to-date.');
  } else {
    await install('ultimate-jekyll-manager', latestVersion);
  }
}

async function ensureNodeVersion() {
  const installedVersion = process.version;
  const requiredVersion = package.engines.node;

  // Log
  console.log('Installed Node Version:', installedVersion);
  console.log('Required Node Version:', requiredVersion);

  // Check if we need to update
  if (wonderfulVersion.is(installedVersion, '>=', requiredVersion)) {
    return console.log('Node version is up-to-date.');
  } else {
    console.error(`Node version is out-of-date. Required version is ${requiredVersion}.`);
  }
}

async function ensurePeerDependencies() {
  const requiredPeerDependencies = package.peerDependencies || {};

  // Loop through and make sure project has AT LEAST the required version
  for (const [dependency, version] of Object.entries(requiredPeerDependencies)) {
    const projectDependencyVersion = project.dependencies[dependency] || project.devDependencies[dependency];
    const location = DEPENDENCY_MAP[dependency] === 'dev' ? '--save-dev' : '';

    // Log
    console.log('Checking peer dep:', dependency, '-->', projectDependencyVersion, '>=', version);

    // Install if not found
    if (
      // Not found
      !projectDependencyVersion
      // Not the right version
      || wonderfulVersion.is(projectDependencyVersion, '<', version)
    ) {
      await install(dependency, version, location);
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

function install(package, version, location) {
  // Default to latest
  version || 'latest';

  // Clean version if needed
  version = version === 'latest' ? version : wonderfulVersion.clean(version);

  // Build the command
  let command = `npm install ${package}@${version} ${location || '--save'}`;

  // Log
  console.log('Installing:', command);

  // Execute
  return execute(command, { log: true })
  .then(async () => {
    // Read new project
    const projectUpdated = jetpack.read(path.join(process.cwd(), 'package.json'), 'json');

    // Log
    console.log('Installed:', package, version);

    // Update package object
    project.dependencies = projectUpdated.dependencies;
    project.devDependencies = projectUpdated.devDependencies;
  });
}

function buildSiteFiles() {
  // Loop through all files in /defaults directory
  const dir = path.join(__dirname, '..', 'defaults');
  const files = glob('**/*', {
    cwd: dir,
    dot: true,
    nodir: true,
  });

  // Loop
  for (const file of files) {
    // Get the destination
    const source = path.join(dir, file);
    let destination = path.join(process.cwd(), file.replace('defaults/', ''));
    const filename = path.basename(destination);
    const options = FILE_MAP[file] || {overwrite: true};

    // Quit if file is '_'
    if (filename === '_') {
      continue;
    }

    // Rename if needed
    if (options.rename) {
      destination = destination.replace(filename, options.rename);
    }

    // Check if the file exists
    const exists = jetpack.exists(destination);

    // Log
    // console.log('File:', file);
    // console.log('filename:', filename);
    // console.log('options:', options);
    // console.log('contents:', jetpack.read(source));
    // console.log('source:', source);
    // console.log('Destination:', destination);

    if (exists && !options.overwrite) {
      continue;
    }

    // Copy the file
    jetpack.copy(source, destination, { overwrite: true });
  }
}
