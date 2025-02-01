// Libraries
const path = require('path');
const wp = require('webpack');
const Manager = new (require('../../index.js'));
const logger = Manager.logger('webpack');

// console.log('======', path.resolve(__dirname, 'node_modules', 'babel-loader', 'lib', 'index.js'));

// Settings
const MINIFY = false;
const settings = {
  mode: 'production',
  entry: {
    // default: './src/js/default.js', // Common scripts
    default: './site/assets/js/test.js', // Common scripts
    // pricing: './src/js/pricing.js', // Page-specific script
    // about: './src/js/about.js'
  },
  output: {
    filename: '[name].bundle.js',
    // path: path.resolve(process.cwd(), 'site/assets/js'),
    path: path.resolve(process.cwd(), 'site/compiled/js'),
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
  watch: process.env.UJ_BUILD_MODE !== 'true',
}

// Task
module.exports = function webpack(complete) {
  // Log
  logger.log('Starting webpack compilation...');

  // Compiler
  const compiler = wp(settings, (e, stats) => {
    // Log
    logger.log('Finished webpack compilation!');

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
