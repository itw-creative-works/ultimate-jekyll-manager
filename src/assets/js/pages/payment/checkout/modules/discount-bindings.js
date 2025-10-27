// Discount logic for checkout - Refactored to use bindings
import { config, state } from './state.js';
import {
  updatePricing,
  showDiscountLoading,
  showDiscountSuccess,
  showDiscountError,
  hideDiscountMessages
} from './ui-bindings.js';

// Apply discount code
export function applyDiscountCode(webManager) {
  const codeInput = document.getElementById('discount-code');
  const applyBtn = document.getElementById('apply-discount');
  const code = codeInput.value.trim().toUpperCase();

  if (code === '') {
    showDiscountError('Please enter a discount code', webManager);
    return;
  }

  // Show loading state
  applyBtn.disabled = true;
  applyBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
  showDiscountLoading(true, webManager);

  // Simulate API check with timeout
  setTimeout(() => {
    applyBtn.disabled = false;
    applyBtn.textContent = 'Apply';

    if (config.discountCodes[code]) {
      state.discountPercent = config.discountCodes[code];
      showDiscountSuccess(`Discount applied: ${state.discountPercent}% off`, webManager);
    } else {
      // Reset discount
      state.discountPercent = 0;
      showDiscountError('Invalid discount code', webManager);
    }
  }, 1000);
}

// Auto-apply welcome coupon
export function autoApplyWelcomeCoupon(webManager) {
  const discountInput = document.getElementById('discount-code');
  if (discountInput) {
    discountInput.value = 'WELCOME15';
    // Automatically apply the coupon
    applyDiscountCode(webManager);
  }
}