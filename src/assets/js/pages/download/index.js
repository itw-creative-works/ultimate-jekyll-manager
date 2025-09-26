// Libraries
let webManager = null;

// Module
export default (Manager) => {
  return new Promise(async function (resolve) {
    // Shortcuts
    webManager = Manager.webManager;

    // Initialize when DOM is ready
    await webManager.dom().ready();

    setupPlatformDetection();
    setupPlatformSwitcher();
    setupDownloadTracking();
    setupCopyButtons();

    // Expose modal function globally for testing
    window.showDownloadModal = showOnboardingModal;

    /* @dev-only:start */
    {
      window.showDownloadModal('mac');
    }
    /* @dev-only:end */

    // Resolve after initialization
    return resolve();
  });
};

// Configuration
const config = {
  selectors: {
    platformButtons: '.platform-btn',
    platformDownloads: '.platform-downloads',
    downloadButtons: '.platform-downloads .btn-primary'
  }
};

// Setup platform detection and auto-select
function setupPlatformDetection() {
  const detectedPlatform = detectPlatform();
  console.log('Detected platform:', detectedPlatform);

  // Small delay to let the page render before switching
  setTimeout(() => {
    showPlatform(detectedPlatform);
    // trackPlatformDetection(detectedPlatform);
  }, 100);
}

// Detect user's platform from user agent
function detectPlatform() {
  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform.toLowerCase();

  if (/android/.test(userAgent)) {
    return 'android';
  }

  if (/iphone|ipad|ipod/.test(userAgent)) {
    return 'ios';
  }

  if (platform.includes('win')) {
    return 'windows';
  }

  if (platform.includes('mac')) {
    return 'mac';
  }

  if (platform.includes('linux')) {
    return 'linux';
  }

  return 'windows';
}

// Setup platform switcher button handlers
function setupPlatformSwitcher() {
  const platformButtons = document.querySelectorAll(config.selectors.platformButtons);

  platformButtons.forEach(button => {
    button.addEventListener('click', function() {
      const platformId = this.dataset.platform;
      showPlatform(platformId);
      // trackPlatformSwitch(platformId);
    });
  });
}

// Show downloads for selected platform
function showPlatform(platformId) {
  const platformDownloads = document.querySelectorAll(config.selectors.platformDownloads);
  const platformButtons = document.querySelectorAll(config.selectors.platformButtons);

  console.log('Attempting to show platform:', platformId);
  console.log('Available platform downloads:', Array.from(platformDownloads).map(el => el.dataset.platform));
  console.log('Available platform buttons:', Array.from(platformButtons).map(btn => btn.dataset.platform));

  let foundPlatform = false;

  platformDownloads.forEach(el => {
    if (el.dataset.platform === platformId) {
      el.removeAttribute('hidden');
      foundPlatform = true;
    } else {
      el.setAttribute('hidden', '');
    }
  });

  platformButtons.forEach(btn => {
    if (btn.dataset.platform === platformId) {
      btn.classList.remove('btn-outline-adaptive');
      btn.classList.add('btn-primary');
    } else {
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-outline-adaptive');
    }
  });

  if (!foundPlatform) {
    console.warn('Platform not found:', platformId, '- falling back to first available platform');
    const firstDownload = platformDownloads[0];
    const firstButton = platformButtons[0];

    if (firstDownload) {
      firstDownload.removeAttribute('hidden');
      console.log('Showing fallback platform:', firstDownload.dataset.platform);
    }

    if (firstButton) {
      firstButton.classList.remove('btn-outline-adaptive');
      firstButton.classList.add('btn-primary');
    }
  } else {
    console.log('Successfully showing platform:', platformId);
  }
}

// Setup download button tracking
function setupDownloadTracking() {
  const downloadButtons = document.querySelectorAll(config.selectors.downloadButtons);

  downloadButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      const platformCard = this.closest('.platform-downloads');
      const platformId = platformCard ? platformCard.dataset.platform : 'unknown';
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
// function trackPlatformDetection(platform) {
//   gtag('event', 'platform_detected', {
//     platform: platform
//   });
//   fbq('track', 'ViewContent', {
//     content_name: 'Download Page',
//     content_category: platform
//   });
//   ttq.track('ViewContent', {
//     content_name: 'Download Page',
//     content_type: platform
//   });
// }

// function trackPlatformSwitch(platform) {
//   gtag('event', 'platform_switch', {
//     platform: platform
//   });
//   fbq('track', 'CustomizeProduct', {
//     content_name: 'Platform Selection',
//     content_category: platform
//   });
//   ttq.track('ClickButton', {
//     content_name: 'Platform Switch',
//     content_type: platform
//   });
// }

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

      if (!$input || !$input.value) return;

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
