// Libraries
import { Manager as WebManager } from 'web-manager';

// Manager Class
class Manager {
  constructor() {
    // Set properties
    this.webManager = null;
  }

  // Initialize
  async initialize() {
    try {
      // Log the page URL
      /* @dev-only:start */
      {
        console.log(`Initializing page:`, window.location.href);
      }
      /* @dev-only:end */

      // Initiate the web manager
      this.webManager = new WebManager();

      // Initialize
      await this.webManager.initialize(window.Configuration);

      // Get the page path
      // MUST BE SANITIZED HERE (FOR SOME REASON) because webpack wont import if page has leading slashes and it CANNOT be sanitized later
      const pagePath = document.documentElement.dataset.pagePath.replace(/^\/+/, '')

      // Check for override asset path (includes filename), otherwise use normal page path
      // MUST BE SANITIZED HERE (FOR SOME REASON) because webpack wont import if page has leading slashes and it CANNOT be sanitized later
      const overrideAssetPath = document.documentElement.dataset.assetPath.replace(/^\/+/, '');

      // Build module path
      const pageModulePath = overrideAssetPath
        ? `${overrideAssetPath}.js`
        : (pagePath ? `${pagePath}/index.js` : 'index.js');

      const pageModulePathFull = `assets/js/pages/${pageModulePath}`;

      // Module options
      const options = {
        paths: {
          pagePath: `/${pagePath}`,
        },
      };

      // Initialize modules
      const modules = [];

      // All module loading promises
      const modulePromises = [];

      /* @dev-only:start */
      // Initialize development features
      modulePromises.push(
        import('__main_assets__/js/libs/dev.js')
          .then(mod => mod.default(this, options))
          .catch(e => console.error('Failed to load dev.js:', e))
      );
      /* @dev-only:end */

      // Load global script
      modulePromises.push(
        import('__main_assets__/js/ultimate-jekyll-manager.js')
          .then(mod => mod.default(this, options))
          .catch(e => console.error('Failed to load ultimate-jekyll-manager.js:', e))
      );

      /* @dev-only:start */
      {
        console.log(`Page-specific module loading: #main/${pageModulePathFull}`);
        console.log(`Page-specific module loading: #project/${pageModulePathFull}`);
      }
      /* @dev-only:end */

      // Load page-specific scripts
      modulePromises.push(
        // Import the main page-specific script
        import(`__main_assets__/js/pages/${pageModulePath}`)
          .then(mod => {
            modules[0] = { tag: 'main', default: mod?.default };
          })
          .catch(e => {
            if (this.isNotFound(e, pageModulePath)) {
              console.warn(`Page-specific module missing: #main/${pageModulePathFull}`);
            } else {
              console.error(`Page-specific module error: #main/${pageModulePathFull}`, e);
            }
          })
      );

      modulePromises.push(
        // Import the project page-specific script
        import(`__project_assets__/js/pages/${pageModulePath}`)
          .then(mod => {
            modules[1] = { tag: 'project', default: mod?.default };
          })
          .catch(e => {
            if (this.isNotFound(e, pageModulePath)) {
              console.warn(`Page-specific module missing: #project/${pageModulePathFull}`);
            } else {
              console.error(`Page-specific module error: #project/${pageModulePathFull}`, e);
            }
          })
      );

      // Wait for all modules to load
      await Promise.all(modulePromises);

      // Execute page-specific modules
      for (const mod of modules) {
        // Skip if module wasn't found
        if (!mod?.default) {
          continue;
        }

        // Execute the module function
        try {
          /* @dev-only:start */
          console.log(`Page-specific module loaded: #${mod.tag}/${pageModulePathFull}`);
          /* @dev-only:end */

          await mod.default(this, options);
        } catch (e) {
          console.error(`Page-specific module error: #${mod.tag}/${pageModulePathFull}`, e);
          break; // Stop execution if any module fails
        }
      }

      return this;
    } catch (error) {
      console.error('Manager initialization failed:', error);
      throw error;
    }
  }

  // Helper method to check if error is module not found
  isNotFound(e, filename) {
    return e.code === 'MODULE_NOT_FOUND' && e.message.includes(filename);
  }
}

// Export
export default Manager;
