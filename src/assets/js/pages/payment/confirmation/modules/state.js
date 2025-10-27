// Confirmation state management
// This is the SINGLE source of truth - structure matches bindings exactly
export const state = {
  confirmation: {
    order: {
      id: 'Loading...',
      productName: 'Product',
      total: '$0.00',
      currency: 'USD'
    },
    subscription: {
      show: false,
      hasFreeTrial: false,
      billingCycle: '',
      infoText: ''
    },
    loaded: false
  }
};