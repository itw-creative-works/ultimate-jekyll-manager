// Import Ultimate Jekyll Manager
const Manager = new (require('ultimate-jekyll-manager'));

// Initialize
Manager.initialize()
.then(() => {
  // Shortcuts
  const { webManager } = Manager;

  // Log
  console.log('Ultimate Jekyll Manager initialized successfully');

  // Custom code
  // ...
});

