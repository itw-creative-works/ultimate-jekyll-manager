// Module
module.exports = (Manager, options) => {
  return new Promise(function(resolve, reject) {
    // Shortcuts
    const { webManager } = Manager;

    // Log
    console.log('Global module loaded successfully (assets/js/ultimate-jekyll-manager.js)');

    // Cache visited pages for offline use
    require('./core/service-worker.js')(Manager, options);

    // Setup authentication listener
    require('./core/auth.js')(Manager, options);

    // Import the theme from src/assets/themes/{ id }
    require('__theme__/_theme.js');

    // Resolve
    return resolve();
  });
}
