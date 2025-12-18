// Libraries
import authorizedFetch from '__main_assets__/js/libs/authorized-fetch.js';
let webManager = null;

// Module
export default (Manager, options) => {
  return new Promise(async function (resolve) {
    // Set webManager
    webManager = Manager.webManager;

    // Initialize when DOM is ready
    await webManager.dom().ready();

    // Wait for auth state to be determined before handling OAuth callback
    // This is REQUIRED because authorizedFetch needs auth.currentUser to be available
    webManager.auth().listen({ once: true }, () => {
      // Handle OAuth callback after auth state is known
      handleOAuthCallback();
    });

    // Resolve after initialization
    return resolve();
  });
};

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
    const state = urlParams.get('state');
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

    if (!state) {
      throw new Error('Missing state parameter');
    }

    // Parse state
    let stateParsed;
    try {
      stateParsed = JSON.parse(decodeURIComponent(state));
    } catch (e) {
      console.error('Failed to parse state:', e);
      throw new Error('Invalid state parameter');
    }

    console.log('OAuth callback state:', stateParsed);

    // Validate state
    if (!stateParsed.provider) {
      throw new Error('Missing provider in state');
    }

    if (!stateParsed.serverUrl) {
      throw new Error('Missing server URL');
    }

    // Update provider name
    const providerName = capitalizeFirstLetter(stateParsed.provider);
    $provider.textContent = providerName;

    // Validate redirect URL
    if (stateParsed.redirectUrl && !webManager.isValidRedirectUrl(stateParsed.redirectUrl)) {
      throw new Error('Invalid redirect URL');
    }

    // Build tokenize payload
    const payload = {
      state: 'tokenize',
      provider: stateParsed.provider,
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
    const response = await authorizedFetch(stateParsed.serverUrl, {
      method: 'POST',
      timeout: 60000,
      response: 'json',
      tries: 2,
      body: {
        command: 'user:oauth2',
        payload: payload
      }
    });

    console.log('Tokenize response:', response);

    if (!response.success) {
      throw new Error(response.message || 'Failed to complete authorization');
    }

    // Show success
    showSuccess(stateParsed.redirectUrl || stateParsed.referrer || '/account#connections');

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
  }, 500);
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
  const state = urlParams.get('state');

  if (state) {
    try {
      const state = JSON.parse(decodeURIComponent(state));
      if (state.referrer) {
        $returnButton.href = state.referrer;
      }
    } catch (e) {
      // Use default
    }
  }
}

// Capitalize first letter
function capitalizeFirstLetter(string) {
  if (!string) return '';
  return string.charAt(0).toUpperCase() + string.slice(1);
}
