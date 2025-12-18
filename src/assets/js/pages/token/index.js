// This file is required by /token page to generate custom auth tokens for extensions/apps
import authorizedFetch from '__main_assets__/js/libs/authorized-fetch.js';

// Module
export default function (Manager) {
  // Shortcuts
  const { webManager } = Manager;

  // DOM elements
  const $status = document.getElementById('token-status');
  const $error = document.getElementById('token-error');
  const $errorMessage = document.getElementById('token-error-message');

  // Get URL params
  const url = new URL(window.location.href);
  const authReturnUrl = url.searchParams.get('authReturnUrl');

  // Handle DOM ready
  webManager.dom().ready()
  .then(async () => {
    // Log
    console.log('[Token] Initialized. authReturnUrl:', authReturnUrl);

    // Validate authReturnUrl if present
    if (authReturnUrl && !webManager.isValidRedirectUrl(authReturnUrl)) {
      showError('Invalid redirect URL');
      return;
    }

    // Wait for auth to be ready and get user
    webManager.auth().listen({ once: true }, async (state) => {
      const user = state.user;

      // Should not happen since page requires auth, but just in case
      if (!user) {
        showError('Not authenticated. Please sign in first.');
        return;
      }

      try {
        // Generate custom token
        updateStatus('Generating secure token...');
        const token = await generateCustomToken(webManager);

        // Update status
        updateStatus('Token generated successfully!');

        // Handle redirect or URL update
        if (authReturnUrl) {
          // Redirect to return URL with token (for electron/deep links)
          updateStatus('Redirecting...');
          const returnUrl = new URL(authReturnUrl);
          returnUrl.searchParams.set('authToken', token);
          window.location.href = returnUrl.toString();
        } else {
          // Add token to current URL (for browser extensions)
          // Extension background will detect this and close the tab
          url.searchParams.set('authToken', token);
          window.history.replaceState({}, '', url.toString());
          updateStatus('You can close this tab now.');
        }
      } catch (error) {
        console.error('[Token] Error generating token:', error);
        showError(error.message || 'Failed to generate token. Please try again.');
      }
    });
  });

  // Generate custom token via backend-manager API
  async function generateCustomToken(webManager) {
    const serverApiURL = `${webManager.getApiUrl()}/backend-manager`;

    const response = await authorizedFetch(serverApiURL, {
      method: 'POST',
      timeout: 60000,
      response: 'json',
      tries: 2,
      body: {
        command: 'user:create-custom-token',
        payload: {},
      },
    });

    // Extract token from response
    const token = response?.token;

    if (!token) {
      throw new Error('No token received from server');
    }

    return token;
  }

  // Update status message
  function updateStatus(message) {
    if ($status) {
      $status.innerHTML = `<p class="text-muted small">${message}</p>`;
    }
  }

  // Show error message
  function showError(message) {
    if ($error && $errorMessage) {
      $errorMessage.textContent = message;
      $error.classList.remove('d-none');
    }
    if ($status) {
      $status.classList.add('d-none');
    }
  }
}
