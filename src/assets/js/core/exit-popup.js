// Exit Popup Module
export default function (Manager, options) {
  // Shortcuts
  const { webManager } = Manager;

  // Get config
  const config = webManager.config.exitPopup.config;

  // Storage key for tracking last shown time
  const STORAGE_KEY = 'exitPopup.timestamp';

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

  // Make this available on window object in DEV mode for testing
  /* @dev-only:start */
  {
    window.showExitPopup = showExitPopup;
  }
  /* @dev-only:end */

  function updateModalContent($modal) {
    // Update title
    const $title = $modal.querySelector('.modal-exit-title');
    if ($title && config.title) {
      $title.textContent = config.title;
    }

    // Update main message
    const $message = $modal.querySelector('.modal-exit-message');
    if ($message && config.message) {
      $message.textContent = config.message;
    }

    // Update offer title
    const $offerTitleText = $modal.querySelector('.modal-exit-offer-title-text');
    if ($offerTitleText && config.offerTitle) {
      $offerTitleText.textContent = config.offerTitle;
    }

    // Update offer description
    const $offerDesc = $modal.querySelector('.modal-exit-offer-description');
    if ($offerDesc && config.offerDescription) {
      $offerDesc.textContent = config.offerDescription;
    }

    // Update main button
    const $button = $modal.querySelector('.modal-exit-button');
    const $buttonText = $modal.querySelector('.modal-exit-button-text');
    if ($button && config.okButton) {
      if ($buttonText && config.okButton.text) {
        $buttonText.textContent = config.okButton.text;
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

    // Update "Maybe later" link text if configured
    const $dismissLink = $modal.querySelector('.modal-exit-dismiss');
    if ($dismissLink && config.dismissText) {
      $dismissLink.textContent = config.dismissText;
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

      // Add fade class after modal is shown to avoid conflicts with animation-slide-up
      $modalElement.addEventListener('shown.bs.modal', () => {
        $modalElement.classList.add('fade');
      }, { once: true });

      // Track exit popup shown
      trackExitPopupShown();

      // Track button clicks on the exit popup (main CTA button)
      const $button = $modalElement.querySelector('.modal-exit-button');
      if ($button && !$button.hasAttribute('data-exit-popup-tracked')) {
        $button.setAttribute('data-exit-popup-tracked', 'true');
        $button.addEventListener('click', () => {
          trackExitPopupClick();
        });
      }

      // Remove focus from any focused element before hiding to prevent aria-hidden warning
      $modalElement.addEventListener('hide.bs.modal', () => {
        if (document.activeElement && $modalElement.contains(document.activeElement)) {
          document.activeElement.blur();
        }
      }, { once: true });

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
