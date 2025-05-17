// Libraries
const WebManager = require('web-manager');

// Class
function Manager() {
  const self = this;

  // Set properties
  self.webManager = null;

  // Return
  return self;
}

// Initialize
// Manager.prototype.initialize = function (callback) {
//   const self = this;

//   // Initiate the web manager
//   self.webManager = new WebManager();

//   // Initialize
//   self.webManager.init(window.Configuration, callback);

//   // Return
//   return self.webManager;
// };
Manager.prototype.initialize = function () {
  const self = this;

  return new Promise(function(resolve, reject) {
    // Initiate the web manager
    const webManager = new WebManager();
    self.webManager = webManager;

    // Initialize
    webManager.init(window.Configuration, () => {
      // Get the page path (MUST BE SANITIZED because webpack wont import if page has leading slashes)
      const page = document.documentElement.dataset.pagePath.replace(/^\/+/, '');
      const pagePath = !page ? 'index.js' : `${page}/index.js`;

      // Initialize modules
      const modules = [];

      /* @dev-only:start */
      {
        // Main log
        webManager.log('⚠️ Enabling development mode features...');

        // Add development click handler
        document.addEventListener('click', function (event) {
          webManager.log('Click', event.target);
        });

        // Log page script path
        webManager.log('Loading page script:', `assets/js/pages/${pagePath}`);
      }
      /* @dev-only:end */

      // Require global script
      require('__main_assets__/js/ultimate-jekyll-manager.js')(Manager);

      // Load page-specific scripts
      Promise.all([
        // Import the main page-specific script
        import(`__main_assets__/js/pages/${pagePath}`)
          .then((mod) => {
            modules[0] = { tag: 'main', default: mod && mod.default };
          })
          .catch((e) => {
            if (e.message && e.message.includes('Cannot find module')) {
              console.warn('Framework page module not found:', page);
            } else {
              console.error('Error loading framework module:', e);
            }
          }),

        // Import the project page-specific script
        import(`__project_assets__/js/pages/${pagePath}`)
          .then((mod) => {
            modules[1] = { tag: 'project', default: mod && mod.default };
          })
          .catch((e) => {
            if (e.message && e.message.includes('Cannot find module')) {
              console.warn('Project page module not found:', page);
            } else {
              console.error('Error loading project module:', e);
            }
          })
      ])
      .then(async () => {
        for (let i = 0; i < modules.length; i++) {
          const mod = modules[i];

          // Check if the module has a valid function
          if (typeof mod?.default !== 'function') {
            continue;
          }

          // Execute the module function
          try {
            await mod.default(Manager);
          } catch (err) {
            console.error(`Error during execution of ${mod.tag} module:`, err);
            break; // Stop execution if any module fails
          }
        }
      });

      // Resolve
      return resolve(self);
    });
  });
};

// Export
module.exports = Manager;
