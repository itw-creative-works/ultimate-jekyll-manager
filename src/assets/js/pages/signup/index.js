// Libraries
import authPages from '__main_assets__/js/libs/auth.js';

// Module
export default (Manager, options) => {
  return new Promise(async function (resolve, reject) {
    // Shortcuts
    const { webManager } = Manager;

    // Run authPages
    await authPages(Manager);

    // Resolve
    return resolve();
  });
}
