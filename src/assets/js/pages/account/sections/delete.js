// Delete account section module
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

  // Initialize FormManager
  formManager = new FormManager('#delete-account-form', {
    autoDisable: true,
    showSpinner: true,
    validateOnSubmit: false, // We'll handle validation manually due to custom confirmation flow
    allowMultipleSubmissions: false,
    resetOnSuccess: false,
    submitButtonLoadingText: 'Deleting account...',
    initialState: 'ready',
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

  // Listen to FormManager submit event
  formManager.addEventListener('submit', handleFormSubmit);
}

// Handle form submission
async function handleFormSubmit(event) {
  // Prevent default FormManager submission
  event.preventDefault();

  const formData = event.detail.data;
  const $checkbox = document.getElementById('delete-confirm-checkbox');

  // Check if checkbox is checked
  if (!$checkbox.checked) {
    formManager.showError('Please confirm that you understand this action is permanent.');
    formManager.setFormState('ready');
    return;
  }

  // Show confirmation dialog
  const confirmMessage = `Are you absolutely sure you want to delete your account?\n\nThis action CANNOT be undone.\n\nType "DELETE" to confirm:`;
  const userInput = prompt(confirmMessage);

  if (userInput !== 'DELETE') {
    formManager.showError('Account deletion cancelled. You must type "DELETE" exactly to confirm.');
    formManager.setFormState('ready');
    return;
  }

  // Final confirmation
  const finalConfirm = confirm('This is your last chance to cancel.\n\nAre you sure you want to permanently delete your account?');

  if (!finalConfirm) {
    formManager.setFormState('ready');
    return;
  }

  try {
    // Send delete request to server
    const response = await authorizedFetch(webManager.getApiUrl(), {
      method: 'POST',
      timeout: 30000,
      response: 'json',
      tries: 2,
      body: {
        command: 'user:delete',
        payload: {
          reason: formData.reason || '',
          confirmed: true
        }
      }
    });

    console.log('Delete account response:', response);

    if (response.success) {
      // Show success message
      formManager.showSuccess('Your account has been successfully deleted. You will now be signed out.');

      // Sign out the user
      await webManager.auth().signOut();

      // Redirect to home page
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    } else {
      throw new Error(response.message || 'Failed to delete account');
    }
  } catch (error) {
    console.error('Failed to delete account:', error);
    formManager.showError(`Failed to delete account: ${error.message}`);
    formManager.setFormState('ready');
  }
}

// Load delete section data (if needed)
export async function loadData(account) {
  // No specific data to load for delete section
  // Could potentially show account age or other info here
}

// Called when section is shown
export function onShow() {

}
