// Libraries
const Manager = new (require('../../index.js'));
const logger = Manager.logger('test');

// Task
module.exports = function test(complete) {
  // Log
  console.log('Starting test...');

  // Complete
  return complete();
}
