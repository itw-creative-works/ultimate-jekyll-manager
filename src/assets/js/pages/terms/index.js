// @TODO: DELETE THIS FILE when the project is ready

// Libraries
import helper from './helper.js';

// Module
export default (Manager, options) => {
  return new Promise(async function (resolve, reject) {
    // Shortcuts
    const { webManager } = Manager;

    // Log
    console.error('------- AAA main/term.js');

    // Execute
    helper(Manager, options);

    // Resolve
    return resolve();
  });
}
