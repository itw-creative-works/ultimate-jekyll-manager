// Pricing calculations for checkout
import { state } from './state.js';

// Calculate prices
export function calculatePrices() {
  let basePrice;

  if (state.isSubscription) {
    basePrice = state.billingCycle === 'monthly'
      ? state.product.price_monthly
      : state.product.price_annually;
  } else {
    basePrice = state.product.price || 0;
  }

  state.subtotal = basePrice;
  const discountAmount = (state.subtotal * state.discountPercent) / 100;

  // Calculate total after discount
  const discountedTotal = state.subtotal - discountAmount;

  // Update UI
  document.getElementById('subtotal').textContent = `$${state.subtotal.toFixed(2)}`;
  document.getElementById('discount-amount').textContent = discountAmount.toFixed(2);

  // Show/hide discount row
  if (state.discountPercent > 0) {
    document.getElementById('discount-row').classList.remove('d-none');
  } else {
    document.getElementById('discount-row').classList.add('d-none');
  }

  // Handle trial discount
  const $trialDiscountRow = document.getElementById('trial-discount-row');
  if (state.hasFreeTrial && state.isSubscription) {
    // Show trial discount (full discounted amount)
    $trialDiscountRow.classList.remove('d-none');
    document.getElementById('trial-discount-amount').textContent = discountedTotal.toFixed(2);
    state.total = 0; // Free trial means $0 due today
    document.getElementById('total-price').textContent = '$0.00';
  } else {
    // Hide trial discount
    $trialDiscountRow.classList.add('d-none');
    state.total = discountedTotal;
    document.getElementById('total-price').textContent = `$${discountedTotal.toFixed(2)}`;
  }
}