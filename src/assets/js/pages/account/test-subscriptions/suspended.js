// Suspended subscription test data (payment failed)
export default {
  // IDs
  id: 'sub_4SuspendABCDEFG',
  orderNumber: 'ORD-2024-004567',
  app: 'app_main',
  product: 'enterprise',
  intent: 'pi_4SuspendABCDEFG',

  // Type and status
  type: 'subscription',
  status: 'suspended',
  access: false,
  frequency: 'monthly',

  // User info
  auth: {
    uid: 'eTFWt10v62Ohzuw5WPuH9HVjwAC3',
    email: 'ian.wieds@gmail.com'
  },

  // Customer info from payment processor
  customer: {
    id: 'cus_SuspendedUser789',
    email: 'ian.wieds@gmail.com',
    name: 'Ian Wiedenman',
    address: {
      city: 'New York',
      country: 'US',
      line1: '321 Payment Failed Blvd',
      postal_code: '10001',
      state: 'NY'
    },
    phone: '+12125551234'
  },

  // Payment processor info
  processor: {
    id: 'stripe',
    priceId: 'price_4SuspendABCDEFG',
    productId: 'prod_SuspendedProd789',
    subscriptionItemId: 'si_SuspendedItem789'
  },

  // Billing info
  billing: {
    amount: 9900, // $99.00
    currency: 'usd',
    interval: 1,
    currentPeriodEnd: Math.floor(Date.now() / 1000) + (3 * 24 * 60 * 60), // 3 days from now
    nextBillingDate: Math.floor(Date.now() / 1000) + (3 * 24 * 60 * 60),
    lastPayment: {
      amount: 9900,
      date: Date.now() - (3 * 24 * 60 * 60 * 1000), // 3 days ago
      status: 'failed' // Payment failed
    }
  },

  // Trial info
  trial: {
    eligible: false,
    used: true,
    days: 30,
    startedAt: Date.now() - (180 * 24 * 60 * 60 * 1000), // 180 days ago
    endedAt: Date.now() - (150 * 24 * 60 * 60 * 1000) // 150 days ago
  },

  // Cancellation info
  cancellation: {
    requested: false,
    requestedAt: null,
    effectiveAt: null,
    reason: null
  },

  // Payment issue info
  paymentIssue: {
    hasIssue: true,
    attempts: 3,
    lastAttempt: Date.now() - (24 * 60 * 60 * 1000), // 1 day ago
    nextRetry: Date.now() + (24 * 60 * 60 * 1000), // 1 day from now
    message: 'Your card was declined. Please update your payment method.'
  },

  // Metadata
  meta: {
    created: Date.now() - (180 * 24 * 60 * 60 * 1000),
    updated: Date.now() - (24 * 60 * 60 * 1000)
  }
};
