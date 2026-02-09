/**
 * Alternatives Page JavaScript
 */

// Libraries
let webManager = null;

// Module
export default (Manager) => {
  return new Promise(async function (resolve) {
    // Shortcuts
    webManager = Manager.webManager;

    // Initialize when DOM is ready
    await webManager.dom().ready();

    // Resolve after initialization
    return resolve();
  });
};
