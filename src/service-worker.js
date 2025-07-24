// Libraries
const serviceWorker = self;

// Class
function Manager() {
  const self = this;

  // Properties
  self.serviceWorker = null;

  // Defaults
  self.config = {};
  self.app = 'default';
  self.environment = 'production';
  self.libraries = {
    firebase: false,
    messaging: false,
    promoServer: false,
    cachePolyfill: false,
  };
  self.cache = {
    breaker: '',
    name: ''
  };

  // Return
  return self;
}

// Initialize
Manager.prototype.initialize = function () {
  const self = this;

  return new Promise(function(resolve, reject) {
    // Properties
    self.serviceWorker = serviceWorker;

    // Parse config file
    self.parseConfiguration();

    // Setup listeners
    self.setupListeners();

    // Import firebase
    self.importFirebase();

    // Update cache
    self.updateCache();

    // Log
    console.log('Initialized!', serviceWorker.location.pathname, serviceWorker);

    // Return
    return resolve(serviceWorker);
  });
};

// ['log', 'error', 'warn', 'info', 'debug'].forEach(method => {
//   Manager.prototype[method] = function() {
//     // Get arguments
//     const time = new Date().toLocaleTimeString('en-US', {
//       hour12: false,
//       hour: '2-digit',
//       minute: '2-digit',
//       second: '2-digit'
//     });

//     // Add prefix
//     const args = [`[${time}] service-worker:`, ...Array.from(arguments)];

//     // Call the original console method
//     console[method].apply(console, args);
//   };
// });

// Parse configuration
Manager.prototype.parseConfiguration = function () {
  const self = this;

  try {
    const params = new URLSearchParams(serviceWorker.location.search);
    self.config = JSON.parse(params.get('config'));

    // Fix config defaults
    self.environment = self.config.environment;
    self.app = self.config.id || 'default';
    self.cache.breaker = self.config.cb;
    self.cache.name = self.app + '-' + self.cache.breaker;

    // Log
    console.log('Parsed configuration', self.config);
  } catch (e) {
    console.error('Error parsing configuration', e);
  }
}

// Setup listeners
Manager.prototype.setupListeners = function () {
  const self = this;

  // Force service worker to use the latest version
  serviceWorker.addEventListener('install', (event) => {
    event.waitUntil(serviceWorker.skipWaiting());
  });

  serviceWorker.addEventListener('activate', (event) => {
    event.waitUntil(serviceWorker.clients.claim());
  });

  // Handle clicks on notifications
  // Open the URL of the notification
  // ⚠️⚠️⚠️ THIS MUST BE PLACED BEFORE THE FIREBASE IMPORTS HANDLER ⚠️⚠️⚠️
  // https://stackoverflow.com/questions/78270541/cant-catch-fcm-notificationclick-event-in-service-worker-using-firebase-messa
  serviceWorker.addEventListener('notificationclick', (event) => {
    // Get the properties of the notification
    const notification = event.notification;
    const data = (notification.data && notification.data.FCM_MSG ? notification.data.FCM_MSG.data : null) || {};
    const payload = (notification.data && notification.data.FCM_MSG ? notification.data.FCM_MSG.notification : null) || {};

    // Get the click action
    const clickAction = payload.click_action || data.click_action || '/';

    // Log
    console.log('notificationclick event', event);
    console.log('notificationclick data', data);
    console.log('notificationclick payload', payload);
    console.log('notificationclick clickAction', clickAction);

    // Handle the click
    event.waitUntil(
      clients.openWindow(clickAction)
    );

    // Close the notification
    notification.close();
  });

  // Send messages: https://stackoverflow.com/questions/35725594/how-do-i-pass-data-like-a-user-id-to-a-web-worker-for-fetching-additional-push
  // more messaging: http://craig-russell.co.uk/2016/01/29/service-worker-messaging.html#.XSKpRZNKiL8
  serviceWorker.addEventListener('message', (event) => {
    // Get the data
    const data = event.data || {};

    // Parse the data
    const command = data.command || '';
    const payload = data.payload || {};

    // Quit if no command
    if (!command) return;

    // Log
    console.log('message', command, payload, event);

    // Handle commands
    if (command === 'update-cache') {
      const pages = payload.pages || [];
      self.updateCache(pages)
        .then(() => {
          event.ports[0]?.postMessage({ status: 'success' });
        })
        .catch(error => {
          event.ports[0]?.postMessage({ status: 'error', error: error.message });
        });
    }
  });

  // Log
  console.log('Set up listeners');
}

Manager.prototype.importFirebase = function () {
  const self = this;

  // Log
  console.log('Importing Firebase libraries v%%% firebaseVersion %%%');

  // Import Firebase libraries
  importScripts(
    'https://www.gstatic.com/firebasejs/%%% firebaseVersion %%%/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/%%% firebaseVersion %%%/firebase-messaging-compat.js',
    // 'https://www.gstatic.com/firebasejs/%%% firebaseVersion %%%/firebase-database-compat.js',
    // 'https://www.gstatic.com/firebasejs/%%% firebaseVersion %%%/firebase-firestore-compat.js',
  );

  // Initialize app
  const app = firebase.initializeApp(self.config.firebase);

  // Initialize messaging
  self.libraries.messaging = firebase.messaging();

  // Attach firebase to SWManager
  self.libraries.firebase = firebase;
}

Manager.prototype.updateCache = function (pages) {
  const self = this;

  // Set default pages to cache
  const defaults = [
    '/',
    '/assets/css/main.bundle.css',
    '/assets/js/main.bundle.js',
  ];

  // Ensure pages is an array
  pages = pages || [];

  // Merge with additional pages
  const pagesToCache = [...new Set([...defaults, ...pages])];

  // Open cache and add pages
  return caches.open(self.cache.name)
    .then(cache => cache.addAll(pagesToCache))
    .then(() => console.log('Cached resources:', pagesToCache))
    .catch(error => console.error('Failed to cache resources:', error));
}

// Export
module.exports = Manager;
