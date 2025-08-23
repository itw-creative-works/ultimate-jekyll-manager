// State management for checkout
export const config = {
  discountCodes: {
    'FLASH20': 20,
    'SAVE10': 10,
    'WELCOME15': 15
  },
  siteConfig: null // Will be populated from API
};

export const state = {
  product: null,
  billingCycle: 'annually',
  discountPercent: 0,
  subtotal: 0,
  total: 0,
  isSubscription: false,
  hasFreeTrial: false,
  paymentMethod: 'card',
  apiKeys: null, // Will store API keys from site config
  checkoutId: null, // Unique checkout session ID
  formData: null // Form data collected from checkout form
};

// Get payment provider IDs for current billing cycle
export function getPaymentIds() {
  if (!state.product?._raw?.pricing) return {};

  const pricing = state.billingCycle === 'monthly'
    ? state.product._raw.pricing.monthly
    : state.product._raw.pricing.annually;

  return {
    stripePriceId: pricing.stripePriceId,
    stripeProductId: pricing.stripeProductId,
    paypalPlanId: pricing.paypalPlanId,
    chargebeePlanId: pricing.chargebeePlanId
  };
}
