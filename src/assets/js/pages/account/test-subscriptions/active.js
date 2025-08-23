// Active subscription test data
export default {
  // IDs
  id: 'sub_1OQxyzABCDEFGHIJ',
  orderNumber: 'ORD-2024-001234',
  app: 'app_main',
  product: 'pro',
  intent: 'pi_1OQxyzABCDEFGHIJ',

  // Type and status
  type: 'subscription',
  status: 'active',
  access: true,
  frequency: 'monthly',

  // User info
  auth: {
    uid: 'eTFWt10v62Ohzuw5WPuH9HVjwAC3',
    email: 'ian.wieds@gmail.com'
  },

  // Customer info from payment processor
  customer: {
    id: 'cus_PQRSTUVWXYZabc',
    email: 'ian.wieds@gmail.com',
    name: 'Ian Wiedenman',
    address: {
      city: 'San Francisco',
      country: 'US',
      line1: '123 Main St',
      postal_code: '94102',
      state: 'CA'
    },
    phone: '+14155551234'
  },

  // Payment processor info
  processor: {
    id: 'stripe',
    priceId: 'price_1OQxyzABCDEFGHIJ',
    productId: 'prod_PQRSTUVWXYZabc',
    subscriptionItemId: 'si_PQRSTUVWXYZabc'
  },

  // Billing info
  billing: {
    amount: 2900, // $29.00
    currency: 'usd',
    interval: 1,
    currentPeriodEnd: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days from now
    nextBillingDate: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
    lastPayment: {
      amount: 2900,
      date: Date.now() - (5 * 24 * 60 * 60 * 1000), // 5 days ago
      status: 'succeeded'
    }
  },

  // Trial info
  trial: {
    eligible: false,
    used: true,
    days: 14,
    startedAt: Date.now() - (45 * 24 * 60 * 60 * 1000), // 45 days ago
    endedAt: Date.now() - (31 * 24 * 60 * 60 * 1000) // 31 days ago
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
    created: Date.now() - (45 * 24 * 60 * 60 * 1000),
    updated: Date.now() - (60 * 60 * 1000) // 1 hour ago
  }
};
