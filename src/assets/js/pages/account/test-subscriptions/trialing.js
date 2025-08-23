// Trialing subscription test data
export default {
  // IDs
  id: 'sub_2TRialABCDEFGHIJ',
  orderNumber: 'ORD-2024-002345',
  app: 'app_main',
  product: 'premium',
  intent: 'pi_2TRialABCDEFGHIJ',

  // Type and status
  type: 'subscription',
  status: 'trialing',
  access: true,
  frequency: 'annually',

  // User info
  auth: {
    uid: 'eTFWt10v62Ohzuw5WPuH9HVjwAC3',
    email: 'ian.wieds@gmail.com'
  },

  // Customer info from payment processor
  customer: {
    id: 'cus_TrialCustomer123',
    email: 'ian.wieds@gmail.com',
    name: 'Ian Wiedenman',
    address: {
      city: 'Los Angeles',
      country: 'US',
      line1: '456 Trial Ave',
      postal_code: '90001',
      state: 'CA'
    },
    phone: '+13105551234'
  },

  // Payment processor info
  processor: {
    id: 'stripe',
    priceId: 'price_2TRialABCDEFGHIJ',
    productId: 'prod_TrialProduct123',
    subscriptionItemId: 'si_TrialItem123'
  },

  // Billing info
  billing: {
    amount: 29900, // $299.00
    currency: 'usd',
    interval: 1, // annually
    currentPeriodEnd: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days from now (trial end)
    nextBillingDate: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
    lastPayment: {
      amount: null,
      date: null,
      status: null
    }
  },

  // Trial info
  trial: {
    eligible: true,
    used: true,
    days: 14,
    startedAt: Date.now() - (7 * 24 * 60 * 60 * 1000), // 7 days ago
    endedAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days from now
  },

  // Cancellation info
  cancellation: {
    requested: false,
    requestedAt: null,
    effectiveAt: null,
    reason: null
  },

  // Metadata
  meta: {
    created: Date.now() - (7 * 24 * 60 * 60 * 1000),
    updated: Date.now() - (60 * 1000) // 1 minute ago
  }
};
