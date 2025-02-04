// Libraries
const Manager = new (require('../../index.js'));
const logger = Manager.logger('webpack');
const { watch, series } = require('gulp');
const glob = require('glob').globSync;
const path = require('path');
const jetpack = require('fs-jetpack');
const wp = require('webpack');
const yaml = require('js-yaml');
const config = yaml.load(jetpack.read('dist/_config.yml'));

// Settings
const MINIFY = false;
const input = [
  // Files to include
  'src/assets/js/**/*.js',

  // Files to exclude
  // '!dist/**',
];
const settings = {
  mode: 'production',
  target: ['web', 'es5'],
  entry: {},
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
      return '[name].bundle.js';
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

  // Update entry points
  settings.entry = files.reduce((acc, file) => {
    // Get the file name
    const name = path.basename(file, path.extname(file));

    // Add to entry points starting with "./"
    acc[name] = `./${file}`;

    // Return
    return acc;
  }, {});

  // Log
  logger.log('Updated entry points:', settings.entry);
}

// Default Task
module.exports = series(webpack, webpackWatcher);
