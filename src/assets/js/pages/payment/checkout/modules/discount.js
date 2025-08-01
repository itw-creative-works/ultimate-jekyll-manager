// Discount logic for checkout
import { config, state } from './state.js';
import { updateAllUI } from './ui.js';

// Hide all discount messages
function hideAllDiscountMessages() {
  document.getElementById('discount-message-loading').classList.add('d-none');
  document.getElementById('discount-message-success').classList.add('d-none');
  document.getElementById('discount-message-error').classList.add('d-none');
}

// Apply discount code
export function applyDiscountCode() {
  const codeInput = document.getElementById('discount-code');
  const applyBtn = document.getElementById('apply-discount');
  const code = codeInput.value.trim().toUpperCase();

  if (code === '') {
    hideAllDiscountMessages();
    document.getElementById('error-text').textContent = 'Please enter a discount code';
    document.getElementById('discount-message-error').classList.remove('d-none');
    return;
  }

  // Show loading state
  applyBtn.disabled = true;
  applyBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
  hideAllDiscountMessages();
  document.getElementById('discount-message-loading').classList.remove('d-none');

  // Simulate API check with timeout
  setTimeout(() => {
    applyBtn.disabled = false;
    applyBtn.textContent = 'Apply';
    hideAllDiscountMessages();

    if (config.discountCodes[code]) {
      state.discountPercent = config.discountCodes[code];

      document.getElementById('confirmation-text').textContent = `Discount applied: ${state.discountPercent}% off`;
      document.getElementById('discount-message-success').classList.remove('d-none');

      // Update discount percent display
      document.getElementById('discount-percent').textContent = `${state.discountPercent}%`;

      updateAllUI();
    } else {
      document.getElementById('error-text').textContent = 'Invalid discount code';
      document.getElementById('discount-message-error').classList.remove('d-none');

      // Reset discount
      state.discountPercent = 0;
      updateAllUI();
    }
  }, 1000);
}

// Auto-apply welcome coupon
export function autoApplyWelcomeCoupon() {
  const discountInput = document.getElementById('discount-code');
  if (discountInput) {
    discountInput.value = 'WELCOME15';
    // Automatically apply the coupon
    applyDiscountCode();
  }
}