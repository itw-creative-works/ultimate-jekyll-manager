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
// Manager.prototype.initialize = function (callback) {
//   const self = this;

//   // Initiate the web manager
//   self.webManager = new WebManager();

//   // Initialize
//   self.webManager.init(window.Configuration, callback);

//   // Return
//   return self.webManager;
// };
Manager.prototype.initialize = function () {
  const self = this;

  return new Promise(function(resolve, reject) {
    // Initiate the web manager
    self.webManager = new WebManager();

    // Initialize
    self.webManager.init(window.Configuration, () => {
      // // Parse URL
      // const url = new URL(window.location.href);

      // // Get script name
      // console.log('---url', url);

      // // Log
      // console.log('WebManager initialized');
      // console.log('script', __dirname + '/pages' + url.pathname + '/index.js');

      // // Import any default page script
      // console.log('-----AAA');
      // import(__dirname + '/pages' + url.pathname + '/index.js');
      // console.log('-----BBB');
      var page = document.body.dataset.pagePath;

      import(/* webpackChunkName: "pages/[request]" */ './pages/' + page + '.js')
        .then(function (module) {
          if (module && typeof module.default === 'function') {
            module.default()
          }
        })
        .catch(function (err) {
          console.error('Failed to load page script:', err)
        })


      // Resolve
      return resolve(self.webManager);
    });
  });
};

// Export
module.exports = Manager;
