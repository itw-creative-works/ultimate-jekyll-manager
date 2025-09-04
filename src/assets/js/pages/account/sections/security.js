// Security section module
import fetch from 'wonderful-fetch';
import { FormManager } from '__main_assets__/js/libs/form-manager.js';

let webManager = null;
let firebaseAuth = null;
let signinMethodForms = new Map(); // Store FormManager instances for signin methods
let signoutAllForm = null; // FormManager instance for sign out all sessions

// Initialize security section
export function init(wm) {
  webManager = wm;
  initializeSigninMethods();
  initializeSigninMethodForms();
  initializeSignoutAllForm();
}

// Load security data
export function loadData(account) {
  if (!account) return;

  // Update signin methods
  updateSigninMethods();

  // Update 2FA status
  update2FAStatus(account.security?.twoFactor);

  // Update active sessions with full account data
  updateActiveSessions(account);
}

// Initialize signin methods
async function initializeSigninMethods() {
  // Get Firebase auth instance
  firebaseAuth = webManager.firebaseAuth;

  // Check for redirect result (in case user is returning from Google auth)
  checkRedirectResult();

  // Update signin methods display on load
  updateSigninMethods();
}

// Check for redirect result from Google auth
async function checkRedirectResult() {
  try {
    const { getRedirectResult } = await import('web-manager/node_modules/firebase/auth');
    const result = await getRedirectResult(firebaseAuth);

    if (result && result.user) {
      webManager.utilities().showNotification('Google account connected successfully', 'success');
      updateSigninMethods();
    }
  } catch (error) {
    if (error.code && error.code !== 'auth/no-auth-event') {
      console.error('Redirect result error:', error);
      webManager.utilities().showNotification('Failed to connect Google account', 'danger');
    }
  }
}

// Update signin methods display
async function updateSigninMethods() {
  // Use Firebase auth directly for most up-to-date provider information
  const firebaseUser = firebaseAuth?.currentUser;
  if (!firebaseUser) return;

  // Get the formatted user from webManager for consistency, but we'll use firebaseUser for provider data
  const user = webManager.auth().getUser();
  if (!user) return;

  // Update password email display
  const $passwordEmail = document.getElementById('password-email');
  if ($passwordEmail) {
    // Check if user has password provider using firebaseUser for most up-to-date data
    const hasPassword = firebaseUser.providerData?.some(provider => provider.providerId === 'password');
    $passwordEmail.textContent = hasPassword ? user.email : 'Not set';
  }

  // Update Google signin display
  const $googleEmail = document.getElementById('google-email');
  const $googleForm = document.getElementById('signin-method-google-form');
  const $googleBtn = $googleForm?.querySelector('button[type="submit"]');
  const $googleBtnText = $googleBtn?.querySelector('.button-text');
  const $googleAction = $googleForm?.querySelector('input[name="action"]');
  const $googleIcon = $googleBtn?.querySelector('.fa-icon');

  if ($googleEmail && $googleBtn) {
    // Check if user has Google provider using firebaseUser for most up-to-date data
    const googleProvider = firebaseUser.providerData?.find(provider => provider.providerId === 'google.com');

    if (googleProvider) {
      $googleEmail.textContent = googleProvider.email || 'Connected';
      if ($googleBtnText) $googleBtnText.textContent = 'Disconnect';
      if ($googleAction) $googleAction.value = 'disconnect';
      $googleBtn.classList.remove('btn-primary');
      $googleBtn.classList.add('btn-outline-danger');
      // Update icon from link to unlink
      if ($googleIcon) {
        $googleIcon.classList.remove('fa-link');
        $googleIcon.classList.add('fa-unlink');
      }
    } else {
      $googleEmail.textContent = 'Not connected';
      if ($googleBtnText) $googleBtnText.textContent = 'Connect';
      if ($googleAction) $googleAction.value = 'connect';
      $googleBtn.classList.remove('btn-outline-danger');
      $googleBtn.classList.add('btn-primary');
      // Update icon from unlink to link
      if ($googleIcon) {
        $googleIcon.classList.remove('fa-unlink');
        $googleIcon.classList.add('fa-link');
      }
    }
  }
}

// Update 2FA status
function update2FAStatus(twoFactorData) {
  const $2faStatus = document.getElementById('2fa-status');
  const $2faBtn = document.getElementById('2fa-btn');

  if (twoFactorData?.enabled) {
    if ($2faStatus) {
      $2faStatus.innerHTML = '<span class="badge bg-success">Enabled</span>';
    }
    if ($2faBtn) {
      $2faBtn.textContent = 'Manage 2FA';
      $2faBtn.className = 'btn btn-outline-primary';
    }
  } else {
    if ($2faStatus) {
      $2faStatus.innerHTML = '<span class="badge bg-secondary">Disabled</span>';
    }
    if ($2faBtn) {
      $2faBtn.textContent = 'Enable 2FA';
      $2faBtn.className = 'btn btn-primary';
    }
  }
}

// Update active sessions
async function updateActiveSessions(account) {
  const $sessionsList = document.getElementById('active-sessions-list');
  if (!$sessionsList) return;

  const sessions = [];

  // Add current session (from current activity)
  if (account?.activity) {
    const currentSession = {
      isCurrent: true,
      device: getDeviceFromUserAgent(account.activity.client?.userAgent),
      browser: getBrowserFromUserAgent(account.activity.client?.userAgent),
      platform: account.activity.client?.platform,
      mobile: account.activity.client?.mobile,
      language: account.activity.client?.language,
      ip: account.activity.geolocation?.ip,
      city: account.activity.geolocation?.city,
      region: account.activity.geolocation?.region,
      country: account.activity.geolocation?.country,
      timestamp: account.activity.created?.timestamp,
      timestampUNIX: account.activity.created?.timestampUNIX
    };
    sessions.push(currentSession);
  }

  // Fetch other active sessions from server
  try {
    const token = await webManager.auth().getIdToken();
    const serverApiURL = webManager.getApiUrl() + '/backend-manager';

    const data = await fetch(serverApiURL, {
      method: 'POST',
      timeout: 60000,
      response: 'json',
      tries: 2,
      body: {
        authenticationToken: token,
        command: 'user:get-active-sessions',
        payload: {
          // id: 'app',
        },
      },
    });

    console.log('Active sessions data from server:', data);

    // Process sessions from server response
    let sessionData = data || {};

    // Add fake data if _test_prefill=true is in query string
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('_test_prefill') === 'true') {
      console.log('Adding fake session data for testing');
      const fakeSessions = generateFakeSessions();
      // Merge fake sessions with existing data (fake sessions don't override real ones)
      sessionData = { ...fakeSessions, ...sessionData };
    }

    if (sessionData && typeof sessionData === 'object') {
      // Convert sessions object to array and process each session
      Object.keys(sessionData).forEach(sessionId => {
        const session = sessionData[sessionId];

        // Skip if this is the current session (already added)
        if (session._current) {
          return;
        }

        // Create session object from server data
        const sessionObj = {
          isCurrent: false,
          sessionId: sessionId,
          platform: session.platform,
          ip: session.ip,
          timestamp: session.timestamp,
          timestampUNIX: session.timestampUNIX,
          // We don't have user agent data for other sessions, so use platform for device name
          device: getPlatformName(session.platform),
          browser: 'App • Desktop', // All sessions show as App • Desktop
          mobile: undefined, // Not available in session data
        };

        sessions.push(sessionObj);
      });
    }

  } catch (error) {
    console.error('Failed to get active sessions:', error);
  }

  // Add last activity session if different from current (fallback)
  if (account?.lastActivity) {
    const lastSession = {
      isCurrent: false,
      device: getDeviceFromUserAgent(account.lastActivity.client?.userAgent),
      browser: getBrowserFromUserAgent(account.lastActivity.client?.userAgent),
      platform: account.lastActivity.client?.platform,
      mobile: account.lastActivity.client?.mobile,
      language: account.lastActivity.client?.language,
      ip: account.lastActivity.geolocation?.ip,
      city: account.lastActivity.geolocation?.city,
      region: account.lastActivity.geolocation?.region,
      country: account.lastActivity.geolocation?.country,
      timestamp: account.lastActivity.timestamp,
      timestampUNIX: account.lastActivity.timestampUNIX
    };

    // Only add if it's different from current session (different IP or timestamp)
    if (!sessions[0] ||
        (lastSession.ip !== sessions[0].ip ||
         lastSession.timestampUNIX !== sessions[0].timestampUNIX)) {
      sessions.push(lastSession);
    }
  }

  // Display active sessions
  if (sessions.length === 0) {
    $sessionsList.innerHTML = '<p class="text-muted text-center py-3">No active sessions found.</p>';
    return;
  }

  const sessionHTML = sessions.map(session => {
    const deviceName = session.device || 'Unknown Device';
    const browserName = session.browser || 'Unknown Browser';
    const location = formatSessionLocation(session);

    return `
    <div class="list-group-item px-0">
      <div class="d-flex justify-content-between align-items-start">
        <div class="d-flex align-items-start">
          <div class="me-3 mt-1">
            ${getDeviceIcon(session.platform || deviceName)}
          </div>
          <div>
            <div class="fw-semibold">${deviceName}</div>
            <small class="text-muted d-block">${browserName}${session.mobile !== undefined ? ` • ${session.mobile ? 'Mobile' : 'Desktop'}` : ''}</small>
            ${location ? `<small class="text-muted d-block">${location}</small>` : ''}
            ${session.ip ? `<small class="text-muted d-block">IP: ${session.ip}</small>` : ''}
          </div>
        </div>
        <div class="text-end">
          <small class="text-muted">${formatDate(session.timestamp || (session.timestampUNIX * 1000))}</small>
          ${session.isCurrent ? '<span class="badge bg-primary ms-2">Current</span>' : ''}
        </div>
      </div>
    </div>
  `;
  }).join('');

  $sessionsList.innerHTML = sessionHTML;
}

// Initialize FormManager for signin methods
function initializeSigninMethodForms() {
  // Initialize password form
  const $passwordForm = document.getElementById('signin-method-password-form');

  if ($passwordForm && !signinMethodForms.has('password')) {
    const formManager = new FormManager($passwordForm, {
      allowMultipleSubmit: false,
      autoDisable: true,
      showSpinner: true,
      submitButtonSuccessText: 'Email Sent'
    });

    signinMethodForms.set('password', formManager);

    formManager.addEventListener('submit', async () => {
      try {
        await handleChangePassword();
      } catch (error) {
        formManager.showError(error);
        formManager.setFormState('ready');
      }
    });
  }

  // Initialize Google form
  const $googleForm = document.getElementById('signin-method-google-form');

  if ($googleForm && !signinMethodForms.has('google')) {
    const formManager = new FormManager($googleForm, {
      autoDisable: true,
      showSpinner: true
    });

    signinMethodForms.set('google', formManager);

    formManager.addEventListener('submit', async (event) => {
      event.preventDefault();
      const { data } = event.detail;

      try {
        if (data.action === 'disconnect') {
          await disconnectGoogleProvider();
        } else {
          await connectGoogleProvider();
        }

        // Set form state back to ready first
        formManager.setFormState('ready');

        // Then update display (after FormManager has restored button)
        // Use setTimeout to ensure FormManager has finished updating
        setTimeout(() => {
          updateSigninMethods();
        }, 0);
      } catch (error) {
        // Reset form state
        formManager.setFormState('ready');

        // If user cancelled, also update the display to ensure button state is correct
        if (error.message === 'Disconnection cancelled') {
          // Update display to ensure button reflects current state
          setTimeout(() => {
            updateSigninMethods();
          }, 0);
        } else {
          // Show error for other failures
          formManager.showError(error);
        }
      }
    });
  }

  // Initialize 2FA button if exists
  const $2faBtn = document.getElementById('2fa-btn');
  if ($2faBtn) {
    $2faBtn.addEventListener('click', handle2FAClick);
  }
}

// Initialize FormManager for sign out all sessions
function initializeSignoutAllForm() {
  const $form = document.getElementById('signout-all-sessions-form');

  if ($form && !signoutAllForm) {
    signoutAllForm = new FormManager($form, {
      autoDisable: true,
      showSpinner: true
    });

    signoutAllForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      try {
        // Confirm sign out
        if (!confirm('Are you sure you want to sign out of all sessions? This will log you out everywhere, including this device.')) {
          throw new Error('Sign out cancelled');
        }

        // Sign out of all sessions
        await webManager.auth().signOut();

        // Show success message
        webManager.utilities().showNotification('Successfully signed out of all sessions.', 'success');

        // Note: The page will likely redirect due to auth state change
        // so we might not need to reset form state
      } catch (error) {
        if (error.message !== 'Sign out cancelled') {
          signoutAllForm.showError(error);
        }
        signoutAllForm.setFormState('ready');
      }
    });
  }
}



// Connect Google provider
async function connectGoogleProvider() {
  // Dynamic import of Firebase auth methods
  const { GoogleAuthProvider, linkWithPopup, linkWithRedirect } = await import('web-manager/node_modules/firebase/auth');

  const provider = new GoogleAuthProvider();

  try {
    // Try popup first for better UX
    const result = await linkWithPopup(firebaseAuth.currentUser, provider);
    webManager.utilities().showNotification('Google account connected successfully', 'success');

    // Force refresh of the current user to get updated provider data
    await firebaseAuth.currentUser.reload();

    return result;
  } catch (error) {
    // Check if we should fallback to redirect
    if (error.code === 'auth/popup-blocked' ||
        error.code === 'auth/popup-closed-by-user' ||
        error.code === 'auth/cancelled-popup-request') {

      console.log('Popup failed, falling back to redirect:', error.code);

      // Fallback to redirect
      try {
        await linkWithRedirect(firebaseAuth.currentUser, provider);
        // This will redirect the page, so no immediate result
      } catch (redirectError) {
        throw redirectError;
      }
    } else if (error.code === 'auth/credential-already-in-use') {
      throw new Error('This Google account is already linked to another user');
    } else {
      throw error;
    }
  }
}

// Disconnect Google provider
async function disconnectGoogleProvider() {
  // Wait 1 ms to allow FormManager to show "Processing..." spinner
  await new Promise(resolve => setTimeout(resolve, 1));

  // Confirm disconnection
  if (!confirm('Are you sure you want to disconnect your Google account?')) {
    throw new Error('Disconnection cancelled');
  }

  // Dynamic import of Firebase auth methods
  const { unlink } = await import('web-manager/node_modules/firebase/auth');

  const user = firebaseAuth.currentUser;

  // Check if user has another sign-in method
  if (user.providerData.length <= 1) {
    throw new Error('Cannot disconnect Google. You need at least one sign-in method.');
  }

  try {
    await unlink(user, 'google.com');
    webManager.utilities().showNotification('Google account disconnected successfully', 'success');
  } catch (error) {
    if (error.code === 'auth/no-such-provider') {
      throw new Error('Google account is not connected');
    } else {
      throw error;
    }
  }
}

// Handle change password
async function handleChangePassword() {
  try {
    const user = webManager.auth().getUser();
    if (!user || !user.email) {
      throw new Error('Please log in to reset your password.');
    }

    // Import Firebase auth method
    const { sendPasswordResetEmail } = await import('web-manager/node_modules/firebase/auth');

    // Send password reset email
    await sendPasswordResetEmail(firebaseAuth, user.email);
    webManager.utilities().showNotification('Password reset email sent. Please check your inbox.', 'info');
  } catch (error) {
    console.error('Failed to send password reset:', error);
    throw new Error(error.message || 'Failed to send password reset email. Please try again.');
  }
}

// Handle 2FA button click
async function handle2FAClick(event) {
  const isEnabled = event.target.textContent.includes('Enable');

  if (isEnabled) {
    // Start 2FA setup flow
    console.log('Starting 2FA setup...');
    // This would typically open a modal or redirect to 2FA setup page
  } else {
    // Manage existing 2FA
    console.log('Managing 2FA settings...');
  }
}


// Get device from user agent string
function getDeviceFromUserAgent(userAgent) {
  if (!userAgent) return 'Unknown Device';

  const ua = userAgent.toLowerCase();

  // Check for mobile devices first
  if (ua.includes('iphone')) return 'iPhone';
  if (ua.includes('ipad')) return 'iPad';
  if (ua.includes('android')) {
    if (ua.includes('mobile')) return 'Android Phone';
    if (ua.includes('tablet')) return 'Android Tablet';
    return 'Android Device';
  }
  if (ua.includes('windows phone')) return 'Windows Phone';

  // Check for desktop OS
  if (ua.includes('mac os x') || ua.includes('macintosh')) return 'Mac';
  if (ua.includes('windows nt')) return 'Windows PC';
  if (ua.includes('linux')) return 'Linux';
  if (ua.includes('cros')) return 'Chromebook';

  return 'Unknown Device';
}

// Get browser from user agent string
function getBrowserFromUserAgent(userAgent) {
  if (!userAgent) return 'Unknown Browser';

  const ua = userAgent.toLowerCase();

  // Check browsers (order matters for accurate detection)
  if (ua.includes('edg/')) return 'Microsoft Edge';
  if (ua.includes('chrome/') && !ua.includes('edg/')) return 'Chrome';
  if (ua.includes('firefox/')) return 'Firefox';
  if (ua.includes('safari/') && !ua.includes('chrome/') && !ua.includes('edg/')) return 'Safari';
  if (ua.includes('opera/') || ua.includes('opr/')) return 'Opera';
  if (ua.includes('brave/')) return 'Brave';

  return 'Unknown Browser';
}

// Get platform name from platform string
function getPlatformName(platform) {
  if (!platform) return 'Unknown Device';

  const platformLower = platform.toLowerCase();

  if (platformLower.includes('mac') || platformLower.includes('darwin')) {
    return 'macOS';
  } else if (platformLower.includes('win')) {
    return 'Windows';
  } else if (platformLower.includes('linux')) {
    return 'Linux';
  } else if (platformLower.includes('android')) {
    return 'Android';
  } else if (platformLower.includes('ios') || platformLower.includes('iphone') || platformLower.includes('ipad')) {
    return 'iOS';
  } else {
    return 'Unknown';
  }
}

// Get device icon based on device type
function getDeviceIcon(device) {
  const deviceLower = (device || '').toLowerCase();

  if (deviceLower.includes('iphone') || deviceLower.includes('ipad') || deviceLower.includes('ios') || deviceLower.includes('mac')) {
    return '<i class="fa-brands fa-apple fa-lg"></i>';
  } else if (deviceLower.includes('android')) {
    return '<i class="fa-brands fa-android fa-lg"></i>';
  } else if (deviceLower.includes('windows')) {
    return '<i class="fa-brands fa-windows fa-lg"></i>';
  } else if (deviceLower.includes('linux')) {
    return '<i class="fa-brands fa-linux fa-lg"></i>';
  } else if (deviceLower.includes('chrome')) {
    return '<i class="fa-brands fa-chrome fa-lg"></i>';
  } else {
    return '<i class="fa-solid fa-desktop fa-lg"></i>';
  }
}

// Format location from session data
function formatSessionLocation(session) {
  const parts = [];

  if (session.city) {
    // Capitalize first letter of each word in city name
    const cityFormatted = session.city.split(' ').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
    parts.push(cityFormatted);
  }

  if (session.region) {
    parts.push(session.region.toUpperCase());
  }

  if (session.country) {
    // Add country code or name
    parts.push(session.country.toUpperCase());
  }

  return parts.length > 0 ? parts.join(', ') : null;
}


// Generate fake sessions for development mode
function generateFakeSessions() {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * oneHour;

  return {
    'session_abc123': {
      _current: false,
      platform: 'Windows',
      ip: '98.137.246.8',
      timestamp: new Date(now - (3 * oneHour)).toISOString(),
      timestampUNIX: Math.floor((now - (3 * oneHour)) / 1000)
    },
    'session_def456': {
      _current: false,
      platform: 'Darwin',  // macOS
      ip: '192.168.1.42',
      timestamp: new Date(now - (8 * oneHour)).toISOString(),
      timestampUNIX: Math.floor((now - (8 * oneHour)) / 1000)
    },
    'session_ghi789': {
      _current: false,
      platform: 'Linux',
      ip: '45.62.189.3',
      timestamp: new Date(now - (oneDay)).toISOString(),
      timestampUNIX: Math.floor((now - (oneDay)) / 1000)
    },
    'session_jkl012': {
      _current: false,
      platform: 'Win32',
      ip: '203.0.113.45',
      timestamp: new Date(now - (2 * oneDay)).toISOString(),
      timestampUNIX: Math.floor((now - (2 * oneDay)) / 1000)
    },
    'session_mno345': {
      _current: false,
      platform: 'Mac',
      ip: '172.217.16.195',
      timestamp: new Date(now - (5 * oneDay)).toISOString(),
      timestampUNIX: Math.floor((now - (5 * oneDay)) / 1000)
    }
  };
}

// Format date helper
function formatDate(timestamp) {
  if (!timestamp) return 'Unknown';

  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  // Less than 1 minute
  if (diff < 60000) {
    return 'Just now';
  }

  // Less than 1 hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  }

  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }

  // Less than 7 days
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }

  // More than 7 days - show full date
  return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

