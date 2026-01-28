/**
 * Admin Notifications Page JavaScript
 */

// Libraries
import { FormManager } from '__main_assets__/js/libs/form-manager.js';
import authorizedFetch from '__main_assets__/js/libs/authorized-fetch.js';
import { getPrerenderedIcon } from '__main_assets__/js/libs/prerendered-icons.js';

let webManager = null;

// Module
export default (Manager) => {
  return new Promise(async function (resolve) {
    // Shortcuts
    webManager = Manager.webManager;

    // Initialize when DOM is ready
    await webManager.dom().ready();

    try {
      await initializeNotificationCreator();
    } catch (error) {
      webManager.sentry().captureException(new Error('Failed to initialize notification creator', { cause: error }));
    }

    // Resolve after initialization
    return resolve();
  });
};

// Global state
let formManager = null;
let stats = {
  totalUsers: 0,
  filteredUsers: 0,
};
let autoSubmitTimer = null;
let isInitialized = false;

// Main initialization
async function initializeNotificationCreator() {
  // Prevent re-initialization
  if (isInitialized) {
    return;
  }
  isInitialized = true;

  // Initialize FormManager
  initializeFormManager();

  // Initialize UI elements
  initializeUI();

  // Show loading spinner on user counts initially
  showUserCountLoading();

  // Setup auth listener
  webManager.auth().listen({ account: false }, async (state) => {
    console.log('Auth state for notification creator:', state);

    // Show loading spinner while fetching
    showUserCountLoading();

    // Fetch initial user stats
    await fetchUserStats();

    // Update UI with stats
    updateUserCount();
  });
}

// Initialize FormManager
function initializeFormManager() {
  formManager = new FormManager('#notification-form', {
    allowResubmit: false,
  });

  formManager.on('change', ({ data }) => {
    // Update preview in real-time
    updatePreview(data);

    // Update character counts
    updateCharacterCounts(data);

    // Check auto-submit status
    checkAutoSubmit(data);
  });

  formManager.on('submit', async ({ data }) => {
    // Transform data for API
    const payload = transformDataForAPI(data);

    // Add user stats
    payload.reach = {
      available: { total: stats.totalUsers },
      filtered: { total: stats.filteredUsers },
    };

    // Call API
    await sendNotification(payload);

    // Track success
    trackNotificationSent(payload);

    // Success
    formManager.showSuccess(`Notification sent successfully to ${stats.filteredUsers.toLocaleString()} users!`);
  });
}

// Initialize UI elements
function initializeUI() {
  // Icon preview updater
  const $iconInput = document.querySelector('input[name="notification.icon"]');
  if ($iconInput) {
    $iconInput.addEventListener('input', (e) => {
      updateIconPreview(e.target.value);
    });
  }

  // Title character counter
  const $titleInput = document.querySelector('input[name="notification.title"]');
  if ($titleInput) {
    // Set default value in dev mode
    if (webManager.isDevelopment()) {
      $titleInput.value = 'Test Notification Title';
    }

    $titleInput.addEventListener('input', (e) => {
      const length = e.target.value.length;
      const $titleCount = document.querySelector('#title-char-count');
      if ($titleCount) {
        $titleCount.textContent = `${length} / 60`;
        $titleCount.className = length > 60 ? 'text-danger' : 'text-muted';
      }
    });
  }

  // Body character counter
  const $bodyInput = document.querySelector('textarea[name="notification.body"]');
  if ($bodyInput) {
    // Set default value in dev mode
    if (webManager.isDevelopment()) {
      $bodyInput.value = 'This is a test notification body message for development.';
    }

    $bodyInput.addEventListener('input', (e) => {
      const length = e.target.value.length;
      const $bodyCount = document.querySelector('#body-char-count');
      if ($bodyCount) {
        $bodyCount.textContent = `${length} / 200`;
        $bodyCount.className = length > 200 ? 'text-danger' : 'text-muted';
      }
    });
  }

  // Auto-submit button
  const $autoSubmitBtn = document.querySelector('.btn-set-auto-submit');
  if ($autoSubmitBtn) {
    $autoSubmitBtn.addEventListener('click', () => {
      setAutoSubmitTime();
    });
  }

  // Clear auto-submit button
  const $clearAutoSubmitBtn = document.querySelector('.btn-clear-auto-submit');
  if ($clearAutoSubmitBtn) {
    $clearAutoSubmitBtn.addEventListener('click', () => {
      clearAutoSubmit();
    });
  }

  // Notification preview click handler
  const $notificationPreview = document.querySelector('#notification-preview-clickable');
  if ($notificationPreview) {
    $notificationPreview.addEventListener('click', () => {
      const $clickActionInput = document.querySelector('input[name="notification.clickAction"]');
      if ($clickActionInput && $clickActionInput.value) {
        // Open the URL in a new tab
        window.open($clickActionInput.value, '_blank', 'noopener,noreferrer');
      }
    });
  }

  // Initialize preview with default values and trigger form change to update everything
  updatePreview();

  // Trigger initial form change to update character counts and preview with form data
  if (formManager) {
    setTimeout(() => {
      const data = formManager.getData();
      updatePreview(data);
      updateCharacterCounts(data);
      checkAutoSubmit(data);
    }, 100);
  }
}

// Transform data for API
function transformDataForAPI(formData) {
  console.log('[Debug] transformDataForAPI called');
  console.log('[Debug] formData received:', formData);
  console.log('[Debug] formData.notification:', formData.notification);

  const now = new Date();
  const notification = formData.notification || {};

  console.log('[Debug] notification object:', notification);
  console.log('[Debug] notification.clickAction:', notification.clickAction);
  console.log('[Debug] typeof notification:', typeof notification);
  console.log('[Debug] Object.keys(notification):', Object.keys(notification));

  // Generate ID
  const id = now.getTime();

  // Build click action URL with tracking
  const redirectUrl = new URL('https://promo-server.itwcreativeworks.com/redirect/notification');
  redirectUrl.searchParams.set('id', id);
  redirectUrl.searchParams.set('type', 'notification');

  // Make sure we have the actual clickAction value
  const clickActionValue = notification.clickAction || '';
  console.log('[Debug] clickActionValue to be set in URL:', clickActionValue);
  redirectUrl.searchParams.set('url', clickActionValue);

  return {
    id: id,
    notification: {
      icon: notification.icon || '',
      title: notification.title || '',
      body: notification.body || '',
      clickAction: redirectUrl.toString(),
    },
    created: now.toISOString(),
    channels: formData.channels || {},
    audience: formData.audience || {},
    schedule: formData.schedule || {},
  };
}

// Send notification via API
async function sendNotification(payload) {
  const functionsUrl = `${getAPIFunctionsUrl()}/admin/notification`;

  return authorizedFetch(functionsUrl, {
    method: 'POST',
    timeout: 60000,
    response: 'json',
    tries: 1,
    log: true,
    body: payload,
  });
}

// Fetch user statistics
async function fetchUserStats() {
  try {
    const response = await authorizedFetch(`${getAPIFunctionsUrl()}/admin/firestore?path=meta/stats`, {
      method: 'GET',
      timeout: 60000,
      response: 'json',
      tries: 2,
      log: true,
    });

    // Extract user count from response
    const total = response?.notifications?.total || 0;
    stats.totalUsers = total;
    stats.filteredUsers = total; // Initially all users
  } catch (error) {
    console.error('Failed to fetch user stats:', error);
    webManager.sentry().captureException(new Error('Failed to fetch user stats', { cause: error }));

    // Use default values
    stats.totalUsers = 0;
    stats.filteredUsers = 0;
  }
}

// Update user count display
function updateUserCount() {
  const $countElements = document.querySelectorAll('.notification-user-count');
  $countElements.forEach(el => {
    // Remove loading spinner and show the count
    el.innerHTML = `${stats.filteredUsers.toLocaleString()} / ${stats.totalUsers.toLocaleString()}`;
  });
}

// Show loading spinner on user count elements
function showUserCountLoading() {
  const $countElements = document.querySelectorAll('.notification-user-count');
  $countElements.forEach(el => {
    // Add spinner with loading text
    el.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span>Loading...';
  });
}

// Update preview
function updatePreview(formData = null) {
  if (!formData) {
    formData = formManager?.getData() || {};
  }

  const notification = formData.notification || {};

  // Update preview elements
  const $previewIcon = document.querySelector('#preview-icon');
  const $previewTitle = document.querySelector('#preview-title');
  const $previewBody = document.querySelector('#preview-body');
  const $previewTime = document.querySelector('#preview-time');

  if ($previewIcon && notification.icon) {
    $previewIcon.src = notification.icon;
    $previewIcon.onerror = () => {
      $previewIcon.src = 'https://via.placeholder.com/50';
    };
  }

  if ($previewTitle) {
    $previewTitle.textContent = notification.title || 'Notification Title';
  }

  if ($previewBody) {
    $previewBody.textContent = notification.body || 'This is what your notification body will look like...';
  }

  if ($previewTime) {
    $previewTime.textContent = 'Now';
  }
}

// Update icon preview
function updateIconPreview(url) {
  const $previewIcon = document.querySelector('#preview-icon');
  if ($previewIcon) {
    if (url && url.match(/^https?:\/\/.+/)) {
      $previewIcon.src = url;
      $previewIcon.onerror = () => {
        $previewIcon.src = 'https://via.placeholder.com/50';
      };
    } else {
      $previewIcon.src = 'https://via.placeholder.com/50';
    }
  }
}

// Update character counts
function updateCharacterCounts(formData) {
  const notification = formData.notification || {};

  // Update title count
  const $titleCount = document.querySelector('#title-char-count');
  if ($titleCount) {
    const length = (notification.title || '').length;
    $titleCount.textContent = `${length} / 60`;
    $titleCount.className = length > 60 ? 'text-danger' : 'text-muted';
  }

  // Update body count
  const $bodyCount = document.querySelector('#body-char-count');
  if ($bodyCount) {
    const length = (notification.body || '').length;
    $bodyCount.textContent = `${length} / 200`;
    $bodyCount.className = length > 200 ? 'text-danger' : 'text-muted';
  }
}

// Set auto-submit time
function setAutoSubmitTime() {
  // Set to tomorrow at 10 AM
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  // Format for input fields
  const dateStr = tomorrow.toISOString().split('T')[0];
  const timeStr = '10:00';

  // Set values
  const $dateInput = document.querySelector('input[name="schedule.date"]');
  const $timeInput = document.querySelector('input[name="schedule.time"]');

  if ($dateInput) $dateInput.value = dateStr;
  if ($timeInput) $timeInput.value = timeStr;

  // Start countdown
  startAutoSubmitCountdown(tomorrow);
}

// Clear auto-submit
function clearAutoSubmit() {
  // Clear inputs
  const $dateInput = document.querySelector('input[name="schedule.date"]');
  const $timeInput = document.querySelector('input[name="schedule.time"]');

  if ($dateInput) $dateInput.value = '';
  if ($timeInput) $timeInput.value = '';

  // Clear countdown
  clearAutoSubmitCountdown();
}

// Check auto-submit status
function checkAutoSubmit(formData) {
  if (formData.schedule?.date && formData.schedule?.time) {
    const scheduledDate = new Date(`${formData.schedule.date}T${formData.schedule.time}`);
    if (scheduledDate > new Date()) {
      startAutoSubmitCountdown(scheduledDate);
    } else {
      clearAutoSubmitCountdown();
    }
  } else {
    clearAutoSubmitCountdown();
  }
}

// Start auto-submit countdown
function startAutoSubmitCountdown(targetDate) {
  clearAutoSubmitCountdown();

  const $countdownEl = document.querySelector('#auto-submit-countdown');
  if (!$countdownEl) {
    return;
  }

  $countdownEl.classList.remove('d-none');

  autoSubmitTimer = setInterval(() => {
    const now = new Date();
    const diff = targetDate - now;

    if (diff <= 0) {
      // Time to submit!
      clearAutoSubmitCountdown();

      // Fetch updated stats before submitting
      fetchUserStats()
        .then(() => updateUserCount())
        .finally(() => {
          // Programmatically submit the form
          formManager.$form.requestSubmit();
        });

      return;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    $countdownEl.innerHTML = `<i class="bi bi-clock"></i> Auto-submit in: ${hours}h ${minutes}m ${seconds}s`;
  }, 1000);
}

// Clear auto-submit countdown
function clearAutoSubmitCountdown() {
  if (autoSubmitTimer) {
    clearInterval(autoSubmitTimer);
    autoSubmitTimer = null;
  }

  const $countdownEl = document.querySelector('#auto-submit-countdown');
  if ($countdownEl) {
    $countdownEl.classList.add('d-none');
    $countdownEl.innerHTML = '';
  }
}

// Get API functions URL
function getAPIFunctionsUrl() {
  return `${webManager.getApiUrl()}/backend-manager`;
}

// Tracking functions
function trackNotificationSent(payload) {
  // Google Analytics
  if (typeof gtag !== 'undefined') {
    gtag('event', 'notification_sent', {
      notification_type: 'admin',
      user_count: stats.filteredUsers,
      channels: Object.keys(payload.channels || {}).filter(c => payload.channels[c]?.enabled).join(',')
    });
  }

  // Facebook Pixel
  if (typeof fbq !== 'undefined') {
    fbq('trackCustom', 'AdminNotificationSent', {
      users: stats.filteredUsers,
      channels: Object.keys(payload.channels || {}).filter(c => payload.channels[c]?.enabled)
    });
  }

  // TikTok Pixel
  if (typeof ttq !== 'undefined') {
    ttq.track('SubmitForm', {
      content_name: 'Admin Notification',
      content_type: 'notification',
      value: stats.filteredUsers
    });
  }
}
