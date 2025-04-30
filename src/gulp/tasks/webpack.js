// Libraries
const Manager = new (require('../../build.js'));
const logger = Manager.logger('webpack');
const { watch, series } = require('gulp');
const glob = require('glob').globSync;
const path = require('path');
const jetpack = require('fs-jetpack');
const wp = require('webpack');
const ReplacePlugin = require('../plugins/webpack/replace.js');
const yaml = require('js-yaml');
const version = require('wonderful-version');

// Load package
const package = Manager.getPackage('main');
const project = Manager.getPackage('project');
const config = Manager.getConfig('project');
const rootPathPackage = Manager.getRootPath('main');
const rootPathProject = Manager.getRootPath('project');

// Settings
// const MINIFY = false;
const MINIFY = Manager.getEnvironment() === 'production';
const input = [
  // Include UJ's dist files
  `${rootPathPackage}/dist/assets/js/**/*`,

  // Include the project's src files
  'src/assets/js/**/*.js',

  // Include service worker
  'src/service-worker.js',

  // Files to exclude
  // '!dist/**',
];
const delay = 250;

const settings = {
  mode: 'production',
  target: ['web', 'es5'],
  plugins: [
    new ReplacePlugin(getTemplateReplaceOptions(), { type: 'template' }),
  ],
  entry: {
    // Entry is dynamically generated
  },
  output: {
    // Set the path to the dist folder
    path: path.resolve(process.cwd(), 'dist/assets/js'),

    // Set the public path
    publicPath: `${Manager.isServer() ? config.url : ''}/assets/js/`,

    // https://github.com/webpack/webpack/issues/959
    chunkFilename: (data) => {
      // Special case for the main chunk
      if (data.chunk.name === 'main') {
        return '[name].chunk.js';
      }

      // Otherwise, use the default chunk filename
      return '[name].chunk.[chunkhash].js';
    },
    filename: (data) => {
      // Special case for the service-worker chunk
      if (data.chunk.name === 'service-worker') {
        return '../../service-worker.js';
      }

      // Otherwise, use the default filename
      return '[name].bundle.js';
    },
  },
  resolveLoader: {
    modules: [
      path.resolve(process.cwd(), 'node_modules', package.name, 'node_modules'), // Path to your helper module's node_modules
      path.resolve(process.cwd(), 'node_modules'), // Default project node_modules
      'node_modules', // Fallback to global
    ]
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            // presets: ['@babel/preset-env'],
            presets: [
              require.resolve('@babel/preset-env', {
                paths: [path.resolve(process.cwd(), 'node_modules', package.name, 'node_modules')]
              })
            ],
            compact: MINIFY,
          }
        }
      }
    ]
  },
  optimization: {
    minimize: MINIFY,
  },
}

// Task
function webpack(complete) {
  // Log
  logger.log('Starting...');

  // Update entry points
  updateEntryPoints();

  // Compiler
  const compiler = wp(settings, (e, stats) => {
    // Log
    logger.log('Finished!');

    // Error
    if (e) {
      logger.error(e);
    } else {
      logger.log('Stats:\n', stats.toString({ colors: true }));
    }

    // Complete
    return complete(e);
  });
}
// Watcher task
function webpackWatcher(complete) {
  // Quit if in build mode
  if (Manager.isBuildMode()) {
    logger.log('[watcher] Skipping watcher in build mode');
    return complete();
  }

  // Log
  logger.log('[watcher] Watching for changes...');

  // Watch for changes
  watch(input, { delay: delay, dot: true }, webpack)
  .on('change', function(path) {
    // Log
    logger.log(`[watcher] File ${path} was changed`);
  });

  // Complete
  return complete();
}

function updateEntryPoints() {
  // Get all JS files
  const files = glob(input);

  // Update from src
  settings.entry = files.reduce((acc, file) => {
    // Get the file name
    const name = path.basename(file, path.extname(file));

    // Add to entry points starting with "./"
    // acc[name] = `./${file}`;
    acc[name] = path.resolve(file);

    // Return
    return acc;
  }, {});

  // Log
  logger.log('Updated entry points:', settings.entry);
}

// function updateEntryPoints() {
//   const files = glob(input)

//   settings.entry = files.reduce((acc, file) => {
//     // Remove the root base path (project root or UJ root)
//     let relative = path.relative(path.resolve(process.cwd(), 'dist/assets/js'), file)

//     // Fall back to relative to project src if still absolute
//     if (relative.startsWith('..')) {
//       relative = path.relative(path.resolve(process.cwd(), 'src/assets/js'), file)
//     }

//     // Remove extension
//     const entryName = relative.replace(/\.js$/, '')

//     // Normalize to POSIX paths for consistency across OSes
//     acc[entryName.split(path.sep).join('/')] = path.resolve(file)

//     return acc
//   }, {})

//   logger.log('Updated entry points:', settings.entry)
// }

// function updateEntryPoints() {
//   const files = glob(input)

//   settings.entry = files.reduce((acc, file) => {
//     // Remove the root base path (project root or UJ root)
//     let relative = path.relative(path.resolve(process.cwd(), 'dist/assets/js'), file)

//     // Fall back to relative to project src if still absolute
//     if (relative.startsWith('..')) {
//       relative = path.relative(path.resolve(process.cwd(), 'src/assets/js'), file)
//     }

//     // Remove extension
//     const entryName = relative.replace(/\.js$/, '')

//     // Normalize to POSIX paths for consistency across OSes
//     acc[entryName.split(path.sep).join('/')] = path.resolve(file)

//     return acc
//   }, {})

//   logger.log('Updated entry points:', settings.entry)
// }

function getTemplateReplaceOptions() {
  // Load variables
  return {
    firebaseVersion: version.clean(require('web-manager/package.json').dependencies.firebase),
  }
}

// Default Task
module.exports = series(webpack, webpackWatcher);
