// Load Manager
const Manager = new (require('ultimate-jekyll-manager/service-worker'))();

// Initialize
Manager.initialize()
.then(() => {
  Manager.log('Initialized');
});

