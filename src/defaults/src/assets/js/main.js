// Import Ultimate Jekyll Manager
const Manager = new (require('ultimate-jekyll-manager'));

// Initialize
Manager.initialize()
.then(() => {
  // Shortcuts
  const { webManager } = Manager;

  // Log
  webManager.log('Ultimate Jekyll Manager initialized successfully');

  // Custom code
  // ...
});

