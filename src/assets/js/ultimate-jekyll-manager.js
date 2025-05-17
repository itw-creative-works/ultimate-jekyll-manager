// Module
module.exports = (Manager) => {
  return new Promise(function(resolve, reject) {
    // Shortcuts
    const { webManager } = Manager;

    // Import the theme from src/assets/themes/{ id }
    require('__theme__/_theme.js');

    // Log
    console.error('------- XXX global.js 2', Manager);

    // Resolve
    return resolve();
  });
}
