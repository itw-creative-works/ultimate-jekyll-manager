// Libraries
const Manager = new (require('../build.js'));
const logger = Manager.logger('setup');
const argv = Manager.getArguments();
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
  rubyVersion: version.clean(package.engines.ruby),
  bundlerVersion: version.clean(package.engines.bundler),
  nodeVersion: version.major(package.engines.node),
};
const config = Manager.getConfig();

// Dependency MAP
const DEPENDENCY_MAP = {
  'gulp': 'dev',
}

// File MAP
const FILE_MAP = {
  // Files to skip overwrite
  'hooks/**/*': {overwrite: false, rule_1: true},
  'src/**/*': {overwrite: false, rule_2: true},

  // Files to rewrite path
  'dist/pages/**/*': {path: (p) => p.replace('dist/pages', 'dist'), rule_3: true},
  '_.gitignore': {path: (p) => p.replace('_.gitignore', '.gitignore'), rule_4: true},

  // Files to run templating on
  '.github/workflows/build.yml': {template: templating, rule_5: true},
  '.nvmrc': {template: templating, rule_6: true},
}

module.exports = async function (options) {
  // Log
  logger.log(`Welcome to Ultimate Jekyll v${package.version}!`);
  // logger.log(`Environment variables`, process.env);

  // Prefix project
  project.dependencies = project.dependencies || {};
  project.devDependencies = project.devDependencies || {};

  try {
    // Log current working directory
    await logCWD();

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

    // Copy all files from src/defaults/dist on first run
    // await copyDefaultDistFiles();

    // Create CNAME
    await createCNAME();

    // Fetch firebase-auth files
    await fetchFirebaseAuth();

    // Check which locality we are using
    await checkLocality();

  } catch (e) {
    // Throw error
    throw e;
  }
};

async function logCWD() {
  logger.log('Current working directory 1:', process.cwd());
  logger.log('Current working directory 2:', await execute('pwd'));
  logger.log('Current working directory 3:', await execute('ls -al'));
}

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
  const isUpToDate = version.is(installedVersion, '>=', latestVersion);
  const levelDifference = version.levelDifference(installedVersion, latestVersion);

  // Log
  logVersionCheck('ultimate-jekyll-manager', installedVersion, latestVersion, isUpToDate);

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
    await install('ultimate-jekyll-manager', latestVersion);
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
    const projectDependencyVersion = version.clean(project.dependencies[dependency] || project.devDependencies[dependency]);
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
    // Dist files
    // '!dist/**',
    '!**/.DS_Store', // TODO: NOT WORKING
  ]

  // Get all files
  const files = glob(input, {
    cwd: dir,
    dot: true,
    nodir: true,
  });

  // Log
  logger.log(`Preparing to copy ${files.length} default files...`);

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
    // if (options.rename) {
    //   destination = destination.replace(filename, options.rename);
    // }

    // Rewrite path
    if (options.path) {
      destination = options.path(destination);
    }

    // Check if the file exists
    const exists = jetpack.exists(destination);

    // Log
    // if (argv.debug) {
      logger.log(`Copying defaults...`);
      logger.log(`  file: ${file}`);
      logger.log(`  from: ${source}`);
      logger.log(`  to: ${destination}`);
      // logger.log('File:', file);
      // logger.log('filename:', filename);
      // logger.log('options:', options);
      // // logger.log('contents:', jetpack.read(source));
      // logger.log('source:', source);
      // logger.log('Destination:', destination);
      console.log('\n');
    // }

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

// Copy default dist files
// async function copyDefaultDistFiles() {
//   // Get the directory
//   const dir = path.join(__dirname, '..', '..', 'defaults', 'dist');

//   // Log
//   logger.log(`Copying default dist files from ${dir}`);

//   // Copy the files
//   jetpack.copy(dir, 'dist', { overwrite: true });
// }
// async function copyDefaultDistFiles() {
//   // Loop through all files in /defaults directory
//   const dir = path.join(__dirname, '..', '..', 'defaults', 'dist');
//   const input = [
//     // Files to include
//     '**/*',

//     // Files to exclude
//     '!**/.DS_Store', // TODO: NOT WORKING
//   ]

//   // Get all files
//   const files = glob(input, {
//     cwd: dir,
//     dot: true,
//     nodir: true,
//   });

//   // Log
//   logger.log(`Preparing to copy ${files.length} default dist files...`);

//   for (const file of files) {
//     // const relativePath = path.relative(path.join(__dirname, '..', '..', 'defaults', 'dist'), file);
//     // const destination = path.join(__dirname, '..', '..', 'dist', relativePath.replace('pages', ''));
//     const source = path.join(dir, file);
//     const destination = path.join(process.cwd(), file.replace('dist/pages', 'dist'));

//     // Log
//     if (true) {
//       logger.log(`Copying default dist file...`);
//       logger.log(`  file: ${file}`);
//       logger.log(`  from: ${source}`);
//       logger.log(`  to: ${destination}`);
//       console.log('\n');
//     }

//     // Ensure the directory exists
//     // await jetpack.dir(path.dirname(destination));

//     // Copy the file
//     // await jetpack.copy(file, destination, { overwrite: true });
//   }
// }

// Create CNAME
async function createCNAME() {
  // Get the CNAME
  const url = config.url;
  const host = new URL(url).host

  // Write to file
  jetpack.write('dist/CNAME', host);

  // Log
  logger.log('Created CNAME');
}

// Fetch firebase-auth files
async function fetchFirebaseAuth() {
  const managerConfig = config.settings['manager-configuration'];
  const firebase = eval(`(${managerConfig})`)?.libraries?.firebase_app?.config;
  const projectId = firebase.projectId || 'ultimate-jekyll';
  const base = `https://${projectId}.firebaseapp.com`;
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
        // jetpack.write(finalPath, r);

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

function getFileOptions(filePath) {
  const defaults = {
    overwrite: true,
    rename: null,
    template: null,
  };

  let options = { ...defaults };

  // Loop through all patterns
  for (const pattern in FILE_MAP) {
    if (minimatch(filePath, pattern)) {
      options = { ...options, ...FILE_MAP[pattern] };
    }
  }

  return options;
}

function logVersionCheck(name, installedVersion, latestVersion, isUpToDate) {
  // Quit if local
  if (installedVersion.startsWith('file:')) {
    isUpToDate = true;
  }

  // Log
  logger.log(`Checking if ${name} is up to date (${logger.format.bold(installedVersion)} >= ${logger.format.bold(latestVersion)}): ${isUpToDate ? logger.format.green('Yes') : logger.format.red('No')}`);
}
