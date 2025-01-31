// Libraries
const path = require('path');
const wp = require('webpack');

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
  watch: true, // Enables watch mode
}

// Task
module.exports = function webpack(complete) {
  console.log('*** webpack ***');
  // console.log('---- 1', path.resolve(process.cwd(), 'node_modules'));
  // console.log('---- 2', path.resolve(process.cwd(), 'node_modules', 'ultimate-jekyll-manager', 'node_modules'));

  // Compiler
  const compiler = wp(settings, (e, stats) => {
    // Log
    console.log('Compiling webpack starting...');

    // Error
    if (e) {
      console.error(e);
    } else {
      console.log(stats.toString({ colors: true }));
    }

    // Log
    console.log('Compiled webpack complete!');
  });

  // Complete
  return complete();
}
