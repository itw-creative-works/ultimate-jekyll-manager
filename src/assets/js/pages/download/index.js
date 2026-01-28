/**
 * Download Page JavaScript
 */

// Libraries
import { FormManager } from '__main_assets__/js/libs/form-manager.js';
import fetch from 'wonderful-fetch';

let webManager = null;

// Module
export default (Manager) => {
  return new Promise(async function (resolve) {
    // Shortcuts
    webManager = Manager.webManager;

    // Initialize when DOM is ready
    await webManager.dom().ready();

    setupPlatformDetection();
    setupDownloadTracking();
    setupCopyButtons();
    setupMobileEmailForms();

    // Expose modal function globally for testing
    window.showDownloadModal = showOnboardingModal;

    /* @dev-only:start */
    // {
    //   window.showDownloadModal('mac');
    // }
    /* @dev-only:end */

    // Resolve after initialization
    return resolve();
  });
};

// Configuration
const config = {
  selectors: {
    platformButtons: '.platform-btn',
    platformDownloads: '[data-platform]',
    downloadButtons: '.tab-pane[data-platform] .btn-primary:not([type="submit"])',
  },
};

// Setup platform detection and auto-select
function setupPlatformDetection() {
  const detectedPlatform = webManager.utilities().getPlatform();
  console.log('Detected platform:', detectedPlatform);

  // Listen for tab changes to scroll to download card
  document.querySelectorAll(config.selectors.platformButtons).forEach($tab => {
    $tab.addEventListener('shown.bs.tab', (event) => {
      const platformId = event.target.id.replace('-tab', '');
      scrollToDownloadCard(platformId);
    });
  });

  // Activate the detected platform tab using Bootstrap's tab API
  const $detectedTab = document.querySelector(`#${detectedPlatform}-tab`);
  if (!$detectedTab) {
    return;
  }

  const tab = new bootstrap.Tab($detectedTab);
  tab.show();
}

// Scroll to the download card for a given platform
function scrollToDownloadCard(platformId) {
  const $downloadCard = document.querySelector(`#${platformId}-pane .card`);
  if (!$downloadCard) {
    return;
  }

  setTimeout(() => {
    $downloadCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
}

// Bootstrap's tab component handles all tab switching automatically via data-bs-toggle="tab"
// No manual switcher needed!

// Setup download button tracking
function setupDownloadTracking() {
  const $downloadButtons = document.querySelectorAll(config.selectors.downloadButtons);

  $downloadButtons.forEach($button => {
    $button.addEventListener('click', function() {
      const $platformPane = this.closest('[data-platform]');
      const platformId = $platformPane ? $platformPane.dataset.platform : 'unknown';
      const downloadName = this.textContent.trim();
      const downloadUrl = this.getAttribute('href');

      trackDownloadClick(platformId, downloadName, downloadUrl);
      showOnboardingModal(platformId);
    });
  });
}

// Show onboarding modal with platform-specific instructions
function showOnboardingModal(platform) {
  const $modal = document.getElementById('onboardingModal');
  if (!$modal) {
    console.error('Onboarding modal not found in DOM');
    return;
  }

  const $platformInstructions = $modal.querySelectorAll('.platform-instructions');
  $platformInstructions.forEach($el => {
    if ($el.dataset.platform === platform) {
      $el.removeAttribute('hidden');
    } else {
      $el.setAttribute('hidden', '');
    }
  });

  const modal = new bootstrap.Modal($modal);
  modal.show();
}

// Tracking functions
function trackDownloadClick(platform, downloadName, downloadUrl) {
  console.log('Download clicked:', platform, downloadName, downloadUrl);

  gtag('event', 'download', {
    platform: platform,
    download_name: downloadName,
    download_url: downloadUrl
  });

  fbq('trackCustom', 'Download', {
    content_name: downloadName,
    content_category: platform,
    content_type: 'download'
  });

  ttq.track('Download', {
    content_name: downloadName,
    content_type: platform
  });
}

// Setup copy command buttons
function setupCopyButtons() {
  const $copyButtons = document.querySelectorAll('.copy-command-btn');

  $copyButtons.forEach($button => {
    $button.addEventListener('click', async function() {
      const $input = this.closest('.input-group').querySelector('input');

      if (!$input || !$input.value) {
        return;
      }

      try {
        await webManager.utilities().clipboardCopy($input);

        const $text = this.querySelector('.button-text');
        const originalText = $text.textContent;

        $text.textContent = 'Copied!';
        this.classList.remove('btn-outline-adaptive');
        this.classList.add('btn-success');

        setTimeout(() => {
          $text.textContent = originalText;
          this.classList.remove('btn-success');
          this.classList.add('btn-outline-adaptive');
        }, 2000);
      } catch (error) {
        console.error('Failed to copy command:', error);
      }
    });
  });
}

// Setup mobile email forms
function setupMobileEmailForms() {
  const $forms = document.querySelectorAll('.mobile-email-form');

  $forms.forEach($form => {
    const platform = $form.dataset.platform;
    const formId = `#mobile-email-form-${platform}`;

    const formManager = new FormManager(formId, {
      allowResubmit: false,
      submittingText: 'Sending...',
      submittedText: 'Email Sent!',
    });

    formManager.on('submit', async ({ data }) => {
      console.log('Mobile email form submitted:', { platform, email: data.email });

      // Get API endpoint
      const apiEndpoint = `${webManager.getApiUrl()}/backend-manager/general/email`;

      // Send request using wonderful-fetch
      await fetch(apiEndpoint, {
        method: 'POST',
        body: {
          id: 'general:download-app-link',
          email: data.email,
        },
        response: 'json',
        timeout: 30000,
      });

      formManager.showSuccess('Success! Please check your email for the download link.');
    });
  });
}
