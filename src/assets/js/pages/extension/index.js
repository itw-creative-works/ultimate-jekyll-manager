/**
 * Extension Page JavaScript
 */

// Libraries
let webManager = null;

// Module
export default (Manager) => {
  return new Promise(async function (resolve) {
    // Shortcuts
    webManager = Manager.webManager;

    // Initialize when DOM is ready
    await webManager.dom().ready();

    setupBrowserDetection();
    setupInstallTracking();

    // Expose test function globally
    window.triggerExtensionInstall = triggerInstall;

    /* @dev-only:start */
    // {
    //   window.triggerExtensionInstall('chrome');
    // }
    /* @dev-only:end */

    // Resolve after initialization
    return resolve();
  });
};

// Configuration
const config = {
  selectors: {
    browserButtons: '.browser-btn',
    browserPanes: '[data-browser]',
    installButtons: '.tab-pane[data-browser] .btn-primary',
  },
};

// Browser detection mapping
const browserMap = {
  chrome: /chrome|chromium|crios/i,
  firefox: /firefox|fxios/i,
  safari: /safari/i,
  edge: /edg/i,
  opera: /opera|opr/i,
};

// Setup browser detection and auto-select
function setupBrowserDetection() {
  const detectedBrowser = detectBrowser();
  console.log('Detected browser:', detectedBrowser);

  // Show loading state initially, then switch to detected browser
  setTimeout(() => {
    // Activate the detected browser tab using Bootstrap's tab API
    const $detectedTab = document.querySelector(`#${detectedBrowser}-tab`);
    if ($detectedTab) {
      const tab = new bootstrap.Tab($detectedTab);
      tab.show();
    }
  }, 800);
}

// Detect user's browser from user agent
function detectBrowser() {
  const userAgent = navigator.userAgent;

  // Edge must be checked before Chrome (Edge includes "Chrome" in UA)
  if (browserMap.edge.test(userAgent)) {
    return 'edge';
  }

  // Opera must be checked before Chrome (Opera includes "Chrome" in UA)
  if (browserMap.opera.test(userAgent)) {
    return 'opera';
  }

  // Chrome
  if (browserMap.chrome.test(userAgent)) {
    return 'chrome';
  }

  // Firefox
  if (browserMap.firefox.test(userAgent)) {
    return 'firefox';
  }

  // Safari must be checked last (Chrome and other browsers include "Safari" in UA)
  if (browserMap.safari.test(userAgent) && !browserMap.chrome.test(userAgent)) {
    return 'safari';
  }

  // Default to Chrome
  return 'chrome';
}

// Setup install button tracking
function setupInstallTracking() {
  const $installButtons = document.querySelectorAll(config.selectors.installButtons);

  $installButtons.forEach($button => {
    $button.addEventListener('click', function() {
      const $browserPane = this.closest('[data-browser]');
      const browserId = $browserPane ? $browserPane.dataset.browser : 'unknown';
      const installUrl = this.getAttribute('href');

      trackInstallClick(browserId, installUrl);
    });
  });
}

// Tracking function
function trackInstallClick(browser, installUrl) {
  console.log('Extension install clicked:', browser, installUrl);

  gtag('event', 'extension_install', {
    browser: browser,
    install_url: installUrl,
  });

  fbq('trackCustom', 'ExtensionInstall', {
    content_name: `${browser} extension`,
    content_category: browser,
    content_type: 'extension',
  });

  ttq.track('Download', {
    content_id: `extension-${browser}`,
    content_type: 'product',
    content_name: `${browser} extension`,
  });
}

// Trigger install for testing (simulates clicking the install button)
function triggerInstall(browser) {
  const browserId = browser || detectBrowser();
  const $button = document.querySelector(`.tab-pane[data-browser="${browserId}"] .btn-primary`);

  if (!$button) {
    console.error(`No install button found for browser: ${browserId}`);
    return;
  }

  const installUrl = $button.getAttribute('href');

  if (!installUrl) {
    console.error(`No install URL configured for browser: ${browserId}`);
    return;
  }

  // Track the click
  trackInstallClick(browserId, installUrl);

  // Open the extension store in a new tab
  window.open(installUrl, '_blank');
}