// Ultimate Jekyll Manager Module
export default async function(Manager, options) {
  // Shortcuts
  const { webManager } = Manager;

  // Log
  console.log('Global module loaded successfully (assets/js/ultimate-jekyll-manager.js)');

  // Core modules to always load
  const fixedModules = [
    'page-loader.js',
    'auth.js',
    'lazy-loading.js',
    'query-strings.js',
    'service-worker.js'
  ];

  // Conditionally loaded modules based on config
  const conditionalModules = [
    { path: 'chatsy.js', configKey: 'chatsy' },
    { path: 'cookieconsent.js', configKey: 'cookieConsent' },
    { path: 'exit-popup.js', configKey: 'exitPopup' },
    { path: 'social-sharing.js', configKey: 'socialSharing' }
  ];

  // Load all modules in parallel
  const modulePromises = [];

  // Add fixed modules
  for (const modulePath of fixedModules) {
    modulePromises.push(
      import(`__main_assets__/js/core/${modulePath}`)
        .then(({ default: moduleFunc }) => moduleFunc(Manager, options))
        .catch(error => console.error(`Failed to load ${modulePath}:`, error))
    );
  }

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

  // Add theme loading
  modulePromises.push(
    import('__theme__/_theme.js')
      .catch(error => console.error('Failed to load theme:', error))
  );

  // Wait for all modules to load
  await Promise.all(modulePromises);
}
