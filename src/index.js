// Libraries
import webManager from 'web-manager';
import { attachTo as attachModeHelpers } from './utils/mode-helpers.js';

// Manager Class
class Manager {
  constructor() {
    // Set properties
    this.webManager = webManager;
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
          .then(mod => mod.default({ manager: this, options }))
          .catch(e => console.error('Failed to load dev.js:', e))
      );
      /* @dev-only:end */

      // Load global script
      modulePromises.push(
        import('__main_assets__/js/ultimate-jekyll-manager.js')
          .then(mod => mod.default({ manager: this, options }))
          .catch(e => console.error('Failed to load ultimate-jekyll-manager.js:', e))
      );

      // Theme page module path (resolved via the __theme__ webpack alias)
      const themeModulePathFull = `__theme__/pages/${pageModulePath}`;

      console.log(`Page-specific module loading: #main/${pageModulePathFull}`);
      console.log(`Page-specific module loading: #theme/${themeModulePathFull}`);
      console.log(`Page-specific module loading: #project/${pageModulePathFull}`);

      // Load page-specific scripts.
      // Three layers, executed in order: #main (framework default) → #theme
      // (active theme) → #project (consumer). Mirrors the page-CSS cascade.
      // A missing module at any layer is a no-op — no fallback needed.
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
        // Import the active theme's page-specific script.
        // webpackInclude restricts the dynamic-import context to .js files — the
        // theme's pages/ dir also contains page CSS (.scss), which must NOT be
        // pulled into the JS context (webpack would try to parse it as JS).
        import(/* webpackInclude: /\.js$/ */ `__theme__/pages/${pageModulePath}`)
          .then(mod => {
            modules[1] = { tag: 'theme', default: mod?.default };
          })
          .catch(e => {
            if (this.isNotFound(e, pageModulePath)) {
              console.warn(`Page-specific module missing: #theme/${themeModulePathFull}`);
            } else {
              console.error(`Page-specific module error: #theme/${themeModulePathFull}`, e);
            }
          })
      );

      modulePromises.push(
        // Import the project page-specific script
        import(`__project_assets__/js/pages/${pageModulePath}`)
          .then(mod => {
            modules[2] = { tag: 'project', default: mod?.default };
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
        const modPathLabel = mod.tag === 'theme' ? themeModulePathFull : pageModulePathFull;
        try {
          console.log(`Page-specific module loaded: #${mod.tag}/${modPathLabel}`);

          await mod.default({ manager: this, options });
        } catch (e) {
          console.error(`Page-specific module error: #${mod.tag}/${modPathLabel}`, e);
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

// Mix in cross-context mode helpers (isDevelopment/isProduction/isTesting/getVersion).
attachModeHelpers(Manager);

// Export
export default Manager;
