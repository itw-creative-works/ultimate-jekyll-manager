// Libraries
const serviceWorker = self;

// Import build config at the top level (synchronous)
importScripts('/build.js');

// ⚠️⚠️⚠️ CRITICAL: Setup global listeners BEFORE importing Firebase ⚠️⚠️⚠️
// https://stackoverflow.com/questions/78270541/cant-catch-fcm-notificationclick-event-in-service-worker-using-firebase-messa
setupGlobalHandlers();

// Import Firebase libraries at the top level (before any async operations)
// ⚠️ importScripts MUST be called at top-level (synchronously) - it cannot be called inside functions or after async operations
importScripts(
  'https://www.gstatic.com/firebasejs/%%% firebaseVersion %%%/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/%%% firebaseVersion %%%/firebase-messaging-compat.js',
  // 'https://www.gstatic.com/firebasejs/%%% firebaseVersion %%%/firebase-database-compat.js',
  // 'https://www.gstatic.com/firebasejs/%%% firebaseVersion %%%/firebase-firestore-compat.js',
);

// Manager Class
class Manager {
  constructor() {
    // Properties
    this.serviceWorker = null;

    // Load config
    this.config = serviceWorker.UJ_BUILD_JSON?.config || {};

    // Defaults
    this.app = this.config?.brand?.id || 'default';
    this.environment = this.config?.uj?.environment || 'production';
    this.cache = {
      breaker: this.config?.uj?.cache_breaker || new Date().getTime(),
    };
    this.cache.name = `${this.app}-${this.cache.breaker}`;

    // Libraries
    this.libraries = {
      firebase: false,
      messaging: false,
      promoServer: false,
    };
  }

  // Initialize
  async initialize() {
    // Properties
    this.serviceWorker = serviceWorker;

    // Setup instance-specific message handlers
    this.setupInstanceHandlers();

    // Initialize Firebase
    this.initializeFirebase();

    // Update cache
    this.updateCache();

    // Log
    console.log('Initialized!', serviceWorker.location.pathname, serviceWorker);
    console.log('Config loaded from UJ_BUILD_JSON:', this.config);

    // Return
    return serviceWorker;
  }

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

  // Setup instance-specific message handlers
  setupInstanceHandlers() {
    // Send messages: https://stackoverflow.com/questions/35725594/how-do-i-pass-data-like-a-user-id-to-a-web-worker-for-fetching-additional-push
    // more messaging: http://craig-russell.co.uk/2016/01/29/service-worker-messaging.html#.XSKpRZNKiL8
    serviceWorker.addEventListener('message', (event) => {
      // Get the data
      const data = event.data || {};

      // Parse the data
      const command = data.command || '';
      const payload = data.payload || {};

      // Quit if no command
      if (!command) {
        return;
      }

      // Log
      console.log('message', command, payload, event);

      // Handle commands
      if (command === 'update-cache') {
        const pages = payload.pages || [];
        this.updateCache(pages)
          .then(() => {
            event.ports[0]?.postMessage({ status: 'success' });
          })
          .catch(error => {
            event.ports[0]?.postMessage({ status: 'error', error: error.message });
          });
      }
    });

    // Log
    console.log('Set up message handlers');
  }

  // Setup Firebase init
  initializeFirebase() {
    // Get Firebase config
    const firebaseConfig = this.config?.web_manager?.firebase?.app?.config;

    // Check if Firebase config is available
    if (!firebaseConfig) {
      console.log('Firebase config not available yet, skipping Firebase initialization');
      return;
    }

    // Check if already initialized
    if (this.libraries.firebase) {
      console.log('Firebase already initialized');
      return;
    }

    // Log
    console.log('Initializing Firebase v%%% firebaseVersion %%%');

    // Initialize app (libraries were already imported at the top)
    firebase.initializeApp(firebaseConfig);

    // Initialize messaging
    this.libraries.messaging = firebase.messaging();

    // Attach firebase to SWManager
    this.libraries.firebase = firebase;
  }

  // Setup cache update
  updateCache(pages) {
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
    return caches.open(this.cache.name)
      .then(cache => cache.addAll(pagesToCache))
      .then(() => console.log('Cached resources:', pagesToCache))
      .catch(error => console.error('Failed to cache resources:', error));
  }
}

// Helper: Setup global listeners
// This is called at top-level before Firebase imports to ensure listeners are registered first
function setupGlobalHandlers() {
  // Force service worker to use the latest version
  serviceWorker.addEventListener('install', (event) => {
    serviceWorker.skipWaiting();
  });

  serviceWorker.addEventListener('activate', (event) => {
    event.waitUntil(serviceWorker.clients.claim());
  });

  // Handle clicks on notifications
  // ⚠️ MUST be registered before Firebase imports
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
}

// Export
module.exports = Manager;
