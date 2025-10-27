// Libraries
const Manager = new (require('../build.js'));
const logger = Manager.logger('setup');
const argv = Manager.getArguments();
const path = require('path');
const jetpack = require('fs-jetpack');
const version = require('wonderful-version');
const fetch = require('wonderful-fetch');
const { execute, template } = require('node-powertools');
const NPM = require('npm-api');
const glob = require('glob').globSync;
const { minimatch } = require('minimatch');
const detectGitHubRepository = require('../gulp/tasks/utils/detect-github-repo');
const { Octokit } = require('@octokit/rest');
const sodium = require('libsodium-wrappers');

// Load package
const package = Manager.getPackage('main');
const project = Manager.getPackage('project');
let config = Manager.getConfig('project');
const rootPathPackage = Manager.getRootPath('main');
const rootPathProject = Manager.getRootPath('project');

// Dependency MAP
const DEPENDENCY_MAP = {
  'gulp': 'dev',
}

module.exports = async function (options) {
  // Fix options - handle string 'false' values
  options = options || {};
  options.checkManager = options.checkManager !== 'false';
  options.checkNode = options.checkNode !== 'false';
  options.checkBundler = options.checkBundler !== 'false';
  options.checkRuby = options.checkRuby !== 'false';
  options.checkPeerDependencies = options.checkPeerDependencies !== 'false';
  options.setupScripts = options.setupScripts !== 'false';
  options.ensureCoreFiles = options.ensureCoreFiles !== 'false';
  options.createCname = options.createCname !== 'false';
  options.fetchFirebaseAuth = options.fetchFirebaseAuth !== 'false';
  options.checkLocality = options.checkLocality !== 'false';
  options.updateBundle = options.updateBundle !== 'false';
  options.publishGitHubToken = options.publishGitHubToken !== 'false';

  // Log
  logger.log(`Welcome to ${package.name} v${package.version}!`);
  logger.log(`options`, options);

  // Prefix project
  project.dependencies = project.dependencies || {};
  project.devDependencies = project.devDependencies || {};

  try {
    // Log current working directory
    await logCWD();

    // Detect GitHub repository early so it's available to all tasks/functions
    await detectGitHubRepository(logger);

    // Ensure this package is up-to-date
    if (options.checkManager) {
      await updateManager();
    }

    // Ensure proper node version
    if (options.checkNode) {
      await ensureNodeVersion();
    }

    // Ensure proper bundler version
    if (options.checkBundler) {
      await ensureBundlerVersion();
    }

    // Ensure proper ruby version
    if (options.checkRuby) {
      await ensureRubyVersion();
    }

    // Run the setup
    if (options.checkPeerDependencies) {
      await ensurePeerDependencies();
    }

    // Setup scripts
    if (options.setupScripts) {
      await setupScripts();
    }

    // Copy all files from src/defaults/dist on first run
    // await copyDefaultDistFiles();

    // Ensure _config.yml exists
    if (options.ensureCoreFiles) {
      await ensureCoreFiles();
    }

    // Create CNAME
    if (options.createCname) {
      await createCname();
    }

    // Fetch firebase-auth files
    if (options.fetchFirebaseAuth) {
      await fetchFirebaseAuth(options);
    }

    // Check which locality we are using
    if (options.checkLocality) {
      await checkLocality();
    }

    // Publish GH_TOKEN as repository secret
    if (options.publishGitHubToken) {
      await publishGitHubToken();
    }

    // Check which locality we are using
    if (options.updateBundle && !Manager.isServer()) {
      await updateBundle();
    }
  } catch (e) {
    // Throw error
    throw e;
  }
};

async function logCWD() {
  logger.log('Current working directory:', process.cwd());
  // logger.log('Current working directory 2:', await execute('pwd'));
  // logger.log('Current working directory 3:', await execute('ls -al'));
}

async function updateManager() {
  const npm = new NPM();

  // Get the latest version
  const installedVersion = project.devDependencies[package.name];
  const latestVersion = await npm.repo(package.name)
  .package()
    .then((pkg) => {
      return pkg.version;
    }, (e) => {
      return '0.0.0';
    });
  const isUpToDate = version.is(installedVersion, '>=', latestVersion);
  const levelDifference = version.levelDifference(installedVersion, latestVersion);

  // Check if installedVersion is truthy or throw error
  if (!installedVersion) {
    throw new Error(`No installed version of ${package.name} found in devDependencies.`);
  }

  // Log
  logVersionCheck(package.name, installedVersion, latestVersion, isUpToDate);

  // Quit if local
  if (installedVersion.startsWith('file:')) {
    return;
  }

  // Check if we need to update
  if (!isUpToDate) {
    // Quit if major version difference
    if (levelDifference === 'major') {
      return logger.error(`Major version difference detected. Please update to ${latestVersion} manually.`);
    }

    // Install the latest version
    await install(package.name, latestVersion);
  }
}

async function ensureNodeVersion() {
  const installedVersion = version.clean(process.version);
  const requiredVersion = version.clean(package.engines.node);
  const isUpToDate = version.is(installedVersion, '>=', requiredVersion);

  // Log
  logVersionCheck('Node.js', installedVersion, requiredVersion, isUpToDate);

  // Check if we need to update
  if (!isUpToDate) {
    throw new Error(`Node version is out-of-date. Required version is ${requiredVersion}.`);
  }
}

async function ensureBundlerVersion() {
  const installedVersion = version.clean(
    (await execute('bundler -v', { log: false })).match(/(\d+\.\d+\.\d+)/)[0]
  );
  const requiredVersion = version.clean(package.engines.bundler);
  const isUpToDate = version.is(installedVersion, '>=', requiredVersion);

  // Log
  logVersionCheck('Bundler', installedVersion, requiredVersion, isUpToDate);

  // Check if we need to update
  if (!isUpToDate) {
    throw new Error(`Bundler version is out-of-date. Required version is ${requiredVersion}.`);
  }
}

async function ensureRubyVersion() {
  const installedVersion = version.clean(
    (await execute('ruby -v', { log: false })).match(/(\d+\.\d+\.\d+)/)[0]
  );
  const requiredVersion = version.clean(package.engines.ruby);
  const isUpToDate = version.is(installedVersion, '>=', requiredVersion);

  // Log
  logVersionCheck('Ruby', installedVersion, requiredVersion, isUpToDate);

  // Check if we need to update
  if (!isUpToDate) {
    throw new Error(`Ruby version is out-of-date. Required version is ${requiredVersion}.`);
  }
}

async function ensurePeerDependencies() {
  const requiredPeerDependencies = package.peerDependencies || {};

  // Loop through and make sure project has AT LEAST the required version
  for (let [dependency, ver] of Object.entries(requiredPeerDependencies)) {
    const projectDependencyVersion = version.clean(project?.dependencies?.[dependency] || project?.devDependencies?.[dependency]);
    const location = DEPENDENCY_MAP[dependency] === 'dev' ? '--save-dev' : '';
    const isUpToDate = version.is(projectDependencyVersion, '>=', ver);

    // Clean version if needed
    ver = version.clean(ver);

    // Log
    // logger.log('Checking peer dep:', dependency, '-->', projectDependencyVersion, '>=', ver);
    logVersionCheck(dependency, projectDependencyVersion, ver, isUpToDate);

    // Install if not found
    if (
      // Not found
      !projectDependencyVersion
      // Not the right version
      || !isUpToDate
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

async function ensureCoreFiles() {
  // Ensure src/_config.yml exists
  if (!jetpack.exists('src/_config.yml')) {
    // Log
    logger.log('No src/_config.yml found. Creating default config file...');

    // Copy default _config.yml
    const sourcePath = path.join(rootPathPackage, 'dist/defaults/src/_config.yml');
    const targetPath = path.join(rootPathProject, 'src/_config.yml');

    jetpack.copy(sourcePath, targetPath);
    logger.log(`Copied default _config.yml to src/_config.yml`);

    // Inject new config into config variable
    config = Manager.getConfig('project');

    // Run gulp defaults task since this is likely the first run
    await execute('UJ_BUILD_MODE=true npm run gulp -- defaults', { log: true });
  }
}

function checkLocality() {
  const installedVersion = project.devDependencies[package.name];

  if (installedVersion.startsWith('file:')) {
    logger.warn(`⚠️⚠️⚠️ You are using the local version of ${package.name}. This WILL NOT WORK when published. ⚠️⚠️⚠️`);
  }
}

async function updateBundle() {
  // Log
  logger.log('Running bundle install...');
  await execute('bundle install', { log: true })

  // Log
  logger.log('Running bundle update...');
  await execute('bundle update', { log: true })
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

// Create CNAME
async function createCname() {
  // Get the CNAME
  const url = config.url || 'https://template.itwcreativeworks.com';
  const host = new URL(url).host

  // Write to file
  jetpack.write('dist/CNAME', host);

  // Log
  logger.log('Created CNAME');
}

// Fetch firebase-auth files
async function fetchFirebaseAuth() {
  const app = config.web_manager.firebase.app.config || {};
  const base = `https://${app.projectId}.firebaseapp.com`;

  // Throw error if no project ID
  if (!app.projectId) {
    // if (options.skipFirebaseIdCheck) {
    //   return;
    // }
    // throw new Error('No Firebase project ID found in config.web_manager.firebase.app.config.projectId');
    logger.warn('⚠️  Skipping fetchFirebaseAuth due to missing Firebase project ID.');
    return;
  }

  const files = [
    {
      remote: '__/auth/handler',
      filename: 'handler.html',
    },
    {
      remote: '__/auth/handler.js',
    },
    {
      remote: '__/auth/experiments.js',
    },
    {
      remote: '__/auth/iframe',
      filename: 'iframe.html',
      replace: (content) => {
        return content.replace('src="iframe.js"', 'src="iframe.js?cb={{ site.uj.cache_breaker }}"');
      }
    },
    {
      remote: '__/auth/iframe.js',
    },
    {
      remote: '__/firebase/init.json',
    }
  ]
  const promises = [];
  const output = './dist';

  // Loop through files
  files.forEach((file) => {
    // Get the remote URL
    const url = `${base}/${file.remote}`;

    // Get the local path
    const fileName = file.filename
      ? path.basename(file.filename)
      : path.basename(file.remote);
    const filePath = path.join(path.dirname(file.remote), fileName);
    const finalPath = path.join(output, filePath);

    // Push to promises
    promises.push(
      fetch(url, {
        response: 'text',
        tries: 3,
        // log: true,
      })
      .then((r) => {
        // Apply replace function if it exists
        if (file.replace && typeof file.replace === 'function') {
          r = file.replace(r);
        }

        // Write to file
        jetpack.write(finalPath,
          '---\n'
          + `permalink: /${file.remote}\n`
          + '---\n'
          + '\n'
          + r
        )
      })
    );
  });

  // Await all promises
  await Promise.all(promises);

  // Log
  logger.log('Fetched firebase-auth files');
}

function logVersionCheck(name, installedVersion, latestVersion, isUpToDate) {
  // Quit if local
  if (installedVersion.startsWith('file:')) {
    isUpToDate = true;
  }

  // Log
  logger.log(`Checking if ${name} is up to date (${logger.format.bold(installedVersion)} >= ${logger.format.bold(latestVersion)}): ${isUpToDate ? logger.format.green('Yes') : logger.format.red('No')}`);
}

// Publish GH_TOKEN as repository secret
async function publishGitHubToken() {
  // Check if GH_TOKEN is available
  if (!process.env.GH_TOKEN) {
    logger.warn('⚠️  GH_TOKEN not found in environment variables. Skipping secret publication.');
    return;
  }

  // Check if GITHUB_REPOSITORY is available
  if (!process.env.GITHUB_REPOSITORY) {
    logger.warn('⚠️  GITHUB_REPOSITORY not detected. Skipping secret publication.');
    return;
  }

  // Quit if in build mode
  if (Manager.isBuildMode()) {
    logger.log('⚠️  Skipping GH_TOKEN publication in build mode.');
    return;
  }

  try {
    // Parse owner and repo
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');

    // Initialize Octokit
    const octokit = new Octokit({
      auth: process.env.GH_TOKEN,
    });

    logger.log(`🔐 Publishing GH_TOKEN as repository secret for ${owner}/${repo}...`);

    // Initialize sodium
    await sodium.ready;

    // Get repository public key for encrypting secrets
    const { data: publicKeyData } = await octokit.actions.getRepoPublicKey({
      owner,
      repo,
    });

    // Convert secret to Uint8Array
    const secretBytes = Buffer.from(process.env.GH_TOKEN);
    const keyBytes = Buffer.from(publicKeyData.key, 'base64');

    // Encrypt the secret using libsodium
    const encryptedBytes = sodium.crypto_box_seal(secretBytes, keyBytes);
    const encryptedValue = Buffer.from(encryptedBytes).toString('base64');

    // Create or update the repository secret
    await octokit.actions.createOrUpdateRepoSecret({
      owner,
      repo,
      secret_name: 'GH_TOKEN',
      encrypted_value: encryptedValue,
      key_id: publicKeyData.key_id,
    });

    logger.log(`✅ Successfully published GH_TOKEN as repository secret`);
  } catch (error) {
    logger.error(`❌ Failed to publish GH_TOKEN as repository secret: ${error.message}`);
    // Don't throw - this is not critical for setup to continue
  }
}
