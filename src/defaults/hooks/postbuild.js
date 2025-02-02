// Libraries
const Manager = new (require('ultimate-jekyll-manager'));
const logger = Manager.logger('hook:postbuild');

// Hook
module.exports = async (index) => {
  logger.log('Running with index =', index);
}
