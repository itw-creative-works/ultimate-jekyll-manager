// Static imports for core modules (bundled together for efficiency)
import initModule from '__main_assets__/js/core/init.js';
import authModule from '__main_assets__/js/core/auth.js';
import lazyLoadingModule from '__main_assets__/js/core/lazy-loading.js';
import queryStringsModule from '__main_assets__/js/core/query-strings.js';
import serviceWorkerModule from '__main_assets__/js/core/service-worker.js';

// Ultimate Jekyll Manager Module
export default async function (Manager, options) {
  // Shortcuts
  const { webManager } = Manager;

  // Add Manager to global scope for easy access in modules
  window.Manager = Manager;

  // Log
  console.log('Global module loaded successfully (assets/js/ultimate-jekyll-manager.js)');

  // Initialize fixed modules synchronously (already loaded via static imports)
  initModule(Manager, options);
  authModule(Manager, options);
  lazyLoadingModule(Manager, options);
  queryStringsModule(Manager, options);
  serviceWorkerModule(Manager, options);

  // Conditionally loaded modules based on config (keep as dynamic imports)
  const conditionalModules = [
    { path: 'chatsy.js', configKey: 'chatsy' },
    { path: 'cookieconsent.js', configKey: 'cookieConsent' },
    { path: 'exit-popup.js', configKey: 'exitPopup' },
    { path: 'social-sharing.js', configKey: 'socialSharing' }
  ];

  // Load conditional modules in parallel
  const modulePromises = [];

  // Add conditional modules if enabled
  for (const module of conditionalModules) {
    const moduleConfig = webManager.config[module.configKey];
    if (moduleConfig?.enabled) {
      modulePromises.push(
        import(`__main_assets__/js/core/${module.path}`)
          .then(({ default: moduleFunc }) => moduleFunc(Manager, options))
          .catch(error => console.error(`Failed to load ${module.path}:`, error))
      );
    } else {
      console.log(`Skipping ${module.path} (disabled in config)`);
    }
  }

  // Add theme loading (keep as dynamic import since themes can vary)
  modulePromises.push(
    import('__theme__/_theme.js')
      .catch(error => console.error('Failed to load theme:', error))
  );

  // Wait for all conditional modules to load
  await Promise.all(modulePromises);
}
