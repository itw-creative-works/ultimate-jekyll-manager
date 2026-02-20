// Discount code logic for checkout
import { state, DISCOUNT_CODES } from './state.js';

// Apply a discount code
// updateUI callback decouples this from the bindings system
export async function applyDiscountCode(code, updateUI) {
  code = (code || '').trim().toUpperCase();

  if (!code) {
    state.discountUI = { loading: false, success: false, error: true, message: 'Please enter a discount code' };
    updateUI();
    return;
  }

  // Show loading
  state.discountUI = { loading: true, success: false, error: false, message: '' };
  updateUI();

  // Simulate API delay (TODO: replace with real API call)
  await new Promise(resolve => setTimeout(resolve, 800));

  if (DISCOUNT_CODES[code]) {
    state.discountPercent = DISCOUNT_CODES[code];
    state.discountUI = { loading: false, success: true, error: false, message: `Discount applied: ${state.discountPercent}% off` };
  } else {
    state.discountPercent = 0;
    state.discountUI = { loading: false, success: false, error: true, message: 'Invalid discount code' };
  }

  updateUI();
}

// Auto-apply welcome coupon
export function autoApplyWelcomeCoupon(formManager, updateUI) {
  formManager.setData({ discount: 'WELCOME15' });
  applyDiscountCode('WELCOME15', updateUI);
}
