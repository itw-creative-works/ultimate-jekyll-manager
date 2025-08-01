// Libraries
// ...

// Module
export default (Manager, options) => {
  return new Promise(async function (resolve, reject) {
    // Shortcuts
    const { webManager } = Manager;

    // Get urls
    const url = new URL(window.location.href);
    const qs404Fixer = url.searchParams.get('404Fixer');

    // Get elements
    const $pageUrl = document.getElementById('page-url');

    // Update visible URL
    $pageUrl.innerText = window.location.href;

    // If pathname ends with trailing slash, remove it and reload
    if (url.pathname.match(/\/$/) && !qs404Fixer) {
      url.pathname = url.pathname.replace(/\/$/, '');
      url.searchParams.set('404Fixer', 'trailing-slash');

      // Log
      console.log(`Redirecting to ${url.toString()}`);

      // Redirect
      setTimeout(function () {
        window.location.href = url.toString();
      }, 1);
    }

    // Report to Google Analytics
    gtag('event', 'error', {
      code: 404,
      url: window.location.href,
    });

    // Report to Sentry
    webManager.sentry().captureException(new Error(`404 at ${window.location.href}`));

    // Resolve
    return resolve();
  });
}
