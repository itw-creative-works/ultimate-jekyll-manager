// State management for checkout
export const config = {
  discountCodes: {
    'FLASH20': 20,
    'SAVE10': 10,
    'WELCOME15': 15
  },
  siteConfig: null // Will be populated from API
};

// Raw data storage (not exposed to bindings)
export const raw = {
  product: null, // Full product object from API
  billingCycle: 'annually',
  discountPercent: 0,
  apiKeys: null,
  checkoutId: null,
  formData: null,
  paymentMethod: 'card'
};

// State structure matches bindings exactly - THIS is what gets passed to bindings
export const state = {
  checkout: {
    product: {
      name: 'Loading...',
      description: 'Loading product details...',
      isSubscription: false
    },
    pricing: {
      monthlyPrice: '$--',
      annualMonthlyRate: '$--',
      savingsBadge: '',
      showSavingsBadge: false,
      billingCyclePaymentText: '$-- monthly',
      productPrice: '$--',
      subtotal: '$--',
      total: '$--',
      recurringAmount: '$--',
      recurringPeriod: 'annually',
      showTerms: false,
      termsText: ''
    },
    trial: {
      show: false,
      hasFreeTrial: false,
      message: '',
      discountAmount: '0.00'
    },
    discount: {
      loading: false,
      success: false,
      error: false,
      hasDiscount: false,
      percent: '',
      amount: '0.00',
      successMessage: 'Discount applied',
      errorMessage: 'Invalid discount code'
    },
    paymentMethods: {
      card: false,
      paypal: false,
      applePay: false,
      googlePay: false,
      crypto: false
    },
    error: {
      show: false,
      message: ''
    }
  },
  auth: {
    user: {
      email: ''
    }
  }
};

// Get payment provider IDs for current billing cycle
export function getPaymentIds() {
  if (!raw.product?._raw?.pricing) return {};

  const pricing = raw.billingCycle === 'monthly'
    ? raw.product._raw.pricing.monthly
    : raw.product._raw.pricing.annually;

  return {
    stripePriceId: pricing.stripePriceId,
    stripeProductId: pricing.stripeProductId,
    paypalPlanId: pricing.paypalPlanId,
    chargebeePlanId: pricing.chargebeePlanId
  };
}
