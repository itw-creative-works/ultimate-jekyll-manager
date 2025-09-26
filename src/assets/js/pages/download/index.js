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
  const instructions = getInstallInstructions(platform);

  const modalHtml = `
    <div class="modal fade" id="onboardingModal" tabindex="-1" aria-labelledby="onboardingModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content">
          <div class="modal-header border-0 pb-0">
            <h5 class="modal-title fw-bold" id="onboardingModalLabel">
              <i class="fa fa-rocket text-primary me-2"></i>
              Getting Started
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body p-4">
            <div class="alert alert-success d-flex align-items-center mb-4" role="alert">
              <i class="fa fa-check-circle fs-4 me-3"></i>
              <div>
                <strong>Download Started!</strong><br>
                <small class="text-muted">Your download should begin automatically.</small>
              </div>
            </div>

            <h6 class="fw-bold mb-3">Next Steps:</h6>
            <div class="installation-steps">
              ${instructions}
            </div>

            <div class="alert alert-info mt-4" role="alert">
              <i class="fa fa-lightbulb me-2"></i>
              <strong>Need help?</strong> Please <a href="/contact" class="alert-link">contact support</a>.
            </div>
          </div>
          <div class="modal-footer border-0 pt-0">
            <button type="button" class="btn btn-primary" data-bs-dismiss="modal">Got it!</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const existingModal = document.getElementById('onboardingModal');
  if (existingModal) {
    existingModal.remove();
  }

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modal = new bootstrap.Modal(document.getElementById('onboardingModal'));
  modal.show();

  document.getElementById('onboardingModal').addEventListener('hidden.bs.modal', function () {
    this.remove();
  });
}

// Get platform-specific installation instructions
function getInstallInstructions(platform) {
  const instructions = {
    windows: `
      <ol class="mb-0">
        <li class="mb-3">
          <strong>Locate the downloaded file (${webManager.config.brand.name}-Setup.exe)</strong><br>
          <small class="text-muted">Look in your <strong>Downloads</strong> folder</small>
        </li>
        <li class="mb-3">
          <strong>Double-click the downloaded .exe file</strong><br>
          <small class="text-muted">Click "Yes" if Windows asks for permission</small>
        </li>
        <li class="mb-3">
          <strong>Follow the installation wizard</strong><br>
          <small class="text-muted">Click "Next" and accept the terms</small>
        </li>
        <li>
          <strong>Launch the app</strong><br>
          <small class="text-muted">Find it in your Start Menu or Desktop</small>
        </li>
      </ol>
    `,
    mac: `
      <ol class="mb-0">
        <li class="mb-3">
          <strong>Locate the downloaded file (${webManager.config.brand.name}.dmg)</strong><br>
          <small class="text-muted">Look in your <strong>Downloads</strong> folder</small>
        </li>
        <li class="mb-3">
          <strong>Double-click the downloaded .dmg file</strong><br>
          <small class="text-muted">This mounts the disk image</small>
        </li>
        <li class="mb-3">
          <strong>Drag to Applications</strong><br>
          <small class="text-muted">This installs the app for all users</small>
        </li>
        <li>
          <strong>Open from Applications</strong><br>
          <small class="text-muted">Find it in your Applications folder or use Spotlight</small>
        </li>
      </ol>
    `,
    linux: `
      <ol class="mb-0">
        <li class="mb-3">
          <strong>Open Terminal</strong><br>
          <small class="text-muted">Press Ctrl+Alt+T</small>
        </li>
        <li class="mb-3">
          <strong>Navigate to Downloads</strong><br>
          <small class="text-muted">Run the command below:</small><br>
          <code class="d-block p-2 bg-dark text-light rounded">cd ~/Downloads</code>
        </li>
        <li class="mb-3">
          <strong>Install the package</strong><br>
          <small class="text-muted d-block mb-1">For Debian/Ubuntu:</small>
          <code class="d-block p-2 bg-dark text-light rounded mb-3">sudo dpkg -i ${webManager.config.brand.name.toLowerCase()}_amd64.deb</code>
          <small class="text-muted d-block mb-1">For Fedora/RHEL:</small>
          <code class="d-block p-2 bg-dark text-light rounded">sudo rpm -i ${webManager.config.brand.name.toLowerCase()}_amd64.rpm</code>
        </li>
        <li>
          <strong>Launch from menu</strong><br>
          <small class="text-muted">Find it in your applications menu</small>
        </li>
      </ol>
    `,
    android: `
      <ol class="mb-0">
        <li class="mb-3">
          <strong>Open the Play Store app</strong><br>
          <small class="text-muted">Or follow the download link that opened</small>
        </li>
        <li class="mb-3">
          <strong>Tap "Install"</strong><br>
          <small class="text-muted">Grant any required permissions</small>
        </li>
        <li>
          <strong>Tap "Open"</strong><br>
          <small class="text-muted">Or find the app icon on your home screen</small>
        </li>
      </ol>
    `,
    ios: `
      <ol class="mb-0">
        <li class="mb-3">
          <strong>Open the App Store</strong><br>
          <small class="text-muted">Or follow the link that opened</small>
        </li>
        <li class="mb-3">
          <strong>Tap "Get" or the download button</strong><br>
          <small class="text-muted">You may need to verify with Face ID or Touch ID</small>
        </li>
        <li>
          <strong>Tap "Open"</strong><br>
          <small class="text-muted">Or find the app icon on your home screen</small>
        </li>
      </ol>
    `
  };

  return instructions[platform] || instructions.windows;
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

  fbq('track', 'InitiateCheckout', {
    content_name: downloadName,
    content_category: platform,
    content_type: 'download'
  });

  ttq.track('Download', {
    content_name: downloadName,
    content_type: platform
  });
}
