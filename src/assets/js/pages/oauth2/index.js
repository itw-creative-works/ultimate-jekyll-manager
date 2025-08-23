// OAuth2 callback handler
import fetch from 'wonderful-fetch';

let webManager = null;

// Parse and validate OAuth callback
async function handleOAuthCallback() {
  const $loading = document.getElementById('oauth2-loading');
  const $result = document.getElementById('oauth2-result');
  const $provider = document.getElementById('oauth2-provider');
  const $errorMessage = document.getElementById('error-message');
  const $returnButton = document.getElementById('return-button');
  const $resultSuccess = document.getElementById('result-success');
  const $resultError = document.getElementById('result-error');

  try {
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const stateParam = urlParams.get('state');
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');

    // Check for OAuth errors
    if (error) {
      throw new Error(errorDescription || error || 'OAuth authorization was denied');
    }

    // Validate required parameters
    if (!code) {
      throw new Error('Missing authorization code');
    }

    if (!stateParam) {
      throw new Error('Missing state parameter');
    }

    // Parse state
    let state;
    try {
      state = JSON.parse(decodeURIComponent(stateParam));
    } catch (e) {
      console.error('Failed to parse state:', e);
      throw new Error('Invalid state parameter');
    }

    console.log('OAuth callback state:', state);

    // Validate state
    if (!state.provider) {
      throw new Error('Missing provider in state');
    }

    if (!state.authenticationToken) {
      throw new Error('Missing authentication token');
    }

    if (!state.serverUrl) {
      throw new Error('Missing server URL');
    }

    // Update provider name
    const providerName = capitalizeFirstLetter(state.provider);
    $provider.textContent = providerName;

    // Validate redirect URL
    if (state.redirectUrl && !isValidRedirectUrl(state.redirectUrl)) {
      throw new Error('Invalid redirect URL');
    }

    // Build tokenize payload
    const payload = {
      state: 'tokenize',
      provider: state.provider,
      code: code
    };

    // Add any additional OAuth parameters
    urlParams.forEach((value, key) => {
      if (key !== 'state' && key !== 'code') {
        payload[key] = value;
      }
    });

    console.log('Tokenize payload:', payload);

    // Call server to complete OAuth flow
    const response = await fetch(state.serverUrl, {
      method: 'POST',
      timeout: 60000,
      response: 'json',
      tries: 2,
      body: {
        authenticationToken: state.authenticationToken,
        command: 'user:oauth2',
        payload: payload
      }
    });

    console.log('Tokenize response:', response);

    if (!response.success) {
      throw new Error(response.message || 'Failed to complete authorization');
    }

    // Show success
    showSuccess(state.redirectUrl || state.referrer || '/account#connections');

  } catch (error) {
    console.error('OAuth callback error:', error);
    showError(error.message);
  }
}

// Show success state
function showSuccess(redirectUrl) {
  const $loading = document.getElementById('oauth2-loading');
  const $result = document.getElementById('oauth2-result');
  const $resultSuccess = document.getElementById('result-success');

  // Hide loading, show result
  $loading.classList.add('d-none');
  $result.classList.remove('d-none');
  $resultSuccess.classList.remove('d-none');

  // Redirect after delay
  setTimeout(() => {
    window.location.href = redirectUrl;
  }, 1500);
}

// Show error state
function showError(message) {
  const $loading = document.getElementById('oauth2-loading');
  const $result = document.getElementById('oauth2-result');
  const $resultError = document.getElementById('result-error');
  const $errorMessage = document.getElementById('error-message');
  const $returnButton = document.getElementById('return-button');

  // Hide loading, show error
  $loading.classList.add('d-none');
  $result.classList.remove('d-none');
  $resultError.classList.remove('d-none');

  // Set error message
  $errorMessage.textContent = message;

  // Set return button href
  const urlParams = new URLSearchParams(window.location.search);
  const stateParam = urlParams.get('state');
  
  if (stateParam) {
    try {
      const state = JSON.parse(decodeURIComponent(stateParam));
      if (state.referrer) {
        $returnButton.href = state.referrer;
      }
    } catch (e) {
      // Use default
    }
  }
}

// Validate redirect URL
function isValidRedirectUrl(url) {
  try {
    const parsed = new URL(url);
    const current = new URL(window.location.href);
    
    // Allow same origin or configured trusted domains
    return parsed.origin === current.origin || 
           isAllowedDomain(parsed.hostname);
  } catch (e) {
    return false;
  }
}

// Check if domain is allowed
function isAllowedDomain(hostname) {
  // Add any trusted domains here
  const allowedDomains = [
    'localhost',
    '127.0.0.1',
    webManager?.config?.brand?.domain
  ].filter(Boolean);

  return allowedDomains.some(domain => 
    hostname === domain || hostname.endsWith('.' + domain)
  );
}

// Capitalize first letter
function capitalizeFirstLetter(string) {
  if (!string) return '';
  return string.charAt(0).toUpperCase() + string.slice(1);
}

// Module export
export default (Manager) => {
  return new Promise(async function (resolve) {
    // Shortcuts
    webManager = Manager.webManager;

    // Initialize when DOM is ready
    webManager.dom().ready()
    .then(() => {
      // Handle OAuth callback
      handleOAuthCallback();
    });

    // Resolve
    return resolve();
  });
};