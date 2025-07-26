// Libraries
const Manager = new (require('../../build.js'));
const logger = Manager.logger('defaults');
const { src, dest, watch, series } = require('gulp');
const through2 = require('through2');
const jetpack = require('fs-jetpack');
const path = require('path');
const { minimatch } = require('minimatch');
const { template } = require('node-powertools');
const createTemplateTransform = require('./utils/template-transform');
const argv = require('yargs').argv;

// Load package
const package = Manager.getPackage('main');
const project = Manager.getPackage('project');
const config = Manager.getConfig('project');
const rootPathPackage = Manager.getRootPath('main');
const rootPathProject = Manager.getRootPath('project');

// Get clean versions
// const cleanVersions = { versions: Manager.getCleanVersions()};
const cleanVersions = { versions: package.engines };

// File MAP
const FILE_MAP = {
  // Files to skip overwrite
  'hooks/**/*': {
    overwrite: false,
  },
  'src/**/*': {
    overwrite: false,
  },
  'src/**/*.{html,md,json}': {
    skip: (file) => {
      // Get the name
      const name = path.basename(file.name, path.extname(file.name));
      const htmlFilePath = path.join(file.destination, `${name}.html`);
      const mdFilePath = path.join(file.destination, `${name}.md`);
      const jsonFilePath = path.join(file.destination, `${name}.json`);
      const htmlFileExists = jetpack.exists(htmlFilePath);
      const mdFileExists = jetpack.exists(mdFilePath);
      const jsonFileExists = jetpack.exists(jsonFilePath);
      const anyExists = htmlFileExists || mdFileExists || jsonFileExists;

      // Skip if any of the files exist
      return anyExists;
    },
  },

  // Files to rewrite path
  // Removed because getting too confusing
  // 'dist/pages/**/*': {
  //   path: (file) => file.source.replace('dist/pages', 'dist'),
  // },
  '_.gitignore': {
    name: (file) => file.name.replace('_.gitignore', '.gitignore'),
  },

  // Files to run templating on
  '.github/workflows/build.yml': {
    template: cleanVersions,
  },
  '.nvmrc': {
    template: cleanVersions,
  },
  'Gemfile': {
    template: {
      ujPowertoolsVersion: argv.ujPluginDevMode === 'true'
        ? `path: File.expand_path('~/Developer/Repositories/ITW-Creative-Works/jekyll-uj-powertools')`
        : '"~> 1.0"'
    },
  },

  // Files to skip
  '**/.DS_Store': {
    skip: true,
  },
  '**/__temp/**/*': {
    skip: true,
  },
}

// Glob
const input = [
  // Files to include
  `${rootPathPackage}/dist/defaults/**/*`,
];
const output = './';
const delay = 250;

// Index
let index = -1;

// Main task
function defaults(complete) {
  // Increment index
  index++;

  // Log
  logger.log('Starting...');
  logger.log('input', input)

  // Log files being used
  logger.log('Files being used:');

  // Complete
  // return src(input, { base: 'src' })
  // src(input, { base: `${rootPathPackage}/dist/defaults` })
  return src(input, { dot: true, })
    // .pipe(through2.obj(function (file, _, callback) {
    //   // Log each file being processed
    //   logger.log(`  - ${file.path}`);
    //   callback(null, file);
    // }))
    .pipe(customTransform())
    .pipe(createTemplateTransform({site: config}))
    .pipe(dest(output))
    .on('finish', () => {
      // Log
      logger.log('Finished!');

      // Complete
      return complete();
    });
}

function customTransform() {
  return through2.obj(function (file, _, callback) {
    // Skip if it's a directory
    if (file.isDirectory()) {
      return callback(null, file);
    }

    // If the file is named .gitkeep, create the directory but don't copy the file
    if (path.basename(file.path) === '.gitkeep') {
      jetpack.dir(path.dirname(path.join(output, path.relative(file.base, file.path))));
      return callback();
    }

    // Get relative path
    const relativePath = path.relative(file.base, file.path).replace(/\\/g, '/');

    // Build item
    const item = {
      source: path.dirname(file.path),
      name: path.basename(file.path),
      destination: path.dirname(relativePath),
    };

    const options = getFileOptions(relativePath);
    const ogName = item.name;

    // Handle dynamic rename
    if (typeof options.name === 'function') {
      item.name = options.name(item);
    }

    // Handle dynamic path
    if (typeof options.path === 'function') {
      item.destination = options.path(item);
    }

    // Handle overwrite/skip as functions
    if (typeof options.overwrite === 'function') {
      options.overwrite = options.overwrite(item);
    }
    if (typeof options.skip === 'function') {
      options.skip = options.skip(item);
    }

    // Final relative path
    const finalRelativePath = path.join(item.destination, item.name);
    const fullOutputPath = path.join(output, finalRelativePath);

    // Check existence
    const exists = jetpack.exists(fullOutputPath);

    // Skip if instructed
    if (options.skip || (!options.overwrite && exists)) {
      logger.log(`Skipping file: ${relativePath}`);
      return callback();
    }

    // Log
    // logger.log(`Processing file: ${relativePath}`);
    // logger.log(`  _ORIG: ${file.path}`);
    // logger.log(`  name: ${item.name}`);
    // logger.log(`  destination: ${item.destination}`);
    // logger.log(`  overwrite: ${options.overwrite}`);
    // logger.log(`  skip: ${options.skip}`);
    // logger.log(`  rule: ${options.rule}`);
    // logger.log(`  _FINAL: ${fullOutputPath}`);
    // logger.log(`  _TEST_TEMP: ${minimatch(relativePath, 'dist/__temp/**/*')}`);
    // logger.log(`  _TEST_DS: ${minimatch(relativePath, '.DS_Store')}`);

    // Run template if required
    if (options.template) {
      const contents = file.contents.toString();
      const templated = template(contents, options.template);

      // Update file contents
      file.contents = Buffer.from(templated);
    }

    // Update path
    file.path = path.join(file.base, finalRelativePath);

    // Push transformed file
    this.push(file);

    // Complete
    return callback();
  });
}
function defaultsWatcher(complete) {
  // Quit if in build mode
  if (Manager.isBuildMode()) {
    logger.log('[watcher] Skipping watcher in build mode');
    return complete();
  }

  // Log
  logger.log('[watcher] Watching for changes...');

  // Watch for changes
  watch(input, { delay: delay, dot: true }, defaults)
  .on('change', (path) => {
    logger.log(`[watcher] File changed (${path})`);
  });

  // Complete
  return complete();
}

// Default Task
module.exports = series(defaults, defaultsWatcher);

function getFileOptions(filePath) {
  const defaults = {
    overwrite: true,
    name: null,
    path: null,
    template: null,
    skip: false,
    rule: null,
  };

  let options = { ...defaults };

  for (const pattern in FILE_MAP) {
    if (minimatch(filePath, pattern)) {
      options = { ...options, ...FILE_MAP[pattern] };
      options.rule = pattern;
    }
  }

  return options;
}
