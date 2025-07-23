// Module
module.exports = (Manager) => {
  return new Promise(function(resolve, reject) {
    // Shortcuts
    const { webManager } = Manager;

    // Log
    console.log('Global module loaded successfully (assets/js/ultimate-jekyll-manager.js)');

    // Import the theme from src/assets/themes/{ id }
    require('__theme__/_theme.js');

    // Resolve
    return resolve();
  });
}
