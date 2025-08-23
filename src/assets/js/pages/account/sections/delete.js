// Delete account section module
import fetch from 'wonderful-fetch';

let webManager = null;

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
  const $reason = document.getElementById('delete-reason');

  if (!$form || !$checkbox || !$deleteBtn) return;

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

  // Handle form submission
  $form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Check if checkbox is checked
    if (!$checkbox.checked) {
      alert('Please confirm that you understand this action is permanent.');
      return;
    }

    // Show confirmation dialog
    const confirmMessage = `Are you absolutely sure you want to delete your account?\n\nThis action CANNOT be undone.\n\nType "DELETE" to confirm:`;
    const userInput = prompt(confirmMessage);

    if (userInput !== 'DELETE') {
      alert('Account deletion cancelled. You must type "DELETE" exactly to confirm.');
      return;
    }

    // Final confirmation
    const finalConfirm = confirm('This is your last chance to cancel.\n\nAre you sure you want to permanently delete your account?');
    
    if (!finalConfirm) {
      return;
    }

    // Disable button and show loading
    $deleteBtn.disabled = true;
    $deleteBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span><span class="button-text">Deleting account...</span>`;

    try {
      // Get API base URL
      const apiBaseUrl = webManager.isDevelopment()
        ? 'http://localhost:5002'
        : 'https://api.itwcreativeworks.com';

      // Send delete request to server
      const response = await fetch(`${apiBaseUrl}/account/delete`, {
        method: 'POST',
        response: 'json',
        body: {
          reason: $reason.value || '',
          confirmed: true
        }
      });

      console.log('Delete account response:', response);

      if (response.success) {
        // Show success message
        alert('Your account has been successfully deleted. You will now be signed out.');
        
        // Sign out the user
        await webManager.auth().signOut();
        
        // Redirect to home page
        window.location.href = '/';
      } else {
        throw new Error(response.message || 'Failed to delete account');
      }
    } catch (error) {
      console.error('Failed to delete account:', error);
      alert(`Failed to delete account: ${error.message}`);
      
      // Re-enable button
      $deleteBtn.disabled = !$checkbox.checked;
      $deleteBtn.innerHTML = `<i class="fa-solid fa-trash fa-sm me-2"></i><span class="button-text">Delete My Account Permanently</span>`;
    }
  });
}

// Load delete section data (if needed)
export async function loadData(account) {
  // No specific data to load for delete section
  // Could potentially show account age or other info here
}

// Called when section is shown
export function onShow() {
  // Reset form when shown
  const $form = document.getElementById('delete-account-form');
  const $checkbox = document.getElementById('delete-confirm-checkbox');
  const $deleteBtn = document.getElementById('delete-account-btn');
  const $reason = document.getElementById('delete-reason');

  if ($form) {
    $form.reset();
  }

  if ($checkbox) {
    $checkbox.checked = false;
  }

  if ($deleteBtn) {
    $deleteBtn.disabled = true;
  }

  if ($reason) {
    $reason.value = '';
  }
}