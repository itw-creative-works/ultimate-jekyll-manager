// Libraries
const Manager = new (require('../../index.js'));
const logger = Manager.logger('clean');
const { execute } = require('node-powertools');

// Set index
let index = -1;

// Task
module.exports = async function clean(complete) {
  // Increment index
  index++;

  // Quit if index is not 0
  // Clean is called multiple times (once in default task and once in build task)
  // If clean is run more than once, it will clear important files BEFORE the jekyll build and will thus BREAK the build
  if (index > 0) {
    // Log
    logger.log('Skipping clean task since it has already run once');

    // Complete
    return complete();
  }

  // Log
  logger.log('Starting clean...');

  // Clean
  await execute('npx uj clean', {log: true});

  // Log
  logger.log('Finished clean!');

  // Complete
  return complete();
};
