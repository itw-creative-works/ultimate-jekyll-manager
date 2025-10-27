// UI Bindings Module - Refactored to use webManager.bindings()
// This module replaces direct DOM manipulation with the bindings system

import { state, raw } from './state.js';
import { calculatePrices } from './pricing.js';

// Build state from raw data
// This is the ONLY place we transform raw data into the bindings structure
export function buildStateFromRaw(webManager) {
  const prices = calculatePrices(raw);

  // Calculate savings for annual plan
  const monthlyAnnual = raw.product?.price_monthly ? raw.product.price_monthly * 12 : 0;
  const annuallyPrice = raw.product?.price_annually || 0;
  const savingsPercent = monthlyAnnual > 0 ? Math.round(((monthlyAnnual - annuallyPrice) / monthlyAnnual) * 100) : 0;

  // Get billing cycle text
  const billingCycleText = raw.billingCycle === 'monthly' ? 'monthly' : 'annually';

  // Format renewal date for terms
  const renewalDate = new Date();
  const daysToAdd = raw.billingCycle === 'monthly' ? 30 : 365;
  renewalDate.setDate(renewalDate.getDate() + daysToAdd);
  const formattedRenewalDate = renewalDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  // Get auth data
  const user = webManager.auth().getUser();

  // Update state directly with formatted bindings data
  state.checkout.product.name = raw.product?.name || 'Loading...';
  state.checkout.product.description = raw.product?.description || 'Loading product details...';
  state.checkout.product.isSubscription = raw.product?.is_subscription || false;

  state.checkout.pricing.monthlyPrice = raw.product?.price_monthly ? `$${raw.product.price_monthly.toFixed(2)}` : '$--';
  state.checkout.pricing.annualMonthlyRate = raw.product?.price_annually ? `$${(raw.product.price_annually / 12).toFixed(2)}` : '$--';
  state.checkout.pricing.savingsBadge = savingsPercent > 0 ? `Save ${savingsPercent}%` : '';
  state.checkout.pricing.showSavingsBadge = savingsPercent > 0;
  state.checkout.pricing.billingCyclePaymentText = raw.product ?
    (raw.billingCycle === 'monthly'
      ? `$${raw.product.price_monthly?.toFixed(2) || '--'} monthly`
      : `$${raw.product.price_annually?.toFixed(2) || '--'} annually`)
    : '$-- monthly';
  state.checkout.pricing.productPrice = prices.displayPrice || '$--';
  state.checkout.pricing.subtotal = prices.subtotal ? `$${prices.subtotal.toFixed(2)}` : '$--';
  state.checkout.pricing.total = prices.total !== null ? `$${prices.total.toFixed(2)}` : '$--';
  state.checkout.pricing.recurringAmount = prices.recurring ? `$${prices.recurring.toFixed(2)}` : '$--';
  state.checkout.pricing.recurringPeriod = billingCycleText;
  state.checkout.pricing.showTerms = raw.product?.is_subscription || false;
  state.checkout.pricing.termsText = (raw.product?.is_subscription && raw.product) ?
    `Your ${billingCycleText} subscription will start today and renew on ${formattedRenewalDate} for $${prices.recurring?.toFixed(2) || '--'} plus applicable tax. Cancel anytime.`
    : '';

  const hasFreeTrial = raw.product?.has_free_trial || false;
  state.checkout.trial.show = hasFreeTrial && (raw.product?.is_subscription || false);
  state.checkout.trial.hasFreeTrial = hasFreeTrial && (raw.product?.is_subscription || false) && prices.total === 0;
  state.checkout.trial.message = hasFreeTrial ?
    `Start your ${raw.product?.trial_days || 7}-day free trial today!` : '';
  state.checkout.trial.discountAmount = hasFreeTrial && prices.trialDiscountAmount ?
    prices.trialDiscountAmount.toFixed(2) : '0.00';

  state.checkout.discount.hasDiscount = raw.discountPercent > 0;
  state.checkout.discount.percent = raw.discountPercent > 0 ? `${raw.discountPercent}%` : '';
  state.checkout.discount.amount = prices.discountAmount ? prices.discountAmount.toFixed(2) : '0.00';

  state.auth.user.email = user?.email || '';
}

// Update all UI through bindings
// Rebuilds state from raw data, then passes COMPLETE object
export function updateAllUI(webManager) {
  // Build state from raw data first
  buildStateFromRaw(webManager);

  console.log('🔄 Updating checkout bindings with data:', state);

  webManager.bindings().update(state);
}

// Handle billing cycle change
export function handleBillingCycleChange(newCycle, webManager) {
  if (newCycle && newCycle !== raw.billingCycle) {
    raw.billingCycle = newCycle;
  }
  updateAllUI(webManager);
}

// Show error message
export function showError(message, webManager) {
  state.checkout.error.show = true;
  state.checkout.error.message = message;
  webManager.bindings().update(state);
}

// Hide error
export function hideError(webManager) {
  state.checkout.error.show = false;
  state.checkout.error.message = '';
  webManager.bindings().update(state);
}

// Update payment button visibility based on processor availability
export function updatePaymentButtonVisibility(paymentManager) {
  const availableMethods = paymentManager.getAvailablePaymentMethods();

  // Update state with payment methods
  state.checkout.paymentMethods.card = paymentManager.isPaymentMethodAvailable('card');
  state.checkout.paymentMethods.paypal = paymentManager.isPaymentMethodAvailable('paypal');
  state.checkout.paymentMethods.applePay = paymentManager.isPaymentMethodAvailable('apple-pay');
  state.checkout.paymentMethods.googlePay = paymentManager.isPaymentMethodAvailable('google-pay');
  state.checkout.paymentMethods.crypto = paymentManager.isPaymentMethodAvailable('crypto');

  console.log('Payment methods set in state. Available methods:', availableMethods.map(m => m.id));
}

// Show/hide discount loading state
export function showDiscountLoading(show, webManager) {
  state.checkout.discount.loading = show;
  state.checkout.discount.success = false;
  state.checkout.discount.error = false;
  webManager.bindings().update(state);
}

// Show discount success
export function showDiscountSuccess(message, webManager) {
  state.checkout.discount.loading = false;
  state.checkout.discount.success = true;
  state.checkout.discount.error = false;
  state.checkout.discount.successMessage = message || 'Discount applied';

  // Rebuild state from raw (to update pricing with discount)
  buildStateFromRaw(webManager);
  webManager.bindings().update(state);
}

// Show discount error
export function showDiscountError(message, webManager) {
  state.checkout.discount.loading = false;
  state.checkout.discount.success = false;
  state.checkout.discount.error = true;
  state.checkout.discount.errorMessage = message || 'Invalid discount code';
  webManager.bindings().update(state);
}

// Hide all discount messages
export function hideDiscountMessages(webManager) {
  state.checkout.discount.loading = false;
  state.checkout.discount.success = false;
  state.checkout.discount.error = false;
  webManager.bindings().update(state);
}

// Initialize checkout UI
export function initializeCheckoutUI() {
  console.log('🚀 Initializing checkout UI');
  // State is already initialized with default values
}