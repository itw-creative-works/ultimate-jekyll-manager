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
const inputMain = [
  // Project entry point
  'src/assets/js/main.js',

  // Modules (standalone webpacked scripts)
  `${rootPathPackage}/dist/assets/js/modules/**/*.js`,
  'src/assets/js/modules/**/*.js',

  // Files to exclude
  // '!dist/**',
];

const inputServiceWorker = [
  // Project service worker
  'src/service-worker.js',
];

// Additional files to watch (but not compile as entry points)
const watchInput = [
  // Watch the paths we're compiling
  ...inputMain,
  ...inputServiceWorker,

  // Page-specific js - watch for changes but don't compile as entry points
  `${rootPathPackage}/dist/assets/js/pages/**/*.js`,
  'src/assets/js/pages/**/*.js',

  // Core JS - watch for changes but don't compile as entry points
  `${rootPathPackage}/dist/assets/js/**/*.js`,

  // Theme js - watch for changes but don't compile as entry points
  `${rootPathPackage}/dist/assets/themes/**/*.js`,
  'src/assets/themes/**/*.js',

  // So we can watch for changes while we're developing web-manager
  `${rootPathPackage}/../web-manager/src`,
];

// Files to copy directly without webpack processing
const copy = [
  // `${rootPathPackage}/dist/assets/js/utilities/**/*.js`,
];

const delay = 250;

// Bundle naming configuration
const bundleNaming = {
  // Files that should have stable (non-hashed) names
  stable: [
    /^main$/,                      // Main bundle
    /^service-worker$/,            // Service worker
    /^modules\//,                  // All module files get stable names
  ],
  // Special output paths (relative to dist/assets/js/)
  specialPaths: {
    'service-worker': '../../service-worker.js'
  }
};

const settings = {
  mode: Manager.actLikeProduction() ? 'production' : 'development',
  target: ['web', 'es5'],
  devtool: Manager.actLikeProduction() ? 'source-map' : 'eval-source-map',
  // devtool: false,
  plugins: [
    new StripDevBlocksPlugin(),
    new ReplacePlugin(getTemplateReplaceOptions(), { type: 'template' }),
    // new wp.IgnorePlugin({
    //   resourceRegExp: /^\.\/locale$/,
    //   contextRegExp: /moment$/,
    // }),
    // new wp.SourceMapDevToolPlugin({
    //   filename: '[file].map',
    //   test: new RegExp('\.[js|css|mjs].*'),
    //   // exclude: /vendor/,
    // }),
    // new wp.DefinePlugin({
    //   'process.env.UJ_BUILD_MODE': process.env.UJ_BUILD_MODE || 'true',
    // })
  ],
  // ignoreWarnings: [
  //   /Failed to parse source map/,
  // ],
  entry: {
    // Entry is dynamically generated
  },
  resolve: {
    alias: {
      // For importing assets in "src/index.js"
      '__main_assets__': path.resolve(rootPathPackage, 'dist/assets'),
      '__project_assets__': path.resolve(process.cwd(), 'src/assets'),

      // For importing the theme
      '__theme__': path.resolve(rootPathPackage, 'dist/assets/themes', config.theme.id),
    },
    // Fallbacks for Node.js modules that don't work in the browser
    fallback: {
      fs: false,
      path: false,
      crypto: false,
      os: false,
      util: false,
      assert: false,
      stream: false,
      buffer: false,
      process: false
    }
  },
  output: {
    // Set the path to the dist folder
    path: path.resolve(process.cwd(), 'dist/assets/js'),

    // Set the public path
    publicPath: `${Manager.isServer() ? config.url : ''}/assets/js/`,

    // https://github.com/webpack/webpack/issues/959
    chunkFilename: (data) => {
      const name = data.chunk.name;

      // Check if this chunk should have a stable name
      if (shouldHaveStableName(name)) {
        return '[name].chunk.js';
      }

      // Otherwise, use hashed filename
      return '[name].chunk.[chunkhash].js';
    },
    filename: (data) => {
      const name = data.chunk.name;

      // Check for special output paths
      if (bundleNaming.specialPaths[name]) {
        return bundleNaming.specialPaths[name];
      }

      // Check if this bundle should have a stable name
      if (shouldHaveStableName(name)) {
        return '[name].bundle.js';
      }

      // Everything else gets hashed
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
            sourceMaps: true,
            presets: [
              require.resolve('@babel/preset-env', {
                paths: [path.resolve(process.cwd(), 'node_modules', package.name, 'node_modules')]
              })
            ],
            compact: Manager.isBuildMode(),
          }
        }
      },
      // {
      //   test: /\.js$/,
      //   include: /node_modules/,
      //   use: ['source-map-loader'],
      //   enforce: 'pre',
      // }
    ]
  },
  optimization: {
    minimize: Manager.actLikeProduction(),
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

// Helper function to determine if a bundle should have a stable name
function shouldHaveStableName(name) {
  return bundleNaming.stable.some(pattern => pattern.test(name));
}

// Task
function webpack(complete) {
  // Log
  logger.log('Starting...');

  // Log mode and devtools
  logger.log(`Mode: ${settings.mode}`);
  logger.log(`Devtool: ${settings.devtool}`);

  // Copy files
  copyFilesDirectly();

  // Build configs array
  const configs = [];

  // Main entries config
  const mainEntries = updateEntryPoints(inputMain);
  if (Object.keys(mainEntries).length > 0) {
    configs.push({
      ...settings,
      entry: mainEntries
    });
  }

  // Service worker config
  const serviceWorkerEntries = updateEntryPoints(inputServiceWorker);
  if (Object.keys(serviceWorkerEntries).length > 0) {
    configs.push({
      ...settings,
      entry: serviceWorkerEntries,
      output: {
        ...settings.output,
        // Set global object for service worker
        globalObject: 'self',
        // Service worker output format - use umd to avoid module issues
        libraryTarget: 'umd',
      },
      target: 'webworker',
      resolve: {
        ...settings.resolve,
        // Ensure webpack can find ultimate-jekyll-manager modules
        modules: [
          path.resolve(process.cwd(), 'node_modules'),
          path.resolve(process.cwd(), 'node_modules', package.name, 'node_modules'),
          'node_modules',
        ],
      },
      module: {
        rules: [
          {
            test: /\.js$/,
            exclude: /node_modules/,
            use: {
              loader: 'babel-loader',
              options: {
                sourceMaps: true,
                presets: [
                  [require.resolve('@babel/preset-env', {
                    paths: [path.resolve(process.cwd(), 'node_modules', package.name, 'node_modules')]
                  }), {
                    modules: 'commonjs'  // Transform ES6 imports to CommonJS for service worker
                  }]
                ],
                compact: Manager.isBuildMode(),
              }
            }
          }
        ]
      },
      optimization: {
        ...settings.optimization,
        // Disable runtime chunk for service worker
        runtimeChunk: false,
        // Disable splitting for service worker to avoid chunk loading issues
        splitChunks: false
      }
    });
  }

  // Compiler
  wp(configs, (e, stats) => {
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
  watch(watchInput, { delay: delay, dot: true }, webpack)
  .on('change', (path) => {
    // Log
    logger.log(`[watcher] File changed (${path})`);
  });

  // Complete
  return complete();
}

function updateEntryPoints(inputArray) {
  // Get all JS files
  const files = glob(inputArray).map((f) => path.resolve(f));

  // Sort: main files first
  files.sort((a, b) => {
    const aIsMain = a.startsWith(rootPathPackage);
    const bIsMain = b.startsWith(rootPathPackage);
    return aIsMain === bIsMain ? 0 : aIsMain ? -1 : 1;
  });

  // Update from src
  const entries = files.reduce((acc, file) => {
    let name;

    // Determine naming based on file type
    if (file.includes('/assets/js/modules/')) {
      name = file.split('/assets/js/')[1];
    } else {
      // Everything else: just use the base filename
      name = path.basename(file);
    }

    // Strip .js extension
    name = name.replace(/\.js$/, '');

    // Update entry points
    acc[name] = file;

    // Return
    return acc;
  }, {});

  // Log
  logger.log('Updated entry points:', entries);
  return entries;
}

function copyFilesDirectly() {
  // Get files to copy
  const filesToCopy = glob(copy);

  // Log
  logger.log('Copying files directly:', filesToCopy.length);

  // If no files to copy, return
  if (filesToCopy.length === 0) {
    return;
  }

  // Copy files
  filesToCopy.forEach(file => {
    const absolutePath = path.resolve(file);
    const relativePath = path.relative(rootPathPackage, absolutePath);

    // Extract the part after dist/assets/js/
    const match = relativePath.match(/^dist\/assets\/js\/(.+)$/);
    if (match) {
      const outputPath = path.join(process.cwd(), 'dist/assets/js', match[1]);

      // Ensure directory exists
      jetpack.dir(path.dirname(outputPath));

      // Copy file
      jetpack.copy(absolutePath, outputPath, { overwrite: true });

      logger.log(`Copied: ${match[1]}`);
    }
  });
}

function getTemplateReplaceOptions() {
  // Load variables
  return {
    firebaseVersion: version.clean(require('web-manager/package.json').dependencies.firebase),
  }
}

// Default Task
// Export
module.exports = series(
  // Manager.wrapTask('webpack', webpack),
  webpack,
  webpackWatcher
);
