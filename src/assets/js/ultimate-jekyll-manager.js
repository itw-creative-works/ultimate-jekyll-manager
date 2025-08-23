// Module
module.exports = (Manager, options) => {
  return new Promise(function(resolve, reject) {
    // Shortcuts
    const { webManager } = Manager;

    // Log
    console.log('Global module loaded successfully (assets/js/ultimate-jekyll-manager.js)');

    // Setup page loader (removes loading state)
    require('./core/page-loader.js')(Manager, options);

    // Setup authentication listener
    require('./core/auth.js')(Manager, options);

    // Setup chatsy button
    require('./core/chatsy.js')(Manager, options);

    // Setup cookie consent
    require('./core/cookieconsent.js')(Manager, options);

    // Setup exit popup
    require('./core/exit-popup.js')(Manager, options);

    // Setup lazy loading
    require('./core/lazy-loading.js')(Manager, options);

    // Query string handler
    require('./core/query-strings.js')(Manager, options);

    // Setup social sharing
    require('./core/social-sharing.js')(Manager, options);

    // Cache visited pages for offline use
    require('./core/service-worker.js')(Manager, options);

    // Import the theme from src/assets/themes/{ id }
    require('__theme__/_theme.js');

    // Resolve
    return resolve();
  });
}
