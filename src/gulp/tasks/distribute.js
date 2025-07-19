// Libraries
const Manager = new (require('../../build.js'));
const logger = Manager.logger('distribute');
const { src, dest, watch, series } = require('gulp');
const through2 = require('through2');
const path = require('path');

// Load package
const package = Manager.getPackage('main');
const project = Manager.getPackage('project');
const config = Manager.getConfig('project');
const rootPathPackage = Manager.getRootPath('main');
const rootPathProject = Manager.getRootPath('project');

// Glob
const input = [
  // Files to include
  'src/**/*',

  // Files to exclude
  // '!dist/**',
];
const output = 'dist';
const delay = 250;

// Index
let index = -1;

// Main task
function distribute() {
  return new Promise(async function(resolve, reject) {
    // Increment index
    index++;

    // Log
    logger.log('Starting...');

    // Complete
    return src(input, { base: 'src', dot: true })
      // .pipe(customTransform())
      .pipe(dest(output))
      .on('end', () => {
        // Log
        logger.log('Finished!');

        // Complete
        return resolve();
      });
  });
}

function customTransform() {
  return through2.obj(function (file, _, callback) {
    // Skip if it's a directory
    if (file.isDirectory()) {
      return callback(null, file);
    }

    // Get relative path
    const relativePath = path.relative(file.base, file.path);

    // Log
    // logger.log(`Processing file 111: ${relativePath}`);

    // Change path if it starts with 'pages/'
    if (relativePath.startsWith('pages/')) {
      const newRelativePath = relativePath.replace(/^pages\//, '');
      file.path = path.join(file.base, newRelativePath);

      // Log
      // logger.log(`Changed path to 222: ${file.path}`);
    }

    // Log
    // logger.log(`Processing file 333: ${file.path}`);

    // Push the file
    this.push(file);

    // Continue
    callback(null, file);
  });
}

// Watcher task
function distributeWatcher(complete) {
  // Quit if in build mode
  if (Manager.isBuildMode()) {
    logger.log('[watcher] Skipping watcher in build mode');
    return complete();
  }

  // Log
  logger.log('[watcher] Watching for changes...');

  // Watch for changes
  watch(input, { delay: delay, dot: true }, distribute)
  .on('change', (path) => {
    logger.log(`[watcher] File changed (${path})`);
  });

  // Complete
  return complete();
}

// Default Task
module.exports = series(distribute, distributeWatcher);


