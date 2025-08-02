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
Manager.prototype.initialize = function () {
  const self = this;

  return new Promise(function(resolve, reject) {
    // Initiate the web manager
    // self.webManager = WebManager;
    self.webManager = new WebManager.Manager();

    // Initialize
    self.webManager.initialize(window.Configuration)
    .then(() => {
      // Get the page path (MUST BE SANITIZED because webpack wont import if page has leading slashes)
      const pagePath = document.documentElement.dataset.pagePath.replace(/^\/+/, '');
      const pageModulePath = pagePath
        ? `${pagePath}/index.js`
        : 'index.js';
      const pageModulePathFull = `assets/js/pages/${pageModulePath}`;

      // Module options
      const options = {
        paths: {
          pagePath: `/${pagePath}`,
          // pageModulePath: `/${pageModulePath}`,
          // pageModulePathFull: `/${pageModulePathFull}`,
        },
      }

      // Initialize modules
      const modules = [];

      /* @dev-only:start */
      {
        // Initialize development features
        const initDev = require('__main_assets__/js/libs/dev.js');
        initDev(self, options);
      }
      /* @dev-only:end */

      // Require global script
      require('__main_assets__/js/ultimate-jekyll-manager.js')(self, options);

      /* @dev-only:start */
      console.log(`Page module loading (${pageModulePathFull})`);
      /* @dev-only:end */

      // Load page-specific scripts
      Promise.all([
        // Import the main page-specific script
        import(`__main_assets__/js/pages/${pageModulePath}`)
          .then((mod) => {
            modules[0] = { tag: 'main', default: mod && mod.default };
          })
          .catch((e) => {
            if (isNotFound(e, pageModulePath)) {
              console.warn(`Page module #main not found (${pageModulePathFull})`);
            } else {
              console.error(`Page module #main error (${pageModulePathFull})`, e);
            }
          }),

        // Import the project page-specific script
        import(`__project_assets__/js/pages/${pageModulePath}`)
          .then((mod) => {
            modules[1] = { tag: 'project', default: mod && mod.default };
          })
          .catch((e) => {
            if (isNotFound(e, pageModulePath)) {
              console.warn(`Project module #project not found (${pageModulePathFull})`);
            } else {
              console.error(`Project module #project error (${pageModulePathFull})`, e);
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
            // Log page script path
            /* @dev-only:start */
            console.log(`Page module #${mod.tag} loaded (${pageModulePathFull})`);
            /* @dev-only:end */

            await mod.default(self, options);
          } catch (e) {
            console.error(`Page module #${mod.tag} error (${pageModulePathFull})`, e);
            break; // Stop execution if any module fails
          }
        }
      });

      // Resolve
      return resolve(self);
    });
  });
};

function isNotFound(e, filename) {
  return e.code === 'MODULE_NOT_FOUND' && e.message.includes(filename);
}

// Export
module.exports = Manager;
