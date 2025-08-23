// API Keys section module
import { FormManager } from '__main_assets__/js/libs/form-manager.js';
import fetch from 'wonderful-fetch';

let webManager = null;
let resetApiKeyFormManager = null;

// Initialize API Keys section
export function init(wm) {
  webManager = wm;
  setupButtons();
  setupResetApiKeyForm();
}

// Load API Keys data
export function loadData(account) {
  if (!account) return;

  // Update API key display
  updateApiKey(account.api?.privateKey);
}

// Update API key display
function updateApiKey(apiKey) {
  const $apiKeyInput = document.getElementById('api-key-input');

  if ($apiKeyInput) {
    if (apiKey) {
      $apiKeyInput.value = apiKey;
    } else {
      $apiKeyInput.value = 'No API key generated';
    }
  }
}

// Setup button handlers
function setupButtons() {
  // Copy API key button
  const $copyBtn = document.getElementById('copy-api-key-btn');
  if ($copyBtn) {
    $copyBtn.addEventListener('click', handleCopyApiKey);
  }
}

// Setup reset API key form
function setupResetApiKeyForm() {
  // Initialize FormManager
  resetApiKeyFormManager = new FormManager('#reset-api-key-form', {
    autoDisable: true,
    showSpinner: true,
    allowMultipleSubmit: false,
    submitButtonLoadingText: 'Resetting...'
  });

  // Handle form submission
  resetApiKeyFormManager.addEventListener('submit', async (event) => {
    event.preventDefault();

    // 1ms wait
    await new Promise(resolve => setTimeout(resolve, 1));

    // Show confirmation dialog
    if (!confirm('Are you sure you want to reset your API key? This will invalidate your current key and any applications using it will stop working.')) {
      return resetApiKeyFormManager.setFormState('ready');
    }

    try {
      await handleResetApiKeySubmit();
      // Success - FormManager will handle state automatically
      resetApiKeyFormManager.setFormState('ready');
    } catch (error) {
      // Manually show error and reset form state
      resetApiKeyFormManager.showError(error);
      resetApiKeyFormManager.setFormState('ready');
    }
  });
}

// Handle copy API key
async function handleCopyApiKey() {
  const $apiKeyInput = document.getElementById('api-key-input');
  const $copyBtn = document.getElementById('copy-api-key-btn');

  if (!$apiKeyInput || !$apiKeyInput.value || $apiKeyInput.value === 'No API key generated') {
    webManager.utilities().showNotification('No API key to copy', 'warning');
    return;
  }

  try {
    // Use webManager's clipboard utility
    await webManager.utilities().clipboardCopy($apiKeyInput);

    // Update button text temporarily
    const originalHTML = $copyBtn.innerHTML;
    $copyBtn.innerHTML = '<i class="fa-solid fa-check me-2"></i><span class="button-text">Copied!</span>';
    $copyBtn.classList.remove('btn-outline-adaptive');
    $copyBtn.classList.add('btn-success');

    // Reset after 2 seconds
    setTimeout(() => {
      $copyBtn.innerHTML = originalHTML;
      $copyBtn.classList.remove('btn-success');
      $copyBtn.classList.add('btn-outline-adaptive');
    }, 2000);

  } catch (err) {
    console.error('Failed to copy API key:', err);
    webManager.utilities().showNotification('Failed to copy API key', 'danger');
  }
}

// Handle reset API key form submission
async function handleResetApiKeySubmit() {
  // Get authentication token
  const token = await webManager.auth().getIdToken();

  // Get server API URL
  const serverApiURL = webManager.getApiUrl() + '/backend-manager';

  // Make API call to reset API key
  const response = await fetch(serverApiURL, {
    method: 'POST',
    timeout: 30000,
    response: 'json',
    tries: 2,
    body: {
      authenticationToken: token,
      command: 'user:regenerate-api-keys',
    },
  });

  if (response.privateKey) {
    // Update the displayed API key
    updateApiKey(response.privateKey);

    // Show success message
    webManager.utilities().showNotification('API key has been reset successfully', 'success');
  } else {
    throw new Error(response.message || 'Failed to reset API key');
  }
}

