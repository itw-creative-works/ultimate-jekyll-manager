// Connections section module for OAuth account linking
import { FormManager } from '__main_assets__/js/libs/form-manager.js';
import fetch from 'wonderful-fetch';

let webManager = null;
let appData = null;
let accountData = null;
let connectionForms = new Map(); // Store FormManager instances for each provider

// Supported providers (must match IDs in HTML)
const supportedProviders = ['google', 'discord', 'github', 'twitter', 'facebook'];

// Get API URL helper
function getApiUrl() {
  return webManager.getApiUrl() + '/backend-manager';
}

// Initialize connections section
export async function init(wm) {
  webManager = wm;
}

// Load connections data
export async function loadData(account, sharedAppData) {
  if (!account) return;

  accountData = account;
  appData = sharedAppData;

  displayConnections();
}

// Display available and connected OAuth providers
function displayConnections() {
  // Hide loading state
  const $loading = document.getElementById('connections-loading');
  if ($loading) {
    $loading.classList.add('d-none');
  }

  // Check if appData is loaded
  if (!appData) {
    // Show loading if no app data yet
    if ($loading) {
      $loading.classList.remove('d-none');
    }
    return;
  }

  // Get available OAuth providers from app data
  const availableProviders = appData?.oauth2 || {};
  const userConnections = accountData?.oauth2 || {};

  // Check if any providers are configured
  let hasEnabledProviders = false;

  // Process each supported provider
  supportedProviders.forEach(providerId => {
    const providerSettings = availableProviders[providerId];
    const $providerElement = document.getElementById(`connection-${providerId}`);

    if (!$providerElement) {
      return;
    }

    // Check if provider is enabled
    const isEnabled = providerSettings && providerSettings.enabled !== false;

    if (isEnabled) {
      hasEnabledProviders = true;

      // Show the provider element
      $providerElement.classList.remove('d-none');

      // CRITICAL: Update button status BEFORE initializing FormManager
      // This ensures FormManager stores the CORRECT button state from the start
      const userConnection = userConnections[providerId];
      updateProviderStatus(providerId, userConnection, providerSettings);

      // Initialize FormManager AFTER setting correct button state
      initializeProviderForm(providerId);
    } else {
      // Hide disabled providers
      $providerElement.classList.add('d-none');
    }
  });

  // Show empty message if no providers are enabled
  const $empty = document.getElementById('connections-empty');
  if ($empty) {
    if (hasEnabledProviders) {
      $empty.classList.add('d-none');
    } else {
      $empty.classList.remove('d-none');
    }
  }
}

// Update provider status display
function updateProviderStatus(providerId, userConnection, providerSettings) {
  const $status = document.getElementById(`${providerId}-connection-status`);
  const $description = document.getElementById(`${providerId}-connection-description`);
  const $form = document.getElementById(`connection-form-${providerId}`);
  const $button = $form?.querySelector('button[type="submit"]');
  const $buttonText = $button?.querySelector('.button-text');
  const $action = $form?.querySelector('input[name="action"]');

  const isConnected = userConnection && userConnection.identity;

  // Always show description on the left
  if ($description) {
    const defaultDescriptions = {
      google: 'Enable single sign-on with your Google account',
      discord: 'Connect to access Discord community features',
      github: 'Link your GitHub account for repository access',
      twitter: 'Share updates and connect with Twitter',
      facebook: 'Connect your Facebook account for social features'
    };

    const descriptionText = providerSettings?.description
      || defaultDescriptions[providerId]
      || `Connect your ${providerId.charAt(0).toUpperCase() + providerId.slice(1)} account`;
    $description.textContent = descriptionText;
    $description.classList.remove('d-none');
  }

  // Handle connection status display under the button
  if ($status) {
    if (isConnected) {
      const displayName = getConnectionDisplayName(userConnection);
      let statusText = `Connected: ${displayName}`;

      // Add last updated date if available
      if (userConnection.updated && userConnection.updated.timestamp) {
        const date = new Date(userConnection.updated.timestamp);
        const dateStr = date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        statusText = `${displayName} • ${dateStr}`;
      }

      $status.textContent = statusText;
      $status.classList.remove('d-none');
    } else {
      // Not connected - hide status under button
      $status.textContent = '';
      $status.classList.add('d-none');
    }
  }

  if ($button && $buttonText && $action) {
    if (isConnected) {
      // Update to disconnect state (RED button)
      $button.classList.remove('btn-primary');
      $button.classList.add('btn-outline-danger');
      $buttonText.textContent = 'Disconnect';
      $action.value = 'disconnect';

      // Replace icon
      const $icon = $button.querySelector('.fa-icon');
      if ($icon) {
        $icon.classList.remove('fa-link');
        $icon.classList.add('fa-unlink');
      }
    } else {
      // Update to connect state (BLUE button)
      $button.classList.remove('btn-outline-danger');
      $button.classList.add('btn-primary');
      $buttonText.textContent = 'Connect';
      $action.value = 'connect';

      // Replace icon
      const $icon = $button.querySelector('.fa-icon');
      if ($icon) {
        $icon.classList.remove('fa-unlink');
        $icon.classList.add('fa-link');
      }
    }
  }
}

// Get display name for connection
function getConnectionDisplayName(connection) {
  if (!connection || !connection.identity) return 'Unknown';

  return connection.identity.global_name
    || connection.identity.username
    || connection.identity.name
    || connection.identity.email
    || connection.identity.id
    || 'Connected';
}

// Initialize FormManager for a provider
function initializeProviderForm(providerId) {
  const formId = `connection-form-${providerId}`;
  const form = document.getElementById(formId);

  if (!form) {
    console.warn(`Form not found for provider: ${providerId}`);
    return;
  }

  // Skip if already initialized
  if (connectionForms.has(providerId)) {
    return;
  }

  // Create new FormManager
  const formManager = new FormManager(`#${formId}`, {
    autoDisable: true,
    showSpinner: true
  });

  // Store the FormManager instance
  connectionForms.set(providerId, formManager);

  // Handle form submission
  formManager.addEventListener('submit', async (event) => {
    event.preventDefault();

    const { data } = event.detail;
    const action = data.action;
    const provider = data.provider;

    try {
      if (action === 'connect') {
        await handleConnect(provider);
      } else if (action === 'disconnect') {
        const success = await handleDisconnect(provider);
        if (success) {
          // Reset form state and update UI after successful disconnect
          formManager.setFormState('ready');
          const providerSettings = appData?.oauth2?.[provider];
          updateProviderStatus(provider, null, providerSettings);
        }
      }
    } catch (error) {
      // Show error and reset form state
      formManager.showError(error);
      formManager.setFormState('ready');
    }
  });
}

// Handle connect action
async function handleConnect(providerId) {
  const provider = appData?.oauth2?.[providerId];
  if (!provider || provider.enabled === false) {
    throw new Error('This connection service is not available.');
  }

  // Get user token
  const token = await webManager.auth().getIdToken();

  // Get scope from provider settings (pass as array)
  const scope = provider.scope || [];

  const response = await fetch(getApiUrl(), {
    method: 'POST',
    timeout: 30000,
    response: 'json',
    tries: 2,
    body: {
      authenticationToken: token,
      command: 'user:oauth2',
      payload: {
        redirect: false,
        provider: providerId,
        state: 'authorize',
        scope: scope,
        referrer: window.location.href,
      }
    },
  });

  // For authorize requests, server returns an object with URL to redirect to
  if (response.url) {
    window.location.href = response.url;
  } else {
    throw new Error(response.message || 'Failed to get authorization URL');
  }
}

// Handle disconnect action
async function handleDisconnect(providerId) {
  const providerName = providerId.charAt(0).toUpperCase() + providerId.slice(1);

  // Wait 1 ms
  await new Promise(resolve => setTimeout(resolve, 1));

  // Confirm disconnection
  if (!confirm(`Are you sure you want to disconnect your ${providerName} account?`)) {
    throw new Error('Disconnection cancelled');
  }

  // Get user token
  const token = await webManager.auth().getIdToken();

  // Get provider settings for scope (pass as array)
  const provider = appData?.oauth2?.[providerId] || {};
  const scope = provider.scope || [];

  const response = await fetch(getApiUrl(), {
    method: 'POST',
    timeout: 30000,
    response: 'json',
    tries: 2,
    body: {
      authenticationToken: token,
      command: 'user:oauth2',
      payload: {
        redirect: false,
        provider: providerId,
        state: 'deauthorize',
        scope: scope,
        referrer: window.location.href,
      }
    },
  });

  if (response.success) {
    // Update local account data
    if (accountData.oauth2 && accountData.oauth2[providerId]) {
      delete accountData.oauth2[providerId];
    }

    return true;
  } else {
    throw new Error(response.message || 'Failed to disconnect');
  }
}

// Called when section is shown
export function onShow() {
  // Don't re-run displayConnections() - it's already been called from loadData()
  // Re-running it would re-initialize FormManager and cause race conditions
}
