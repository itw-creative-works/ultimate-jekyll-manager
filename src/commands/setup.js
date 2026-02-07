// Libraries
const Manager = new (require('../build.js'));
const logger = Manager.logger('setup');
const path = require('path');
const jetpack = require('fs-jetpack');
const version = require('wonderful-version');
const fetch = require('wonderful-fetch');
const { execute } = require('node-powertools');
const NPM = require('npm-api');
const glob = require('glob').globSync;
const detectGitHubRepository = require('../gulp/tasks/utils/detect-github-repo');
const { Octokit } = require('@octokit/rest');
const sodium = require('libsodium-wrappers');

// Load package
const package = Manager.getPackage('main');
const project = Manager.getPackage('project');
let config = Manager.getConfig('project');
const rootPathPackage = Manager.getRootPath('main');
const rootPathProject = Manager.getRootPath('project');

// Map of dependencies that should be installed as devDependencies
const DEPENDENCY_MAP = {
  'gulp': 'dev',
}

module.exports = async function (options) {
  // Fix options - handle string 'false' values
  options = options || {};
  options.checkManager = options.checkManager !== 'false';
  options.checkNode = options.checkNode !== 'false';
  options.checkRuby = options.checkRuby !== 'false';
  options.checkBundle = options.checkBundle !== 'false';
  options.checkPeerDependencies = options.checkPeerDependencies !== 'false';
  options.setupScripts = options.setupScripts !== 'false';
  options.ensureCoreFiles = options.ensureCoreFiles !== 'false';
  options.createCname = options.createCname !== 'false';
  options.fetchFirebaseAuth = options.fetchFirebaseAuth !== 'false';
  options.checkLocality = options.checkLocality !== 'false';
  options.publishGitHubToken = options.publishGitHubToken !== 'false';
  options.deduplicatePosts = options.deduplicatePosts !== 'false';
  options.migrate = options.migrate !== 'false';

  // Log
  logger.log(`Welcome to ${package.name} v${package.version}!`);
  logger.log(`options`, options);

  // Prefix project
  project.dependencies = project.dependencies || {};
  project.devDependencies = project.devDependencies || {};

  // Log current working directory
  logger.log('Current working directory:', process.cwd());

  // Run migrations
  if (options.migrate) {
    await migrate();
  }

  // Detect GitHub repository early so it's available to all tasks/functions
  await detectGitHubRepository(logger);

  // --- Version checks ---

  // Ensure this package is up-to-date
  if (options.checkManager) {
    await ensureManagerVersion();
  }

  // Ensure proper node version
  if (options.checkNode) {
    await ensureNodeVersion();
  }

  // Ensure proper ruby version
  if (options.checkRuby) {
    await ensureRubyVersion();
  }

  // Ensure proper bundler version + install/update gems
  if (options.checkBundle) {
    await ensureBundle();
  }

  // Ensure peer dependencies are installed
  if (options.checkPeerDependencies) {
    await ensurePeerDependencies();
  }

  // --- Project setup ---

  // Setup scripts in package.json
  if (options.setupScripts) {
    setupScripts();
  }

  // Ensure _config.yml exists
  if (options.ensureCoreFiles) {
    await ensureCoreFiles();
  }

  // Create CNAME file
  if (options.createCname) {
    createCname();
  }

  // Fetch firebase-auth files
  if (options.fetchFirebaseAuth) {
    await fetchFirebaseAuth();
  }

  // Warn if using local version
  if (options.checkLocality) {
    checkLocality();
  }

  // Publish GH_TOKEN as repository secret
  if (options.publishGitHubToken) {
    await publishGitHubToken();
  }

  // Deduplicate posts (remove duplicate posts with same slug but different dates)
  if (options.deduplicatePosts) {
    await deduplicatePosts();
  }
};

// --- Version check functions ---

async function ensureManagerVersion() {
  const npm = new NPM();
  const installedVersion = project.devDependencies[package.name];

  if (!installedVersion) {
    throw new Error(`No installed version of ${package.name} found in devDependencies.`);
  }

  // Skip if local
  if (installedVersion.startsWith('file:')) {
    logVersionCheck(package.name, installedVersion, installedVersion, true);
    return;
  }

  const latestVersion = await npm.repo(package.name)
    .package()
    .then((pkg) => pkg.version, () => '0.0.0');

  const isUpToDate = version.is(installedVersion, '>=', latestVersion);

  logVersionCheck(package.name, installedVersion, latestVersion, isUpToDate);

  if (!isUpToDate) {
    const levelDifference = version.levelDifference(installedVersion, latestVersion);

    if (levelDifference === 'major' && installedVersion !== 'latest') {
      return logger.error(`Major version difference detected. Please update to ${latestVersion} manually.`);
    }

    await npmInstall(package.name, latestVersion);
  }
}

async function ensureNodeVersion() {
  const installedVersion = version.clean(process.version);
  const requiredVersion = version.clean(package.engines.node);
  const isUpToDate = version.is(installedVersion, '>=', requiredVersion);

  logVersionCheck('Node.js', installedVersion, requiredVersion, isUpToDate);

  if (!isUpToDate) {
    throw new Error(`Node version is out-of-date. Required version is ${requiredVersion}.`);
  }
}

async function ensureRubyVersion() {
  const installedVersion = version.clean(
    (await execute('ruby -v', { log: false })).match(/(\d+\.\d+\.\d+)/)[0]
  );
  const requiredVersion = version.clean(package.engines.ruby);
  const isUpToDate = version.is(installedVersion, '>=', requiredVersion);

  logVersionCheck('Ruby', installedVersion, requiredVersion, isUpToDate);

  if (!isUpToDate) {
    throw new Error(`Ruby version is out-of-date. Required version is ${requiredVersion}.`);
  }
}

async function ensureBundle() {
  // Check bundler gem version
  const installedVersion = version.clean(
    (await execute('bundler -v', { log: false })).match(/(\d+\.\d+\.\d+)/)[0]
  );
  const requiredVersion = version.clean(package.engines.bundler);
  const isUpToDate = version.is(installedVersion, '>=', requiredVersion);

  logVersionCheck('Bundler', installedVersion, requiredVersion, isUpToDate);

  // Install bundler gem + update Gemfile.lock if needed
  if (!isUpToDate) {
    logger.log(`Bundler is out-of-date. Installing version ${requiredVersion}...`);
    await execute(`gem install bundler -v ${requiredVersion}`, { log: true });
    await execute(`bundle update --bundler`, { log: true });
  }

  // Skip bundle install/update on server
  if (Manager.isServer()) {
    return;
  }

  // Install and update gems
  logger.log('Running bundle install...');
  await execute('bundle install', { log: true });

  logger.log('Running bundle update...');
  await execute('bundle update --all', { log: true });
}

async function ensurePeerDependencies() {
  const requiredPeerDependencies = package.peerDependencies || {};

  for (let [dependency, ver] of Object.entries(requiredPeerDependencies)) {
    const projectDependencyVersion = version.clean(project?.dependencies?.[dependency] || project?.devDependencies?.[dependency]);
    const location = DEPENDENCY_MAP[dependency] === 'dev' ? '--save-dev' : '';

    ver = version.clean(ver);

    const isUpToDate = version.is(projectDependencyVersion, '>=', ver);
    logVersionCheck(dependency, projectDependencyVersion, ver, isUpToDate);

    if (!projectDependencyVersion || !isUpToDate) {
      await npmInstall(dependency, ver, location);
    }
  }
}

// --- Project setup functions ---

function setupScripts() {
  project.scripts = project.scripts || {};

  Object.keys(package.projectScripts).forEach((key) => {
    project.scripts[key] = package.projectScripts[key];
  });

  jetpack.write(path.join(process.cwd(), 'package.json'), project);
}

async function ensureCoreFiles() {
  if (jetpack.exists('src/_config.yml')) {
    return;
  }

  logger.log('No src/_config.yml found. Creating default config file...');

  const sourcePath = path.join(rootPathPackage, 'dist/defaults/src/_config.yml');
  const targetPath = path.join(rootPathProject, 'src/_config.yml');

  jetpack.copy(sourcePath, targetPath);
  logger.log(`Copied default _config.yml to src/_config.yml`);

  // Inject new config into config variable
  config = Manager.getConfig('project');

  // Run gulp defaults task since this is likely the first run
  await execute('UJ_BUILD_MODE=true npm run gulp -- defaults', { log: true });
}

function createCname() {
  const url = config.url || 'https://ultimate-jekyll.itwcreativeworks.com';
  const host = new URL(url).host;

  jetpack.write('dist/CNAME', host);
  logger.log('Created CNAME');
}

async function fetchFirebaseAuth() {
  const app = config.web_manager.firebase.app.config || {};

  if (!app.projectId) {
    logger.warn('Skipping fetchFirebaseAuth due to missing Firebase project ID.');
    return;
  }

  const base = `https://${app.projectId}.firebaseapp.com`;
  const output = './dist';

  const files = [
    { remote: '__/auth/handler', filename: 'handler.html' },
    { remote: '__/auth/handler.js' },
    { remote: '__/auth/experiments.js' },
    {
      remote: '__/auth/iframe',
      filename: 'iframe.html',
      replace: (content) => content.replace('src="iframe.js"', 'src="iframe.js?cb={{ site.uj.cache_breaker }}"'),
    },
    { remote: '__/auth/iframe.js' },
    { remote: '__/firebase/init.json' },
  ];

  logger.log('Fetching firebase-auth files...');

  const promises = files.map((file) => {
    const url = `${base}/${file.remote}`;
    const fileName = file.filename
      ? path.basename(file.filename)
      : path.basename(file.remote);
    const filePath = path.join(path.dirname(file.remote), fileName);
    const finalPath = path.join(output, filePath);

    return fetch(url, { response: 'text', tries: 3 })
      .then((r) => {
        if (file.replace) {
          r = file.replace(r);
        }

        logger.log(`Fetched: ${file.remote}`);

        jetpack.write(finalPath,
          '---\n'
          + `permalink: /${file.remote}\n`
          + '---\n'
          + '\n'
          + r
        );
      })
      .catch((error) => {
        logger.error(`Failed to fetch: ${file.remote}`);
        logger.error(`   URL: ${url}`);

        const htmlPattern = /<!doctype|<html|<head|<body/i;
        if (error.message && !htmlPattern.test(error.message)) {
          logger.error(`   Error: ${error.message}`);
        }

        throw new Error(`Failed to fetch Firebase auth file: ${file.remote}`);
      });
  });

  try {
    await Promise.all(promises);
    logger.log('Fetched firebase-auth files');
  } catch (error) {
    if (process.env.UJ_SKIP_FIREBASE_AUTH_ERRORS === 'true') {
      logger.warn('Failed to fetch some Firebase auth files, but continuing due to UJ_SKIP_FIREBASE_AUTH_ERRORS=true');
      return;
    }

    throw new Error('Failed to fetch one or more Firebase auth files. Please check your Firebase project configuration.');
  }
}

function checkLocality() {
  const installedVersion = project.devDependencies[package.name];

  if (!installedVersion) {
    throw new Error(`No installed version of ${package.name} found in devDependencies.`);
  }

  if (installedVersion.startsWith('file:')) {
    logger.warn(`You are using the local version of ${package.name}. This WILL NOT WORK when published.`);
  }
}

async function publishGitHubToken() {
  if (!process.env.GH_TOKEN) {
    logger.warn('GH_TOKEN not found in environment variables. Skipping secret publication.');
    return;
  }

  if (!process.env.GITHUB_REPOSITORY) {
    logger.warn('GITHUB_REPOSITORY not detected. Skipping secret publication.');
    return;
  }

  if (Manager.isBuildMode()) {
    logger.log('Skipping GH_TOKEN publication in build mode.');
    return;
  }

  try {
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');

    const octokit = new Octokit({ auth: process.env.GH_TOKEN });

    logger.log(`Publishing GH_TOKEN as repository secret for ${owner}/${repo}...`);

    await sodium.ready;

    const { data: publicKeyData } = await octokit.actions.getRepoPublicKey({ owner, repo });

    const secretBytes = Buffer.from(process.env.GH_TOKEN);
    const keyBytes = Buffer.from(publicKeyData.key, 'base64');
    const encryptedBytes = sodium.crypto_box_seal(secretBytes, keyBytes);
    const encryptedValue = Buffer.from(encryptedBytes).toString('base64');

    await octokit.actions.createOrUpdateRepoSecret({
      owner,
      repo,
      secret_name: 'GH_TOKEN',
      encrypted_value: encryptedValue,
      key_id: publicKeyData.key_id,
    });

    logger.log(`Successfully published GH_TOKEN as repository secret`);
  } catch (error) {
    logger.error(`Failed to publish GH_TOKEN as repository secret: ${error.message}`);
  }
}

async function deduplicatePosts() {
  logger.log('Checking for duplicate posts...');

  const postFiles = glob('src/_posts/**/*.{md,markdown,html}', { nodir: true });

  if (postFiles.length === 0) {
    logger.log('No posts found');
    return;
  }

  logger.log(`Found ${postFiles.length} post files`);

  // Group posts by slug (filename without date prefix)
  const postsBySlug = {};

  for (const filePath of postFiles) {
    const filename = path.basename(filePath);
    const match = filename.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.(md|markdown|html)$/);

    if (!match) {
      continue;
    }

    const [, dateStr, slug, ext] = match;

    if (!postsBySlug[slug]) {
      postsBySlug[slug] = [];
    }

    postsBySlug[slug].push({ filePath, filename, date: new Date(dateStr), dateStr, slug, ext });
  }

  // Find duplicates and keep only the ORIGINAL (oldest)
  let removedCount = 0;
  const duplicates = [];

  for (const [slug, posts] of Object.entries(postsBySlug)) {
    if (posts.length <= 1) {
      continue;
    }

    // Sort by date ascending (oldest first)
    posts.sort((a, b) => a.date - b.date);

    const [original, ...newer] = posts;

    logger.log(`Found ${posts.length} posts with slug "${slug}":`);
    logger.log(`  Keeping original: ${original.filename} (${original.dateStr})`);

    for (const post of newer) {
      logger.log(`  Removing duplicate: ${post.filename} (${post.dateStr})`);

      try {
        jetpack.remove(post.filePath);
        removedCount++;

        const imageFolder = `src/assets/images/blog/post-${post.slug}`;
        if (jetpack.exists(imageFolder)) {
          jetpack.remove(imageFolder);
          logger.log(`  Removed image folder: ${imageFolder}`);
        }

        duplicates.push({
          kept: original.filename,
          removed: post.filename,
          removedPath: post.filePath,
          slug,
        });
      } catch (error) {
        logger.error(`Failed to remove ${post.filePath}:`, error);
      }
    }
  }

  if (removedCount > 0) {
    logger.log(`Removed ${removedCount} duplicate post(s)`);

    const reportDir = path.join(rootPathProject, '.temp/deduplicate');
    jetpack.dir(reportDir);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(reportDir, `duplicates-${timestamp}.json`);

    jetpack.write(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      removedCount,
      duplicates,
    }, null, 2));

    logger.log(`Report saved to: ${reportPath}`);
  } else {
    logger.log('No duplicate posts found');
  }
}

// --- Migration functions ---

async function migrate() {
  const installedVersion = project.devDependencies[package.name] || '0.0.0';

  if (installedVersion.startsWith('file:')) {
    return;
  }

  if (version.is(installedVersion, '<=', '1.0.0')) {
    await migrateHooksToNestedStructure();
  }
}

async function migrateHooksToNestedStructure() {
  const hooksDir = path.join(rootPathProject, 'hooks');

  const migrations = [
    { old: 'build:post.js', new: 'build/post.js' },
    { old: 'build:pre.js', new: 'build/pre.js' },
    { old: 'middleware:request.js', new: 'middleware/request.js' },
  ];

  let migratedCount = 0;

  for (const migration of migrations) {
    const oldPath = path.join(hooksDir, migration.old);
    const newPath = path.join(hooksDir, migration.new);

    if (!jetpack.exists(oldPath)) {
      continue;
    }

    if (jetpack.exists(newPath)) {
      logger.warn(`Migrate ${migration.old}: ${migration.new} already exists`);
    }

    jetpack.move(oldPath, newPath, { overwrite: true });
    logger.log(`Migrated hook: ${migration.old} -> ${migration.new}`);
    migratedCount++;
  }

  if (migratedCount > 0) {
    logger.log(`Migrated ${migratedCount} hook file(s) to new nested structure`);
  }
}

// --- Utility functions ---

function npmInstall(pkg, ver, location) {
  ver = ver || 'latest';
  ver = ver === 'latest' ? ver : version.clean(ver);

  const command = `npm install ${pkg}@${ver} ${location || '--save'}`;

  logger.log('Installing:', command);

  return execute(command, { log: true })
    .then(() => {
      const projectUpdated = jetpack.read(path.join(process.cwd(), 'package.json'), 'json');

      logger.log('Installed:', pkg, ver);

      project.dependencies = projectUpdated.dependencies;
      project.devDependencies = projectUpdated.devDependencies;
    });
}

function logVersionCheck(name, installedVersion, latestVersion, isUpToDate) {
  if (installedVersion.startsWith('file:')) {
    isUpToDate = true;
  }

  logger.log(`Checking if ${name} is up to date (${logger.format.bold(installedVersion)} >= ${logger.format.bold(latestVersion)}): ${isUpToDate ? logger.format.green('Yes') : logger.format.red('No')}`);
}
