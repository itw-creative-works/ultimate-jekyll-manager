// State management for checkout
// Minimal mutable state -- everything else is derived by buildBindingsState()

import { calculatePrices } from './pricing.js';

// Hardcoded discount codes (TODO: move to API)
export const DISCOUNT_CODES = {
  'FLASH20': 20,
  'SAVE10': 10,
  'WELCOME15': 15,
};

// Minimal mutable state
export const state = {
  // From API (stored once, never transformed)
  appConfig: null,
  product: null,
  processors: null,

  // User selections
  frequency: 'annually',
  discountPercent: 0,
  trialEligible: false,

  // UI state
  discountUI: { loading: false, success: false, error: false, message: '' },
  error: { show: false, message: '' },

  // Session
  checkoutId: null,
};

// Resolve which processor handles a payment method
export function resolveProcessor(paymentMethod) {
  if (paymentMethod === 'card') {
    // Dev override
    const urlParams = new URLSearchParams(window.location.search);
    const forced = urlParams.get('_dev_cardProcessor');
    if (forced) return forced;

    // Prefer Stripe, fall back to Chargebee
    if (state.processors?.stripe?.publishableKey) return 'stripe';
    if (state.processors?.chargebee?.site) return 'chargebee';
    return 'stripe';
  }

  const map = { paypal: 'paypal', crypto: 'coinbase' };
  return map[paymentMethod] || paymentMethod;
}

// Build the complete bindings state from minimal state
// Returns a fresh object every time -- no mutation of shared references
export function buildBindingsState(webManager) {
  const product = state.product;
  const user = webManager.auth().getUser();
  const prices = calculatePrices(state);

  const isSubscription = product?.type === 'subscription';
  const hasFreeTrial = isSubscription && state.trialEligible && (product?.trial?.days > 0);
  const cycle = state.frequency;

  // Savings calculation
  const monthlyTotal = (product?.prices?.monthly?.amount || 0) * 12;
  const annualPrice = product?.prices?.annually?.amount || 0;
  const savingsPercent = monthlyTotal > 0
    ? Math.round(((monthlyTotal - annualPrice) / monthlyTotal) * 100)
    : 0;

  return {
    checkout: {
      product: {
        name: product?.name || 'Loading...',
        description: product?.description || '',
        isSubscription,
      },
      pricing: {
        monthlyPrice: formatCurrency(product?.prices?.monthly?.amount),
        annualMonthlyRate: formatCurrency(annualPrice ? annualPrice / 12 : null),
        savingsBadge: savingsPercent > 0 ? `Save ${savingsPercent}%` : '',
        showSavingsBadge: savingsPercent > 0,
        frequencyPaymentText: cycle === 'monthly'
          ? `${formatCurrency(product?.prices?.monthly?.amount)} monthly`
          : `${formatCurrency(annualPrice)} annually`,
        subtotal: formatCurrency(prices.subtotal),
        total: formatCurrency(prices.total),
        totalDueText: `${formatCurrency(prices.total)} due today`,
        recurringAmount: formatCurrency(prices.recurring),
        recurringPeriod: cycle === 'monthly' ? 'monthly' : 'annually',
        showTerms: isSubscription,
        termsText: buildTermsText(product, cycle, hasFreeTrial, prices),
      },
      trial: {
        show: hasFreeTrial,
        hasFreeTrial: hasFreeTrial && prices.total === 0,
        message: hasFreeTrial ? `Start your ${product?.trial?.days || 7}-day free trial today!` : '',
        discountAmount: prices.trialDiscountAmount.toFixed(2),
      },
      discount: {
        hasDiscount: state.discountPercent > 0,
        percent: state.discountPercent > 0 ? `${state.discountPercent}%` : '',
        amount: prices.discountAmount.toFixed(2),
        loading: state.discountUI.loading,
        success: state.discountUI.success,
        error: state.discountUI.error,
        successMessage: state.discountUI.message || 'Discount applied',
        errorMessage: state.discountUI.message || 'Invalid discount code',
      },
      paymentMethods: {
        card: !!(state.processors?.stripe?.publishableKey || state.processors?.chargebee?.site),
        paypal: !!state.processors?.paypal?.clientId,
        applePay: false,
        googlePay: false,
        crypto: state.processors?.coinbase?.enabled === true,
      },
      error: {
        show: state.error.show,
        message: state.error.message,
      },
    },
    auth: {
      user: {
        email: user?.email || '',
      },
    },
  };
}

// Format a number as currency, or return placeholder
function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return '$--';
  return `$${Number(amount).toFixed(2)}`;
}

// Build subscription terms text
function buildTermsText(product, cycle, hasFreeTrial, prices) {
  if (!product || product.type !== 'subscription') return '';

  const periodText = cycle === 'monthly' ? 'monthly' : 'annually';
  const renewalDate = new Date();
  const daysToAdd = hasFreeTrial
    ? (product.trial?.days || 7)
    : (cycle === 'monthly' ? 30 : 365);
  renewalDate.setDate(renewalDate.getDate() + daysToAdd);

  const formatted = renewalDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  if (hasFreeTrial) {
    return `You won't be charged for your free trial. On ${formatted}, your ${periodText} subscription will start and you'll be charged ${formatCurrency(prices.recurring)} plus applicable tax. Cancel anytime before then.`;
  }

  return `Your ${periodText} subscription will start today and renew on ${formatted} for ${formatCurrency(prices.recurring)} plus applicable tax. Cancel anytime.`;
}
