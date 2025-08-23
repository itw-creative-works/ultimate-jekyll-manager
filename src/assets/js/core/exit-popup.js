// Exit Popup Module
module.exports = (Manager, options) => {
  // Shortcuts
  const { webManager } = Manager;

  // Get exit popup config
  const exitPopup = webManager.config.exitPopup || {};

  // Check if exit popup is enabled
  if (!exitPopup.enabled) {
    console.log('Exit popup is disabled');
    return;
  }

  // Get config
  const config = exitPopup.config;

  // Storage key for tracking last shown time
  const STORAGE_KEY = 'exitPopup.lastShown';

  // Check if we should show the popup based on timeout
  const lastShown = webManager.storage().get(STORAGE_KEY, 0);
  const now = Date.now();
  const timeSinceLastShown = now - lastShown;

  // Determine if we should show the popup
  let shouldShow = timeSinceLastShown >= config.timeout;

  // Wait for DOM to be ready
  webManager.dom().ready().then(() => {
    setupExitPopup();
  });

  function setupExitPopup() {
    // Find the modal element
    const $modalElement = document.getElementById('modal-exit-popup');
    if (!$modalElement) {
      console.warn('Exit popup modal element not found');
      return;
    }

    // Check if Bootstrap is available
    if (!window.bootstrap || !window.bootstrap.Modal) {
      console.warn('Bootstrap Modal not available, exit popup disabled');
      return;
    }

    // Initialize Bootstrap modal instance
    const modal = new window.bootstrap.Modal($modalElement);

    // Update modal content with config
    updateModalContent($modalElement);

    // Always setup mouse leave detection
    setupMouseLeaveDetection(modal);
  }

  function updateModalContent($modal) {
    // Update title
    const $title = $modal.querySelector('.modal-title');
    if ($title && config.title) {
      $title.textContent = config.title;
    }

    // Update message
    const $message = $modal.querySelector('.modal-body p');
    if ($message && config.message) {
      $message.textContent = config.message;
    }

    // Update button
    const $button = $modal.querySelector('.modal-footer .btn-primary');
    if ($button && config.okButton) {
      if (config.okButton.text) {
        $button.textContent = config.okButton.text;
      }
      if (config.okButton.link) {
        // Add UTM parameters to track exit popup conversions
        const url = new URL(config.okButton.link, window.location.origin);
        url.searchParams.set('utm_source', 'exit-popup');
        url.searchParams.set('utm_medium', 'popup');
        url.searchParams.set('utm_campaign', window.location.pathname);
        $button.href = url.toString();
      }
    }

    // Remove hidden attribute to make modal available
    $modal.removeAttribute('hidden');
  }

  function setupMouseLeaveDetection(modal) {
    // Detect when mouse leaves document
    document.addEventListener('mouseleave', (e) => {
      /* @dev-only:start */
      {
        console.log('Mouse leave detected:', shouldShow, e.clientY);
      }
      /* @dev-only:end */

      // Only trigger if:
      // 1. We should show the popup (based on timing/session)
      // 2. Mouse is leaving from the top (Y <= 0 means exiting from top)
      if (shouldShow && e.clientY <= 0) {
        showExitPopup(modal);
      }
    });
  }

  function showExitPopup(modal) {
    /* @dev-only:start */
    {
      console.log('Showing exit popup:', config.title, 'after', timeSinceLastShown, 'ms since last shown');
    }
    /* @dev-only:end */

    // Mark as shown for this session
    shouldShow = false;

    // Store timestamp in storage
    webManager.storage().set(STORAGE_KEY, Date.now());

    // If there's a custom handler, call it
    if (config.handler && typeof config.handler === 'function') {
      const result = config.handler();
      // If handler returns false, don't show the modal
      if (result === false) {
        return;
      }
    }

    // Show the modal using Bootstrap
    try {
      modal.show();

      // Track analytics event
      gtag('event', 'exit_popup_shown', {
        event_category: 'engagement',
        event_label: config.title
      });
    } catch (error) {
      console.error('Error showing exit popup:', error);
    }
  }
};
