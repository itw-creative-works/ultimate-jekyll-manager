/**
 * API Keys Section JavaScript
 */

// Libraries
import { FormManager } from '__main_assets__/js/libs/form-manager.js';
import authorizedFetch from '__main_assets__/js/libs/authorized-fetch.js';

let webManager = null;

// Initialize API Keys section
export function init(wm) {
  webManager = wm;
  setupButtons();
  setupResetApiKeyForm();
}

// Load API Keys data
export function loadData(account) {
  if (!account) {
    return;
  }

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
  const formManager = new FormManager('#reset-api-key-form', {
    allowResubmit: false,
    submittingText: 'Resetting...',
    submittedText: 'Reset!',
  });

  formManager.on('submit', async () => {
    // 1ms wait for dialog to appear properly
    await new Promise(resolve => setTimeout(resolve, 1));

    // Show confirmation dialog
    if (!confirm('Are you sure you want to reset your API key? This will invalidate your current key and any applications using it will stop working.')) {
      throw new Error('API key reset cancelled.');
    }

    // Get server API URL
    const serverApiURL = `${webManager.getApiUrl()}/backend-manager`;

    // Make API call to reset API key
    const response = await authorizedFetch(serverApiURL, {
      method: 'POST',
      timeout: 30000,
      response: 'json',
      tries: 2,
      body: {
        command: 'user:regenerate-api-keys',
      },
    });

    if (!response.privateKey) {
      throw new Error(response.message || 'Failed to reset API key');
    }

    // Update the displayed API key
    updateApiKey(response.privateKey);

    // Show success message
    formManager.showSuccess('API key has been reset successfully!');
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
    const $text = $copyBtn.querySelector('.button-text');
    const originalText = $text.textContent;

    $text.textContent = 'Copied!';
    $copyBtn.classList.remove('btn-outline-adaptive');
    $copyBtn.classList.add('btn-success');

    // Reset after 2 seconds
    setTimeout(() => {
      $text.textContent = originalText;
      $copyBtn.classList.remove('btn-success');
      $copyBtn.classList.add('btn-outline-adaptive');
    }, 2000);
  } catch (err) {
    console.error('Failed to copy API key:', err);
    webManager.utilities().showNotification('Failed to copy API key', 'danger');
  }
}
