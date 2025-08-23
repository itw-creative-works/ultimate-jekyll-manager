// Cancelled subscription test data
export default {
  // IDs
  id: 'sub_3CancelABCDEFGH',
  orderNumber: 'ORD-2024-003456',
  app: 'app_main',
  product: 'basic',
  intent: 'pi_3CancelABCDEFGH',

  // Type and status
  type: 'subscription',
  status: 'cancelled',
  access: false,
  frequency: 'monthly',

  // User info
  auth: {
    uid: 'eTFWt10v62Ohzuw5WPuH9HVjwAC3',
    email: 'ian.wieds@gmail.com'
  },

  // Customer info from payment processor
  customer: {
    id: 'cus_CancelledUser456',
    email: 'ian.wieds@gmail.com',
    name: 'Ian Wiedenman',
    address: {
      city: 'Chicago',
      country: 'US',
      line1: '789 Former St',
      postal_code: '60601',
      state: 'IL'
    },
    phone: '+13125551234'
  },

  // Payment processor info
  processor: {
    id: 'stripe',
    priceId: 'price_3CancelABCDEFGH',
    productId: 'prod_CancelledProd456',
    subscriptionItemId: 'si_CancelledItem456'
  },

  // Billing info
  billing: {
    amount: 1900, // $19.00
    currency: 'usd',
    interval: 1,
    currentPeriodEnd: Math.floor(Date.now() / 1000) - (5 * 24 * 60 * 60), // 5 days ago (already ended)
    nextBillingDate: null, // No next billing
    lastPayment: {
      amount: 1900,
      date: Date.now() - (35 * 24 * 60 * 60 * 1000), // 35 days ago
      status: 'succeeded'
    }
  },

  // Trial info
  trial: {
    eligible: false,
    used: true,
    days: 7,
    startedAt: Date.now() - (90 * 24 * 60 * 60 * 1000), // 90 days ago
    endedAt: Date.now() - (83 * 24 * 60 * 60 * 1000) // 83 days ago
  },

  // Cancellation info
  cancellation: {
    requested: true,
    requestedAt: Date.now() - (10 * 24 * 60 * 60 * 1000), // 10 days ago
    effectiveAt: Date.now() - (5 * 24 * 60 * 60 * 1000), // 5 days ago
    reason: 'customer_request'
  },

  // Metadata
  meta: {
    created: Date.now() - (90 * 24 * 60 * 60 * 1000),
    updated: Date.now() - (5 * 24 * 60 * 60 * 1000)
  }
};
