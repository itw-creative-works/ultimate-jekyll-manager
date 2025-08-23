// Notifications section module

let webManager = null;

// Initialize notifications section
export function init(wm) {
  webManager = wm;
  setupNotificationToggles();
}

// Load notifications data
export function loadData(account) {
  if (!account) return;
  
  // Load notification preferences from account
  const preferences = account.preferences?.notifications || {};
  
  // Set toggle states
  setToggleState('marketing-emails', preferences.marketing !== false);
  setToggleState('security-emails', preferences.security !== false);
  setToggleState('product-emails', preferences.product === true);
}

// Setup notification toggles
function setupNotificationToggles() {
  const toggles = [
    'marketing-emails',
    'security-emails',
    'product-emails'
  ];
  
  toggles.forEach(toggleId => {
    const $toggle = document.getElementById(toggleId);
    if ($toggle) {
      $toggle.addEventListener('change', handleToggleChange);
    }
  });
}

// Handle toggle change
async function handleToggleChange(event) {
  const toggleId = event.target.id;
  const isEnabled = event.target.checked;
  
  try {
    // Map toggle ID to preference key
    const preferenceKey = toggleId.replace('-emails', '');
    
    // Update preferences
    await updateNotificationPreference(preferenceKey, isEnabled);
    
    // Show feedback
    const actionText = isEnabled ? 'enabled' : 'disabled';
    showToast(`${getToggleLabel(toggleId)} ${actionText}`, 'success');
    
  } catch (error) {
    console.error('Failed to update notification preference:', error);
    
    // Revert toggle state
    event.target.checked = !isEnabled;
    
    showToast('Failed to update notification preferences. Please try again.', 'danger');
  }
}

// Update notification preference
async function updateNotificationPreference(key, value) {
  // This would call the appropriate API endpoint
  // For now, just update locally
  const preferences = {
    notifications: {
      [key]: value
    }
  };
  
  // await webManager.auth().updatePreferences(preferences);
  console.log('Updating notification preference:', key, value);
}

// Set toggle state
function setToggleState(toggleId, isEnabled) {
  const $toggle = document.getElementById(toggleId);
  if ($toggle) {
    $toggle.checked = isEnabled;
  }
}

// Get toggle label for feedback
function getToggleLabel(toggleId) {
  switch(toggleId) {
    case 'marketing-emails':
      return 'Marketing emails';
    case 'security-emails':
      return 'Security alerts';
    case 'product-emails':
      return 'Product updates';
    default:
      return 'Notifications';
  }
}

// Show toast notification
function showToast(message, type = 'info') {
  // Create toast element
  const $toast = document.createElement('div');
  $toast.className = `toast align-items-center text-bg-${type} border-0 position-fixed bottom-0 end-0 m-3`;
  $toast.setAttribute('role', 'alert');
  $toast.setAttribute('aria-live', 'assertive');
  $toast.setAttribute('aria-atomic', 'true');
  $toast.style.zIndex = '9999';
  
  $toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        ${message}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;
  
  // Add to page
  document.body.appendChild($toast);
  
  // Initialize and show toast
  if (window.bootstrap && window.bootstrap.Toast) {
    const toast = new window.bootstrap.Toast($toast);
    toast.show();
    
    // Remove after hidden
    $toast.addEventListener('hidden.bs.toast', () => {
      $toast.remove();
    });
  } else {
    // Fallback if Bootstrap JS not available
    setTimeout(() => {
      $toast.remove();
    }, 3000);
  }
}