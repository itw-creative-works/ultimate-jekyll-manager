// Cancellation requested (will cancel at period end) subscription test data
export default {
  // IDs
  id: 'sub_5CancelReqABCDE',
  orderNumber: 'ORD-2024-005678',
  app: 'app_main',
  product: 'professional',
  intent: 'pi_5CancelReqABCDE',

  // Type and status
  type: 'subscription',
  status: 'active', // Still active until period end
  access: true,
  frequency: 'annually',

  // User info
  auth: {
    uid: 'eTFWt10v62Ohzuw5WPuH9HVjwAC3',
    email: 'ian.wieds@gmail.com'
  },

  // Customer info from payment processor
  customer: {
    id: 'cus_CancelReqUser012',
    email: 'ian.wieds@gmail.com',
    name: 'Ian Wiedenman',
    address: {
      city: 'Seattle',
      country: 'US',
      line1: '555 Leaving Soon Ave',
      postal_code: '98101',
      state: 'WA'
    },
    phone: '+12065551234'
  },

  // Payment processor info
  processor: {
    id: 'stripe',
    priceId: 'price_5CancelReqABCDE',
    productId: 'prod_CancelReqProd012',
    subscriptionItemId: 'si_CancelReqItem012'
  },

  // Billing info
  billing: {
    amount: 59900, // $599.00
    currency: 'usd',
    interval: 1, // annually
    currentPeriodEnd: Math.floor(Date.now() / 1000) + (45 * 24 * 60 * 60), // 45 days from now
    nextBillingDate: null, // Won't renew
    lastPayment: {
      amount: 59900,
      date: Date.now() - (320 * 24 * 60 * 60 * 1000), // 320 days ago
      status: 'succeeded'
    }
  },

  // Trial info
  trial: {
    eligible: false,
    used: true,
    days: 30,
    startedAt: Date.now() - (365 * 24 * 60 * 60 * 1000), // 365 days ago
    endedAt: Date.now() - (335 * 24 * 60 * 60 * 1000) // 335 days ago
  },

  // Cancellation info
  cancellation: {
    requested: true,
    requestedAt: Date.now() - (2 * 24 * 60 * 60 * 1000), // 2 days ago
    effectiveAt: Math.floor(Date.now() / 1000) + (45 * 24 * 60 * 60), // 45 days from now (at period end)
    reason: 'too_expensive',
    feedback: 'The service is great but I found a cheaper alternative.'
  },

  // Metadata
  meta: {
    created: Date.now() - (365 * 24 * 60 * 60 * 1000),
    updated: Date.now() - (2 * 24 * 60 * 60 * 1000)
  }
};
