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

// Load variables
const config = yaml.load(jetpack.read('dist/_config.yml'));
const firebaseVersion = version.clean(require('web-manager/package.json').dependencies.firebase);

// Settings
// const MINIFY = false;
const MINIFY = Manager.getEnvironment() === 'production';
const input = [
  // Include the project's src files
  'src/assets/js/**/*.js',

  // Include service worker
  'src/service-worker.js',

  // Include UJ's dist files
  path.join(__dirname, '../../../dist/assets/js/**/*.js'),

  // Files to exclude
  // '!dist/**',
];
const settings = {
  mode: 'production',
  target: ['web', 'es5'],
  plugins: [
    new ReplacePlugin({
      '{firebaseVersion}': firebaseVersion,
    }),
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
      return data.chunk.name === 'main' ? '[name].chunk.js' : '[name].chunk.[chunkhash].js';
    },
    filename: (data) => {
      return data.chunk.name === 'service-worker' ? '../../service-worker.js' : '[name].bundle.js';
    },
  },
  resolveLoader: {
    modules: [
      path.resolve(process.cwd(), 'node_modules', 'ultimate-jekyll-manager', 'node_modules'), // Path to your helper module's node_modules
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
                paths: [path.resolve(process.cwd(), 'node_modules', 'ultimate-jekyll-manager', 'node_modules')]
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
  if (process.env.UJ_BUILD_MODE === 'true') {
    logger.log('[watcher] Skipping watcher in build mode');
    return complete();
  }

  // Log
  logger.log('[watcher] Watching for changes...');

  // Watch for changes
  watch(input, { delay: 250 }, webpack)
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

// Default Task
module.exports = series(webpack, webpackWatcher);
