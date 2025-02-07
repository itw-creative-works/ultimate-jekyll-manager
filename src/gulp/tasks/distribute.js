// Libraries
const Manager = new (require('../../build.js'));
const logger = Manager.logger('distribute');
const { src, dest, watch, series } = require('gulp');
const through2 = require('through2');
const jetpack = require('fs-jetpack');
const path = require('path');
const JSON5 = require('json5');
const { execute } = require('node-powertools');
const fetch = require('wonderful-fetch');

// Variables
const config = Manager.getConfig();

// Glob
const input = [
  // Files to include
  'src/**/*',

  // Files to exclude
  // '!dist/**',
];
const output = 'dist';

// Index
let index = -1;

// Main task
async function distribute(complete) {
  // Increment index
  index++;

  // Log
  logger.log('Starting...');

  // First-run tasks
  if (index === 0) {
    // Copy all files from src/defaults/dist on first run
    await copyDefaultDistFiles();

    // Create CNAME
    await createCNAME();

    // Fetch firebase-auth files
    await fetchFirebaseAuth();
  }

  // Create build JSON
  await createBuildJSON();

  // Complete
  return src(input, { base: 'src' })
    .pipe(customPathTransform())
    .pipe(dest(output))
    .on('end', () => {
      // Log
      logger.log('Finished!');

      // Complete
      return complete();
    });
}

function customPathTransform() {
  return through2.obj(function(file, _, cb) {
    if (file.isDirectory()) {
      return cb(null, file);
    }

    const relativePath = path.relative(file.base, file.path);

    if (relativePath.startsWith('pages/')) {
      const newRelativePath = relativePath.replace(/^pages\//, '');
      file.path = path.join(file.base, newRelativePath);
    }

    this.push(file);
    cb();
  });
}

// Watcher task
function distributeWatcher(complete) {
  // Quit if in build mode
  if (process.env.UJ_BUILD_MODE === 'true') {
    logger.log('[watcher] Skipping watcher in build mode');
    return complete();
  }

  // Log
  logger.log('[watcher] Watching for changes...');

  // Watch for changes
  watch(input, { delay: 250 }, distribute)
  .on('change', function(path) {
    logger.log(`[watcher] File ${path} was changed`);
  });

  // Complete
  return complete();
}

// Default Task
module.exports = series(distribute, distributeWatcher);


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

// Create build.json
async function createBuildJSON() {
  // Create build log JSON
  try {
    // Get info first
    const git = await getGitInfo();
    const config = Manager.getConfig();

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
        'ultimate-jekyll-manager': require('../../../package.json').version,
      },
      config: config,

      // Legacy
      // TODO: REMOVE
      'npm-build': new Date().toISOString(),
      brand: config.brand,
      'admin-dashboard': JSON5.parse(config['admin-dashboard']),
    }

    // Write to file
    jetpack.write('dist/build.json', JSON.stringify(json, null, 2));

    // Log
    logger.log('Created build.json');
  } catch (e) {
    console.error('Error updating build.json', e);
  }
}

// Copy default dist files
async function copyDefaultDistFiles() {
  // Get the directory
  const dir = path.join(__dirname, '..', '..', 'defaults', 'dist');

  // Log
  logger.log(`Copying default dist files from ${dir}`);

  // Copy the files
  jetpack.copy(dir, 'dist', { overwrite: true });
}

// Create CNAME
async function createCNAME() {
  // Get the CNAME
  const url = Manager.getConfig().url;
  const host = new URL(url).host

  // Write to file
  jetpack.write('dist/CNAME', host);

  // Log
  logger.log('Created CNAME');
}

// Fetch firebase-auth files
async function fetchFirebaseAuth() {
  const firebase = eval(`(${config.settings['manager-configuration']})`)?.libraries?.firebase_app?.config;
  const projectId = firebase.projectId || 'ultimate-jekyll';
  const base = `https://${projectId}.firebaseapp.com`;
  const files = [
    {
      remote: '__/auth/handler',
      // local: 'handler.html',
      filename: 'handler',
    },
    {
      remote: '__/auth/handler.js',
    },
    {
      remote: '__/auth/experiments.js',
    },
    {
      remote: '__/auth/iframe',
      // local: 'iframe.html',
      filename: 'iframe',
    },
    {
      remote: '__/auth/iframe.js',
    },
    {
      remote: '__/firebase/init.json',
      // custom: 'init',
    }
  ]
  const promises = [];
  const output = './dist';

  // Loop through files
  files.forEach((file) => {
    // Get the remote URL
    const url = `${base}/${file.remote}`;

    // Get the local path
    const fileName = file.filename ? path.basename(file.filename) : path.basename(file.remote);
    // console.log('---fileName', fileName);

    const filePath = path.join(path.dirname(file.remote), fileName);
    // console.log('---filePath', filePath);

    const finalPath = path.join(output, filePath);
    // console.log('---finalPath', finalPath);

    // Push to promises
    promises.push(
      fetch(url, {
        response: 'text',
      })
      .then((r) => {
        // Write to file
        jetpack.write(finalPath, r);
      })
    );
  });

  // Await all promises
  await Promise.all(promises);

  // Log
  logger.log('Fetched firebase-auth files');
}

