// Libraries
let webManager = null;

// Module
export default (Manager, options) => {
  return new Promise(async function (resolve) {
    // Set webManager
    webManager = Manager.webManager;

    // Resolve
    return resolve();
  });
};
