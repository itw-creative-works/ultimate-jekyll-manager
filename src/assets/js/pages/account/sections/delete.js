/**
 * Delete Account Section JavaScript
 */

// Libraries
import { FormManager } from '__main_assets__/js/libs/form-manager.js';
import authorizedFetch from '__main_assets__/js/libs/authorized-fetch.js';

let webManager = null;
let formManager = null;

// Initialize delete section
export async function init(wm) {
  webManager = wm;
  setupDeleteAccountForm();
}

// Setup delete account form
function setupDeleteAccountForm() {
  const $form = document.getElementById('delete-account-form');
  const $checkbox = document.getElementById('delete-confirm-checkbox');
  const $deleteBtn = document.getElementById('delete-account-btn');
  const $cancelBtn = document.getElementById('cancel-delete-btn');

  if (!$form || !$checkbox || !$deleteBtn) {
    return;
  }

  formManager = new FormManager('#delete-account-form', {
    allowResubmit: false,
    submittingText: 'Deleting account...',
    submittedText: 'Account Deleted!',
  });

  // Enable/disable delete button based on checkbox
  $checkbox.addEventListener('change', (e) => {
    $deleteBtn.disabled = !e.target.checked;
  });

  // Handle cancel button
  if ($cancelBtn) {
    $cancelBtn.addEventListener('click', () => {
      // Navigate back to profile
      window.location.hash = 'profile';
    });
  }

  formManager.on('submit', async ({ data }) => {
    // Check if checkbox is checked
    if (!$checkbox.checked) {
      throw new Error('Please confirm that you understand this action is permanent.');
    }

    // 1ms wait for dialog to appear properly
    await new Promise(resolve => setTimeout(resolve, 1));

    // Show confirmation dialog
    const confirmMessage = `Are you absolutely sure you want to delete your account?\n\nThis action CANNOT be undone.\n\nType "DELETE" to confirm:`;
    const userInput = prompt(confirmMessage);

    if (userInput !== 'DELETE') {
      throw new Error('Account deletion cancelled. You must type "DELETE" exactly to confirm.');
    }

    // Send delete request to server
    const response = await authorizedFetch(`${webManager.getApiUrl()}/backend-manager/user`, {
      method: 'DELETE',
      timeout: 30000,
      response: 'json',
      tries: 2,
      body: {
        reason: data.reason || '',
        confirmed: true,
      },
    });

    console.log('Delete account response:', response);

    if (!response.success) {
      throw new Error(response.message || 'Failed to delete account');
    }

    // Show success message
    formManager.showSuccess('Your account has been successfully deleted. You will now be signed out.');

    // Sign out the user
    await webManager.auth().signOut();

    // Redirect to home page
    setTimeout(() => {
      window.location.href = '/';
    }, 1500);
  });
}

// Load delete section data (if needed)
export async function loadData() {
  // No specific data to load for delete section
}

// Called when section is shown
export function onShow() {
  // Nothing needed
}
