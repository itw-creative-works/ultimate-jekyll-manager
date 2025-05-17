// Libraries
const Manager = new (require('../../build.js'));
const logger = Manager.logger('webpack');
const { watch, series } = require('gulp');
const glob = require('glob').globSync;
const path = require('path');
const jetpack = require('fs-jetpack');
const wp = require('webpack');
const ReplacePlugin = require('../plugins/webpack/replace.js');
const StripDevBlocksPlugin = require('../plugins/webpack/strip-dev-blocks.js')
const yaml = require('js-yaml');
const version = require('wonderful-version');

// Load package
const package = Manager.getPackage('main');
const project = Manager.getPackage('project');
const config = Manager.getConfig('project');
const rootPathPackage = Manager.getRootPath('main');
const rootPathProject = Manager.getRootPath('project');

// Settings
const input = [
  // Project entry point
  'src/assets/js/main.js',

  // Project service worker
  'src/service-worker.js',

  // Main page js
  `${rootPathPackage}/dist/assets/js/pages/**/*.js`,

  // Project page js
  'src/assets/js/pages/**/*.js',

  // Files to exclude
  // '!dist/**',
];
const delay = 250;

// Stable entry points
const stableEntryPoints = [
  'main',
  'project',
];

const settings = {
  mode: 'production',
  target: ['web', 'es5'],
  plugins: [
    new StripDevBlocksPlugin(),
    new ReplacePlugin(getTemplateReplaceOptions(), { type: 'template' }),
    // new wp.DefinePlugin({
    //   'process.env.UJ_BUILD_MODE': process.env.UJ_BUILD_MODE || 'true',
    // })
  ],
  entry: {
    // Entry is dynamically generated
  },
  resolve: {
    alias: {
      // For importing assets in "src/index.js"
      '__main_assets__': path.resolve(rootPathPackage, 'dist/assets'),
      '__project_assets__': path.resolve(process.cwd(), 'src/assets'),

      // For importing the theme
      '__theme__': path.resolve(rootPathPackage, 'dist/assets/themes', config.theme.id, config.theme.version),
    }
  },
  output: {
    // Set the path to the dist folder
    path: path.resolve(process.cwd(), 'dist/assets/js'),

    // Set the public path
    publicPath: `${Manager.isServer() ? config.url : ''}/assets/js/`,

    // https://github.com/webpack/webpack/issues/959
    chunkFilename: (data) => {
      // Main chunks get stable names
      if (stableEntryPoints.includes(data.chunk.name)) {
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

      // Main bundles get stable names
      if (stableEntryPoints.includes(data.chunk.name)) {
        return '[name].bundle.js';
      }

      // Everything else (page-specific async imports) gets hashed
      return '[name].bundle.[contenthash].js';
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
            compact: Manager.isBuildMode(),
          }
        }
      }
    ]
  },
  optimization: {
    minimize: Manager.isBuildMode(),
    // splitChunks: {
    //   chunks: 'all',
    //   cacheGroups: {
    //     defaultVendors: {
    //       test: /[\\/]node_modules[\\/]/,
    //       name: 'vendors',
    //       chunks: 'all',
    //       enforce: true,
    //     },
    //     default: {
    //       minChunks: 2,
    //       reuseExistingChunk: true,
    //       enforce: true,
    //     },
    //   },
    // },
    // runtimeChunk: 'single',
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

// function updateEntryPoints() {
//   // Get all JS files
//   const files = glob(input);

//   console.log('---rootPathPackage', rootPathPackage);
//   console.log('---rootPathProject', rootPathProject);
//   console.log('---FILES', files);

//   // Update from src
//   settings.entry = files.reduce((acc, file) => {
//     console.log('---ITEM', file);

//     // Get the file name
//     const name = path.basename(file, path.extname(file));

//     // Add to entry points starting with "./"
//     // acc[name] = `./${file}`;
//     acc[name] = path.resolve(file);

//     // Return
//     return acc;
//   }, {});

//   // Log
//   logger.log('Updated entry points:', settings.entry);
// }

function updateEntryPoints() {
  // Get all JS files
  const files = glob(input).map((f) => path.resolve(f));

  // console.log('---rootPathPackage', rootPathPackage);
  // console.log('---rootPathProject', rootPathProject);

  // Sort: main files first
  files.sort((a, b) => {
    const aIsMain = a.startsWith(rootPathPackage);
    const bIsMain = b.startsWith(rootPathPackage);
    return aIsMain === bIsMain ? 0 : aIsMain ? -1 : 1;
  });

  // console.log('🚩🚩🚩🚩🚩', 1, ); // FLAG
  // console.log('---FILES', files);

  // Update from src
  settings.entry = files.reduce((acc, file) => {
    const isProject = file.startsWith(rootPathProject);
    const root = isProject ? rootPathProject : rootPathPackage;
    const relativePath = path.relative(root, file).replace(/\\/g, '/').replace(/\.js$/, '');

    // Remove known base paths
    let name = relativePath
      .replace(/^dist\/assets\/js\//, '')
      .replace(/^src\/assets\/js\//, '')
      .replace(/^src\//, '');

    // If it's in a "pages" folder, suffix with .main or .project
    if (name.includes('pages/')) {
      name += isProject ? '.project' : '.main';
    } else {
      // For all others not in "pages", just use the base filename
      name = path.basename(name);
    }

    // Dont include pages in the entry points
    if (
      file.includes('assets/js/pages/')
      || file.includes('assets/js/global.js')
    ) {
      return acc;
    }

    // Update entry points
    acc[name] = file;

    // Return
    return acc;
  }, {});

  // Log
  logger.log('Updated entry points:', settings.entry);
}

function getTemplateReplaceOptions() {
  // Load variables
  return {
    firebaseVersion: version.clean(require('web-manager/package.json').dependencies.firebase),
  }
}

// Default Task
module.exports = series(webpack, webpackWatcher);
