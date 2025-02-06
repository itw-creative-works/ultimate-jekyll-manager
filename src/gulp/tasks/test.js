// Libraries
const Manager = new (require('../../build.js'));
const logger = Manager.logger('test');

// Task
module.exports = function test(complete) {
  // Log
  logger.log('Starting test...');

  // Complete
  return complete();
}
