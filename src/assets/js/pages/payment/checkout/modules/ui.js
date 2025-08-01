// UI update functions for checkout
import { state } from './state.js';
import { calculatePrices } from './pricing.js';

// Unified UI update function - handles all state changes
export function updateAllUI() {
  // Update product info
  document.getElementById('product-name').textContent = state.product.name;
  document.getElementById('product-description').textContent = state.product.description;

  if (state.isSubscription) {
    // Show subscription toggle
    document.getElementById('subscription-toggle').classList.remove('d-none');

    // Update prices in toggle buttons
    document.getElementById('monthly-price-lg').textContent = `$${state.product.price_monthly}.00`;
    document.getElementById('annually-price-lg').textContent = `$${state.product.price_annually}.00`;

    // Calculate and update savings percentage
    const monthlyAnnual = state.product.price_monthly * 12;
    const annuallyPrice = state.product.price_annually;
    const savingsPercent = Math.round(((monthlyAnnual - annuallyPrice) / monthlyAnnual) * 100);

    // Update savings badge text
    const savingsBadge = document.getElementById('savings-badge');
    if (savingsBadge) {
      savingsBadge.textContent = `Save ${savingsPercent}%`;
    }

    // Get current pricing
    const basePrice = state.billingCycle === 'monthly'
      ? state.product.price_monthly
      : state.product.price_annually;

    // Calculate discounted price
    const discountAmount = (basePrice * state.discountPercent) / 100;
    const discountedPrice = basePrice - discountAmount;

    const period = state.billingCycle === 'monthly' ? '/mo' : '/yr';
    const periodText = state.billingCycle === 'monthly' ? 'monthly' : 'annual';

    // Update product price display (show discounted price)
    document.getElementById('product-price').textContent = `$${discountedPrice.toFixed(2)}${period}`;

    // Update recurring amount display (show discounted price)
    document.getElementById('recurring-amount').innerHTML =
      `$${discountedPrice.toFixed(2)} <span id="recurring-period">${periodText}</span>`;

    // Update button visual states
    updateBillingCycleButtons();

    // Update trial badge based on current state
    updateTrialBadge();

    // Update complete purchase button text based on trial
    const purchaseBtn = document.getElementById('complete-purchase');
    if (state.hasFreeTrial) {
      purchaseBtn.textContent = 'Start Free Trial';
    } else {
      purchaseBtn.textContent = 'Complete Purchase';
    }

    // Update subscription terms
    updateSubscriptionTerms();

    // Calculate and update all pricing
    calculatePrices();
  } else {
    // One-time purchase
    document.getElementById('product-price').textContent = `$${state.product.price}`;
    calculatePrices();
  }
}

// Update billing cycle button visual states
function updateBillingCycleButtons() {
  const monthlyLabel = document.querySelector('label[for="monthly"]');
  const annuallyLabel = document.querySelector('label[for="annually"]');
  const monthlyCheckmark = monthlyLabel?.querySelector('span.rounded-circle');
  const annuallyCheckmark = annuallyLabel?.querySelector('span.rounded-circle');

  if (monthlyLabel && annuallyLabel && monthlyCheckmark && annuallyCheckmark) {
    // Remove any existing selected state
    monthlyLabel.classList.remove('billing-selected');
    annuallyLabel.classList.remove('billing-selected');

    if (state.billingCycle === 'monthly') {
      // Monthly is selected
      document.getElementById('monthly').checked = true;
      monthlyLabel.classList.add('billing-selected');
      monthlyCheckmark.className = 'bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center';
      annuallyCheckmark.className = 'bg-secondary bg-opacity-25 text-secondary rounded-circle d-inline-flex align-items-center justify-content-center';
    } else {
      // Annually is selected
      document.getElementById('annually').checked = true;
      annuallyLabel.classList.add('billing-selected');
      annuallyCheckmark.className = 'bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center';
      monthlyCheckmark.className = 'bg-secondary bg-opacity-25 text-secondary rounded-circle d-inline-flex align-items-center justify-content-center';
    }
  }
}

// Update trial badge
function updateTrialBadge() {
  const trialBadge = document.getElementById('trial-badge');
  const trialMessage = document.getElementById('trial-message');

  if (state.hasFreeTrial) {
    trialBadge.classList.remove('d-none');
    trialMessage.textContent = `Start with a ${state.product.free_trial_days}-day free trial`;
  } else {
    trialBadge.classList.add('d-none');
  }
}

// Update subscription terms text
export function updateSubscriptionTerms() {
  const termsDiv = document.getElementById('subscription-terms');
  const termsText = document.getElementById('terms-text');

  if (!state.isSubscription) {
    termsDiv.classList.add('d-none');
    return;
  }

  if (state.hasFreeTrial) {
    // Calculate trial end date
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + state.product.free_trial_days);

    const formattedDate = trialEndDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const basePrice = state.billingCycle === 'monthly'
      ? state.product.price_monthly
      : state.product.price_annually;

    // Apply discount to the recurring price (always calculate, even if 0%)
    const discountAmount = (basePrice * state.discountPercent) / 100;
    const discountedPrice = basePrice - discountAmount;

    const periodText = state.billingCycle === 'monthly' ? 'monthly' : 'annual';

    termsText.textContent = `You won't be charged for your free trial. On ${formattedDate}, your ${periodText} subscription will start and you'll be charged $${discountedPrice.toFixed(2)} plus applicable tax. Cancel anytime before then.`;
    termsDiv.classList.remove('d-none');
  } else {
    // No trial - show regular subscription terms with renewal date
    const periodText = state.billingCycle === 'monthly' ? 'monthly' : 'annual';
    const basePrice = state.billingCycle === 'monthly'
      ? state.product.price_monthly
      : state.product.price_annually;

    // Apply discount to the recurring price (always calculate, even if 0%)
    const discountAmount = (basePrice * state.discountPercent) / 100;
    const discountedPrice = basePrice - discountAmount;

    // Calculate next renewal date (30 days for monthly, 365 days for annual)
    const renewalDate = new Date();
    const daysToAdd = state.billingCycle === 'monthly' ? 30 : 365;
    renewalDate.setDate(renewalDate.getDate() + daysToAdd);

    const formattedRenewalDate = renewalDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    termsText.textContent = `Your ${periodText} subscription will start today and renew on ${formattedRenewalDate} for $${discountedPrice.toFixed(2)} plus applicable tax. Cancel anytime.`;
    termsDiv.classList.remove('d-none');
  }
}

// Switch payment method
export function switchPaymentMethod(method) {
  // Hide all payment forms
  document.querySelectorAll('.payment-form').forEach(form => {
    form.classList.add('d-none');
  });

  // Show selected payment form
  document.getElementById(`payment-form-${method}`).classList.remove('d-none');
}

// Centralized billing cycle change handler
export function handleBillingCycleChange(newCycle = null) {
  // Update state if a specific cycle is provided
  if (newCycle && newCycle !== state.billingCycle) {
    state.billingCycle = newCycle;
  }

  // Update all UI elements
  updateAllUI();
}

// Show error message
export function showError(message) {
  const errorContainer = document.getElementById('checkout-error-container');
  const errorMessage = document.getElementById('checkout-error-message');
  const checkoutContent = document.getElementById('checkout-content');

  if (errorContainer && errorMessage && checkoutContent) {
    errorMessage.textContent = message;
    errorContainer.classList.remove('d-none');
    checkoutContent.classList.add('d-none');
  }
}

// Hide preloader with animation
export function hidePreloader() {
  const preloader = document.getElementById('checkout-preloader');
  if (preloader) {
    preloader.style.opacity = '0';
    preloader.style.transition = 'opacity 0.3s ease-out';
    setTimeout(() => {
      preloader.remove();
    }, 300);
  }
}