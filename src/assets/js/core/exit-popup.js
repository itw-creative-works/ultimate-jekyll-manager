// Exit Popup Module
export default function (Manager, options) {
  // Shortcuts
  const { webManager } = Manager;

  // Get config
  const config = webManager.config.exitPopup.config;

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
    // Setup mouse leave detection without needing the element yet
    setupMouseLeaveDetection();
  });

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

  function setupMouseLeaveDetection() {
    // Detect when mouse leaves document
    document.addEventListener('mouseleave', (e) => {
      /* @dev-only:start */
      // {
      //   console.log('Mouse leave detected:', shouldShow, e.clientY);
      // }
      /* @dev-only:end */

      // Only trigger if:
      // 1. We should show the popup (based on timing/session)
      // 2. Mouse is leaving from the top (Y <= 0 means exiting from top)
      if (shouldShow && e.clientY <= 0) {
        showExitPopup();
      }
    });
  }

  function showExitPopup() {
    /* @dev-only:start */
    {
      console.log('Showing exit popup:', config.title, 'after', timeSinceLastShown, 'ms since last shown');
    }
    /* @dev-only:end */

    // Mark as shown for this session
    shouldShow = false;

    // Store timestamp in storage
    webManager.storage().set(STORAGE_KEY, Date.now());

    // Find the modal element only when needed
    const $modalElement = document.getElementById('modal-exit-popup');
    if (!$modalElement) {
      webManager.sentry().captureException(new Error('Exit popup modal element not found'));
      return;
    }

    // Update modal content with config
    updateModalContent($modalElement);

    // Check if Bootstrap is available
    if (!window.bootstrap || !window.bootstrap.Modal) {
      webManager.sentry().captureException(new Error('Bootstrap Modal not available for exit popup'));
      return;
    }

    // Initialize Bootstrap modal instance only when needed
    let modal;
    try {
      modal = new window.bootstrap.Modal($modalElement);
    } catch (error) {
      webManager.sentry().captureException(new Error('Error initializing Bootstrap modal for exit popup', { cause: error }));
      return;
    }

    // Show the modal using Bootstrap
    try {
      modal.show();

      // Track exit popup shown
      trackExitPopupShown();

      // Track button clicks on the exit popup
      const $button = $modalElement.querySelector('.modal-footer .btn');
      if ($button && !$button.hasAttribute('data-exit-popup-tracked')) {
        $button.setAttribute('data-exit-popup-tracked', 'true');
        $button.addEventListener('click', () => {
          trackExitPopupClick();
        });
      }

      // Track modal dismiss
      $modalElement.addEventListener('hidden.bs.modal', () => {
        trackExitPopupDismissed();
      }, { once: true });
    } catch (error) {
      webManager.sentry().captureException(new Error('Error showing exit popup', { cause: error }));
    }
  }

  // Tracking functions
  function trackExitPopupShown() {
    gtag('event', 'exit_popup_shown', {
      event_category: 'engagement',
      event_label: config.title,
      page_path: window.location.pathname
    });

    fbq('trackCustom', 'ExitPopupShown', {
      content_name: config.title,
      page_path: window.location.pathname
    });

    ttq.track('ViewContent', {
      content_name: 'Exit Popup',
      content_type: config.title
    });
  }

  function trackExitPopupClick() {
    gtag('event', 'exit_popup_click', {
      event_category: 'engagement',
      event_label: config.okButton?.text || 'OK',
      destination_url: config.okButton?.link
    });

    fbq('track', 'Lead', {
      content_name: 'Exit Popup Click',
      content_category: config.title
    });

    ttq.track('ClickButton', {
      content_name: 'Exit Popup CTA',
      content_type: config.okButton?.text || 'OK'
    });
  }

  function trackExitPopupDismissed() {
    gtag('event', 'exit_popup_dismissed', {
      event_category: 'engagement',
      event_label: config.title
    });

    fbq('trackCustom', 'ExitPopupDismissed', {
      content_name: config.title
    });

    ttq.track('ViewContent', {
      content_name: 'Exit Popup Dismissed',
      content_type: config.title
    });
  }
};
