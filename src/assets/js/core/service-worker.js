// Service Worker Core Library
module.exports = function() {
  // Cache visited pages
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    const currentPage = window.location.pathname;
    const channel = new MessageChannel();

    channel.port1.onmessage = (event) => {
      if (event.data.status === 'success') {
        console.log('Page cached for offline use:', currentPage);
      }
    };

    // Log the caching action
    // console.log(`Caching page for offline use: ${currentPage}`);

    // Send message to service worker to cache the current page
    navigator.serviceWorker.controller.postMessage({
      command: 'update-cache',
      payload: { pages: [currentPage] }
    }, [channel.port2]);
  } else {
    console.warn('Service Worker not available or not controlled by a Service Worker.');
  }
};
