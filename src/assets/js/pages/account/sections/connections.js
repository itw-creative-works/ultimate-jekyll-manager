// Connections section module for OAuth account linking
import { FormManager } from '__main_assets__/js/libs/form-manager.js';
import authorizedFetch from '__main_assets__/js/libs/authorized-fetch.js';;

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
  console.log('[DEBUG] displayConnections() called');

  // Hide loading state
  const $loading = document.getElementById('connections-loading');
  if ($loading) {
    $loading.classList.add('d-none');
  }

  // Check if appData is loaded
  if (!appData) {
    console.log('[DEBUG] No appData, showing loading state');
    // Show loading if no app data yet
    if ($loading) {
      $loading.classList.remove('d-none');
    }
    return;
  }

  // Get available OAuth providers from app data
  const availableProviders = appData?.oauth2 || {};
  const userConnections = accountData?.oauth2 || {};

  console.log('[DEBUG] Available OAuth providers:', availableProviders);
  console.log('[DEBUG] User connections:', userConnections);

  // Check if any providers are configured
  let hasEnabledProviders = false;

  // Process each supported provider
  supportedProviders.forEach(providerId => {
    console.log(`[DEBUG] Processing provider: ${providerId}`);

    const providerSettings = availableProviders[providerId];
    const $providerElement = document.getElementById(`connection-${providerId}`);

    console.log(`[DEBUG] ${providerId} - providerSettings:`, providerSettings);
    console.log(`[DEBUG] ${providerId} - providerSettings.enabled:`, providerSettings?.enabled);
    console.log(`[DEBUG] ${providerId} - $providerElement exists:`, !!$providerElement);

    if (!$providerElement) {
      console.warn(`[DEBUG] ${providerId} - Provider element not found in DOM`);
      return;
    }

    // Check if provider is enabled
    const isEnabled = providerSettings && providerSettings.enabled !== false;
    console.log(`[DEBUG] ${providerId} - isEnabled:`, isEnabled);

    if (isEnabled) {
      hasEnabledProviders = true;

      // Show the provider element first
      console.log(`[DEBUG] ${providerId} - Removing d-none class`);
      $providerElement.classList.remove('d-none');

      // Initialize FormManager for this provider before updating status
      console.log(`[DEBUG] ${providerId} - About to initialize FormManager`);
      initializeProviderForm(providerId);

      // Update provider status based on user connection
      const userConnection = userConnections[providerId];
      console.log(`[DEBUG] ${providerId} - userConnection:`, userConnection);
      console.log(`[DEBUG] ${providerId} - About to update provider status`);
      updateProviderStatus(providerId, userConnection, providerSettings);
    } else {
      // Hide disabled providers
      console.log(`[DEBUG] ${providerId} - Provider disabled, adding d-none class`);
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
  console.log(`[DEBUG] updateProviderStatus() called for ${providerId}`);
  console.log(`[DEBUG] ${providerId} - userConnection:`, userConnection);
  console.log(`[DEBUG] ${providerId} - userConnection truthy:`, !!userConnection);
  console.log(`[DEBUG] ${providerId} - userConnection.identity:`, userConnection?.identity);
  console.log(`[DEBUG] ${providerId} - providerSettings:`, providerSettings);

  const $status = document.getElementById(`${providerId}-connection-status`);
  const $description = document.getElementById(`${providerId}-connection-description`);
  const $form = document.getElementById(`connection-form-${providerId}`);
  const $connectButton = $form?.querySelector('button[data-action="connect"]');
  const $disconnectButton = $form?.querySelector('button[data-action="disconnect"]');

  console.log(`[DEBUG] ${providerId} - DOM elements found:`, {
    $status: !!$status,
    $description: !!$description,
    $form: !!$form,
    $connectButton: !!$connectButton,
    $disconnectButton: !!$disconnectButton
  });

  const isConnected = userConnection && userConnection.identity;
  console.log(`[DEBUG] ${providerId} - isConnected:`, isConnected);

  // Always show description on the left
  if ($description) {
    const defaultDescriptions = {
      google: 'Enable single sign-on with your Google account',
      discord: 'Connect to access Discord community features',
      github: 'Link your GitHub account for repository access',
      twitter: 'Share updates and connect with Twitter',
      facebook: 'Connect your Facebook account for social features'
    };

    // Use provider description or fallback to default
    const descriptionText = providerSettings?.description || defaultDescriptions[providerId] || `Connect your ${providerId.charAt(0).toUpperCase() + providerId.slice(1)} account`;
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
      // Not connected - hide status text
      $status.textContent = '';
      $status.classList.add('d-none');
    }
  }

  // Show/hide appropriate button
  if ($connectButton && $disconnectButton) {
    console.log(`[DEBUG] ${providerId} - Updating buttons. isConnected:`, isConnected);

    if (isConnected) {
      // Hide connect button, show disconnect button
      $connectButton.classList.add('d-none');
      $disconnectButton.classList.remove('d-none');
      console.log(`[DEBUG] ${providerId} - Showing disconnect button`);
    } else {
      // Show connect button, hide disconnect button
      $connectButton.classList.remove('d-none');
      $disconnectButton.classList.add('d-none');
      console.log(`[DEBUG] ${providerId} - Showing connect button`);
    }
  }
}

// Get display name for connection
function getConnectionDisplayName(connection) {
  if (!connection || !connection.identity) return 'Unknown';

  // Try different fields based on provider
  return connection.identity.global_name ||
         connection.identity.username ||
         connection.identity.name ||
         connection.identity.email ||
         connection.identity.id ||
         'Connected';
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
    console.log(`FormManager already initialized for ${providerId}`);
    return;
  }

  console.log(`Initializing FormManager for ${providerId}`);

  // Create new FormManager
  const formManager = new FormManager(`#${formId}`, {
    autoDisable: true,
    showSpinner: true
  });

  // Store the FormManager instance
  connectionForms.set(providerId, formManager);

  // Listen for state changes to update button after FormManager is ready
  formManager.addEventListener('statechange', (event) => {
    const { status } = event.detail;
    console.log(`[DEBUG] ${providerId} - FormManager state changed to:`, status);

    // When FormManager transitions to ready, update the button status
    if (status === 'ready') {
      console.log(`[DEBUG] ${providerId} - FormManager is ready, updating button status`);
      const userConnection = accountData?.oauth2?.[providerId];
      const providerSettings = appData?.oauth2?.[providerId];
      updateProviderStatus(providerId, userConnection, providerSettings);
    }
  });

  // Handle form submission
  formManager.addEventListener('submit', async (event) => {
    event.preventDefault();

    const { data, submitButton } = event.detail;
    const provider = data.provider;

    // Determine action from the clicked button's data-action attribute
    const action = submitButton?.getAttribute('data-action');

    console.log(`[DEBUG] ${providerId} - Form submitted. Action:`, action, 'Provider:', provider);

    try {
      if (action === 'connect') {
        await handleConnect(provider);
      } else if (action === 'disconnect') {
        const success = await handleDisconnect(provider);
        if (success) {
          // Reset form state and update UI after successful disconnect
          formManager.setFormState('ready');
          // Get provider settings to pass for description display
          const providerSettings = appData?.oauth2?.[provider];
          updateProviderStatus(provider, null, providerSettings);
        }
      }

      // Success - FormManager will handle state automatically
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

  // Get scope from provider settings (pass as array)
  const scope = provider.scope || [];

  const response = await authorizedFetch(getApiUrl(), {
    method: 'POST',
    timeout: 30000,
    response: 'json',
    tries: 2,
    body: {
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

  console.log('OAuth connect response:', response);

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

  // Get provider settings for scope (pass as array)
  const provider = appData?.oauth2?.[providerId] || {};
  const scope = provider.scope || [];

  const response = await authorizedFetch(getApiUrl(), {
    method: 'POST',
    timeout: 30000,
    response: 'json',
    tries: 2,
    body: {
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

  console.log('OAuth disconnect response:', response);

  if (response.success) {
    // Update local account data
    if (accountData.oauth2 && accountData.oauth2[providerId]) {
      delete accountData.oauth2[providerId];
    }

    // Return success
    return true;
  } else {
    throw new Error(response.message || 'Failed to disconnect');
  }
}

// Called when section is shown
export function onShow() {
  // Refresh connections display when section is shown
  if (accountData && appData) {
    displayConnections();
  }
}
