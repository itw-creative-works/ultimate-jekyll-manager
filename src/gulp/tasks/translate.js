// Libraries
const Manager = new (require('../../build.js'));
const logger = Manager.logger('translate');

// Load package
const package = Manager.getPackage('main');
const project = Manager.getPackage('project');
const config = Manager.getConfig('project');
const rootPathPackage = Manager.getRootPath('main');
const rootPathProject = Manager.getRootPath('project');

// Task
module.exports = function translate(complete) {
  // Log
  logger.log('Starting translate...');

  // Check if BEM env variable is set
  // get cached translations JSON (only once per run, so keep track of how many times this has run) from branch uj-translations
  // loop thru all html and md pages in pages/ dir (main and project)
    // SKIP files in _translations dir
  // if there is no translation (or translation is too old), send to AI @ itw
  // save the translation into the cache (file path, date) and write the file to _translations/{code}/{original file path + name}
  // push the updated translation JSON to the branch uj-translations

  // Complete
  return complete();
}
