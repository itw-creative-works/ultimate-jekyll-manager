// Libraries
const path = require('path');
const jetpack = require('fs-jetpack');
const fs = require('fs');
const JSON5 = require('json5');
const argv = require('yargs')(process.argv.slice(2)).parseSync();
const { force, execute } = require('node-powertools');
const yaml = require('js-yaml');

// Global task tracking (shared across all Manager instances)
global._ultimateJekyllActiveTasks = global._ultimateJekyllActiveTasks || new Map();
global._ultimateJekyllTaskListeners = global._ultimateJekyllTaskListeners || new Set();

// Class
function Manager() {
  const self = this;

  // Properties
  self._logger = null;

  // Return
  return self;
}

// Initialize
Manager.prototype.initialize = function () {
  console.log('initialize:');
};

// Logger
Manager.prototype.logger = function (name) {
  // Check if called as static method (this is not a Manager instance)
  if (!(this instanceof Manager)) {
    // For static calls, just return a new logger without caching
    return new (require('./lib/logger'))(name);
  }

  // For instance calls, cache the logger
  if (!this._logger) {
    this._logger = new (require('./lib/logger'))(name);
  }

  return this._logger;
};

// Add static method that delegates to prototype
Manager.logger = Manager.prototype.logger;

// argv
Manager.getArguments = function () {
  const options = argv || {};

  // Fix
  options._ = options._ || [];
  options.browser = force(options.browser === undefined ? true : options.browser, 'boolean');
  options.debug = force(options.debug === undefined ? false : options.debug, 'boolean');

  // Return
  return options;
};
Manager.prototype.getArguments = Manager.getArguments;

// Report build errors with notification
Manager.reportBuildError = function (error, callback) {
  const logger = new (require('./lib/logger'))('build-error');

  // Send notification using notifly
  const errorMessage = error.message || error.toString() || 'Unknown error';
  const errorPlugin = error.plugin || 'Build';

  execute(`notifly --title 'Build Error: ${errorPlugin}' --message '${errorMessage.replace(/'/g, "\\'")}' --appIcon '/Users/ian/claude-ai-icon.png' --timeout 3 --sound 'Sosumi'`)
    .catch((e) => {
      logger.error('Failed to send notification', e);
    });

  // Log the error
  logger.error(`[${errorPlugin}] ${errorMessage}`);

  // If callback provided, call it with error
  if (callback) {
    return callback(error);
  }

  // Otherwise return a function that calls the callback with error
  return (cb) => cb ? cb(error) : error;
};
Manager.prototype.reportBuildError = Manager.reportBuildError;

// isServer
Manager.isServer = function () {
  return process.env.UJ_IS_SERVER === 'true';
}
Manager.prototype.isServer = Manager.isServer;

// isBuildMode
Manager.isBuildMode = function () {
  return process.env.UJ_BUILD_MODE === 'true';
}
Manager.prototype.isBuildMode = Manager.isBuildMode;

// actLikeProduction - determines if we should act like production mode
Manager.actLikeProduction = function () {
  return Boolean(Manager.isBuildMode() || process.env.UJ_AUDIT_FORCE === 'true');
}
Manager.prototype.actLikeProduction = Manager.actLikeProduction;

// getEnvironment (calls isServer ? 'production' : 'development')
Manager.getEnvironment = function () {
  return Manager.isServer() ? 'production' : 'development';
}
Manager.prototype.getEnvironment = Manager.getEnvironment;

// getConfig: requires and parses config.yml
Manager.getConfig = function (type) {
  const basePath = type === 'project'
    ? 'src'
    : 'dist';
  const resolvedPath = path.join(basePath, '_config.yml');

  return yaml.load(jetpack.read(resolvedPath));
}
Manager.prototype.getConfig = Manager.getConfig;

// getPackage: requires and parses package.json
Manager.getPackage = function (type) {
  const basePath = type === 'project'
    ? process.cwd()
    : path.resolve(__dirname, '..')

  const pkgPath = path.join(basePath, 'package.json');

  return JSON5.parse(jetpack.read(pkgPath));
}
Manager.prototype.getPackage = Manager.getPackage;

// getUJMConfig: requires and parses ultimate-jekyll-manager.json
Manager.getUJMConfig = function () {
  const configPath = path.join(process.cwd(), 'config', 'ultimate-jekyll-manager.json');
  return JSON5.parse(jetpack.read(configPath));
}
Manager.prototype.getUJMConfig = Manager.getUJMConfig;

// getRootPath: returns the root path of the project or package
Manager.getRootPath = function (type) {
  return type === 'project'
    ? process.cwd()
    : path.resolve(__dirname, '..')
}
Manager.prototype.getRootPath = Manager.getRootPath;

// get Working URL
// If this is called BEFORE BrowserSync is initialized, it will return the project URL from config
Manager.getWorkingUrl = function () {
  try {
    return global.browserSync.instance.options.get('urls').get('external');
  } catch (error) {
    return Manager.getConfig('project').url;
  }
}
Manager.prototype.getWorkingUrl = Manager.getWorkingUrl;

// Create dummy file in project dist to force jekyll to build
Manager.triggerRebuild = function (files, logger) {
  // Ensure logger is defined
  logger = this?._logger || logger || console;

  // Normalize files into an array of file names
  if (typeof files === 'string') {
    files = [files]; // Single string file name
  } else if (Array.isArray(files)) {
    // Already an array, no changes needed
  } else if (typeof files === 'object' && files !== null) {
    files = Object.keys(files); // Extract keys from object
  } else {
    logger.error('Invalid files for triggerRebuild()');
    return;
  }

  // Set current time
  const now = new Date();

  // Touch all files to update mtime (so Jekyll notices)
  files.forEach((file) => {
    try {
      fs.utimesSync(file, now, now);
      logger.log(`Triggered build: ${file}`);
    } catch (e) {
      logger.error(`Failed to trigger build ${file}`, e);
    }
  });
}
Manager.prototype.triggerRebuild = Manager.triggerRebuild;

// Require
Manager.require = function (path) {
  return require(path);
};
Manager.prototype.require = Manager.require;

// Memory monitoring utility
Manager.getMemoryUsage = function () {
  const used = process.memoryUsage();
  return {
    rss: Math.round(used.rss / 1024 / 1024),
    heapTotal: Math.round(used.heapTotal / 1024 / 1024),
    heapUsed: Math.round(used.heapUsed / 1024 / 1024),
    external: Math.round(used.external / 1024 / 1024),
  };
};
Manager.prototype.getMemoryUsage = Manager.getMemoryUsage;

Manager.logMemory = function (logger, label) {
  const mem = Manager.getMemoryUsage();
  logger.log(`[Memory ${label}] RSS: ${mem.rss}MB | Heap Used: ${mem.heapUsed}MB / ${mem.heapTotal}MB | External: ${mem.external}MB`);
};
Manager.prototype.logMemory = Manager.logMemory;

// Process array in batches to avoid memory issues
Manager.processBatches = async function (items, batchSize, processFn, logger) {
  const results = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(items.length / batchSize);

    if (logger) {
      logger.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} items)...`);
      Manager.logMemory(logger, `Before Batch ${batchNum}`);
    }

    const batchResults = await Promise.all(batch.map(processFn));
    results.push(...batchResults);

    if (logger) {
      Manager.logMemory(logger, `After Batch ${batchNum}`);
    }

    // Force garbage collection if available (requires --expose-gc flag)
    if (global.gc) {
      global.gc();
      if (logger) {
        logger.log(`Forced garbage collection after batch ${batchNum}`);
        Manager.logMemory(logger, `After GC`);
      }
    }
  }

  return results;
};
Manager.prototype.processBatches = Manager.processBatches;

// // Task Tracking System (uses global tracking)
// Manager.prototype.taskStart = function (taskName) {
//   const logger = this.logger('task-tracker');
//   logger.log(`Task started 222: ${taskName}`);
//   global._ultimateJekyllActiveTasks.set(taskName, {
//     startTime: Date.now(),
//     status: 'running'
//   });
// };

// Manager.prototype.taskEnd = function (taskName) {
//   const logger = this.logger('task-tracker');
//   const task = global._ultimateJekyllActiveTasks.get(taskName);
//   if (task) {
//     const duration = Date.now() - task.startTime;
//     logger.log(`Task completed 222: ${taskName} (${duration}ms)`);
//     global._ultimateJekyllActiveTasks.delete(taskName);

//     // Notify listeners if all tasks are complete
//     if (global._ultimateJekyllActiveTasks.size === 0) {
//       this._notifyTaskListeners();
//     }
//   }
// };

// Manager.prototype.waitForTasks = function (callback) {
//   const logger = this.logger('task-tracker');

//   if (global._ultimateJekyllActiveTasks.size === 0) {
//     // No active tasks, proceed immediately
//     logger.log('No active tasks, proceeding immediately');
//     callback();
//   } else {
//     // Wait for active tasks to complete
//     const taskNames = Array.from(global._ultimateJekyllActiveTasks.keys());
//     logger.log(`Waiting for ${taskNames.length} tasks to complete: ${taskNames.join(', ')}`);
//     global._ultimateJekyllTaskListeners.add(callback);
//   }
// };

// Manager.prototype._notifyTaskListeners = function () {
//   const logger = this.logger('task-tracker');
//   if (global._ultimateJekyllTaskListeners.size > 0) {
//     logger.log(`Notifying ${global._ultimateJekyllTaskListeners.size} listeners that all tasks are complete`);
//     global._ultimateJekyllTaskListeners.forEach(callback => {
//       callback();
//     });
//     global._ultimateJekyllTaskListeners.clear();
//   }
// };

// // Wrapper to auto-track gulp tasks
// Manager.prototype.wrapTask = function (taskName, taskFn) {
//   const self = this;
//   return function wrappedTask(done) {
//     self.taskStart(taskName);

//     // Wrap the done callback to auto-end the task
//     const wrappedDone = (err) => {
//       self.taskEnd(taskName);
//       done(err);
//     };

//     // Call the original task with wrapped callback
//     const result = taskFn(wrappedDone);

//     // Handle promises
//     if (result && typeof result.then === 'function') {
//       return result.then(
//         () => {
//           self.taskEnd(taskName);
//           done();
//         },
//         (err) => {
//           self.taskEnd(taskName);
//           done(err);
//         }
//       );
//     }

//     return result;
//   };
// };

// Export
module.exports = Manager;
