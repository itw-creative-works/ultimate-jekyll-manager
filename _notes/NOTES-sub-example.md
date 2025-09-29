/// SUBSCRIPTION

{
  // Core identification
  id: "sub-xxx", // Or "ORD-xxx" for orders
  app: "app-id",
  product: "product-id",
  checkout: "chk-xxx", // Links back to payment-intents

  // Auth
  auth: {
    uid: "user-uid",
    email: "user@example.com"
  },

  // Processor information
  processor: {
    id: "stripe", // stripe, paypal, chargebee
    lastWebhookEvent: "customer.subscription.updated" // Useful for debugging
  },

  // Type identifier
  type: "subscription", // or "order" for one-time

  // Status information
  status: "active", // Same statuses work for orders too
  access: true, // Computed based on current status and rules
  frequency: "monthly", // null for one-time orders

  // Customer information
  customer: {
    id: "cus-xxx", // Customer ID in the processor
    name: "John Doe",
    email: "john.doe@example.com"
  },

  // Billing information
  billing: {
    amount: 99.99,
    lastPayment: {
      amount: 99.99,
      date: {
        timestamp: "2023-10-01T12:00:00Z",
        timestampUNIX: 1696156800
      }
    },
    totalRevenue: 299.97, // Lifetime value
    paymentCount: 3 // Number of successful payments
  },

  // Trial information (if applicable)
  trial: {
    active: true, // Is the trial currently active?
    claimed: true, // Actually used the trial
    days: 14,
    started: {
      timestamp: "2023-09-15T12:00:00Z",
      timestampUNIX: 1694745600 // UNIX timestamp
    }
  },

  // Supplemental information from the checkout form
  supplemental: {
    // Custom form fields
  },

  // Analytics and tracking
  utm: {
    source: "google",
    medium: "cpc",
    campaign: "summer_sale",
    content: "ad_1",
    term: "keyword"
  },

  // Original processor data (for debugging)
  raw: {
    // Complete webhook payload or API response
  },

  // Metadata and timestamps
  meta: {
    created: {
      timestamp: "2023-10-01T12:00:00Z",
      timestampUNIX: 1696156800
    },
    updated: {
      timestamp: "2023-10-02T12:00:00Z",
      timestampUNIX: 1696243200
    },
  },
}
