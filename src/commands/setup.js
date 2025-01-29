// Libraries
const path = require('path');
const { gte } = require('semver');
const { execute } = require('node-powertools');
const NPM = require('npm-api');

// Load package
const package = require('../../package.json');
const project = require(path.join(process.cwd(), 'package.json'));

// Dependency MAP
const DEPENDENCY_MAP = {
  'gulp': 'dev',
}

module.exports = async function (options) {
  console.log(`Welcome to Ultimate Jekyll v${package.version}!`);

  // Prefix project
  project.dependencies = project.dependencies || {};
  project.devDependencies = project.devDependencies || {};

  // Log
  // console.log('package:', package);
  // console.log('project:', project);

  try {
    // Ensure this package is up-to-date
    await updateManager();

    // Run the setup
    await ensurePeerDependencies();

    // Check which locality we are using
    checkLocality();

  } catch (e) {
    console.error(`Error during setup:`, e);
  }
};

async function updateManager() {
  const npm = new NPM();

  // Get the latest version
  const latestVersion = await npm.repo('ultimate-jekyll-manager')
  .package()
    .then((pkg) => {
      return pkg.version;
    }, (e) => {
      return '0.0.0';
    });
  const installedVersion = project.devDependencies['ultimate-jekyll-manager'];

  // Quit if local
  if (installedVersion.startsWith('file:')) {
    return console.log('Local version detected. Skipping update check.');
  }

  // Clean the versions
  const cleanInstalledVersion = clean(installedVersion) || '0.0.0';
  const cleanLatestVersion = clean(latestVersion);

  // Log
  console.log('Installed Version:', cleanInstalledVersion);
  console.log('Latest Version:', cleanLatestVersion);

  // Check if we need to update
  if (gte(cleanInstalledVersion, cleanLatestVersion)) {
    return console.log('Ultimate Jekyll Manager is up-to-date.');
  } else {
    await install('ultimate-jekyll-manager', latestVersion);
  }
}

async function ensurePeerDependencies() {
  const requiredPeerDependencies = package.peerDependencies || {};

  // Loop through and make sure project has AT LEAST the required version
  for (const [dependency, version] of Object.entries(requiredPeerDependencies)) {
    const projectDependencyVersion = project.dependencies[dependency] || project.devDependencies[dependency];
    const location = DEPENDENCY_MAP[dependency] === 'dev' ? '--save-dev' : '';


    // Install if not found
    if (!projectDependencyVersion) {
      await install(dependency, version, location);
    } else {
      // Clean the version and compare
      const cleanProjectVersion = clean(projectDependencyVersion);
      const cleanRequiredVersion = clean(version);

      if (!gte(cleanProjectVersion, cleanRequiredVersion)) {
        await install(dependency, version, location);
      }
    }
  }
}

function checkLocality() {
  const installedVersion = project.devDependencies['ultimate-jekyll-manager'];

  if (installedVersion.startsWith('file:')) {
    console.warn('⚠️⚠️⚠️ You are using the local version of Ultimate Jekyll Manager. This WILL NOT WORK when published. ⚠️⚠️⚠️');
  }
}

const clean = (version) => version.replace(/^[^\d]+/, '');

function install(package, version, location) {
  // Default to latest
  version || 'latest';

  // Build the command
  let command = `npm install ${package}@${version} ${location || '--save'}`;

  // Log
  console.log('Installing:', command);

  // Execute
  return execute(command, { log: true })
}
