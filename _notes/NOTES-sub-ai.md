⏺ I'll help you design a comprehensive storage architecture for your payment system. Let me create a detailed plan
   using the TodoWrite tool to track our implementation.

⏺ Update Todos
  ⎿  ☐ Design Firestore collections structure for payment system
     ☐ Implement active subscription checking before payment intent
     ☐ Enhance trial eligibility to check both UID and IP address
     ☐ Create abandoned cart tracking system
     ☐ Design unified subscription object structure
     ☐ Create webhook endpoints for Stripe, PayPal, Chargebee
     ☐ Implement app notification system for subscription events

⏺ Recommended Firestore Collections Structure

  Based on your requirements, I recommend using multiple collections for better scalability and query efficiency:

  1. payment-intents (Abandoned Cart Tracking)

  {
    id: "CHK-xxx", // checkout session ID
    app: "app-id",
    productId: "product-id",
    userId: "uid", // optional, may be guest
    email: "email@example.com",
    ipAddress: "192.168.1.1",
    status: "pending" | "completed" | "abandoned",
    createdAt: timestamp,
    updatedAt: timestamp,
    lastVisitedAt: timestamp,
    abandonedEmailsSent: {
      day1: false,
      day3: false,
      day7: false
    },
    cartData: {
      total: 99.99,
      frequency: "monthly",
      discount: "CODE20"
    }
  }

  2. payment-trials (Trial Eligibility)

  {
    id: auto,
    app: "app-id",
    productId: "product-id",
    uid: "user-id",
    ipAddress: "192.168.1.1",
    startedAt: timestamp,
    endedAt: timestamp,
    trialDays: 7
  }

  3. payment-subscriptions (Unified Subscription Records)

  {
    id: "sub-xxx",
    app: "app-id",
    productId: "product-id",
    userId: "uid",
    email: "email@example.com",
    processor: "stripe" | "paypal" | "chargebee",
    processorSubscriptionId: "stripe_sub_xxx",
    status: "active" | "cancelled" | "suspended" | "expired",
    frequency: "monthly" | "annually",
    amount: 99.99,
    currency: "USD",
    trialEnd: timestamp, // optional
    currentPeriodStart: timestamp,
    currentPeriodEnd: timestamp,
    cancelledAt: timestamp, // optional
    cancelReason: "string", // optional
    createdAt: timestamp,
    updatedAt: timestamp,
    metadata: {
      checkoutSessionId: "CHK-xxx",
      webhookEvents: ["created", "updated", "cancelled"]
    }
  }

  4. payment-orders (One-time Payments)

  {
    id: "order-xxx",
    app: "app-id",
    productId: "product-id",
    userId: "uid",
    email: "email@example.com",
    processor: "stripe" | "paypal" | "chargebee",
    processorOrderId: "stripe_pi_xxx",
    status: "pending" | "completed" | "failed" | "refunded",
    amount: 299.99,
    currency: "USD",
    createdAt: timestamp,
    completedAt: timestamp,
    metadata: {
      checkoutSessionId: "CHK-xxx"
    }
  }

  Implementation Flow

  1. On Checkout Page Load (Client)

  - Generate/retrieve checkout session ID
  - Send cart data to /payment-v2/cart endpoint
  - This creates/updates payment-intents document

  2. Before Creating Payment Intent (/payment-v2/intent)

  Check these in parallel:
  - Active subscription check: Query payment-subscriptions where userId == uid && productId == productId && status
   == 'active'
  - Trial eligibility: Query payment-trials where (uid == userId || ipAddress == ip) && productId == productId &&
  app == appId
  - ReCAPTCHA verification: Already implemented

  3. After Successful Payment Intent

  - Update payment-intents with processor response data
  - Store intent as "pending" until webhook confirmation

  4. Webhook Processing (/payment-v2/webhook/[processor])

  - Verify webhook signature
  - Map processor event to unified status
  - Update/create payment-subscriptions or payment-orders
  - Update payment-intents status to "completed"
  - Send notification to app's webhook endpoint

  5. Abandoned Cart Cron Job

  - Query payment-intents where status == 'pending'
  - Check age and send appropriate emails
  - Update abandonedEmailsSent flags

  Endpoints Structure

  /payment-v2/
    ├── cart/          # Track abandoned carts
    ├── intent/        # Create payment intent (existing)
    ├── webhook/
    │   ├── stripe/
    │   ├── paypal/
    │   └── chargebee/
    ├── subscription/
    │   └── check/     # Check active subscriptions
    └── cron/
        └── abandoned-carts/  # Daily cron for emails

  Key Implementation Points

  1. IP Address Tracking: Add to schema and capture in /payment-v2/intent
  2. Composite Indexes: Create for efficient queries:
    - payment-subscriptions: userId + productId + status
    - payment-trials: uid + productId + app, ipAddress + productId + app
  3. Unified Status Mapping: Create processor-agnostic status values
  4. Webhook Security: Verify signatures for each processor
  5. App Notifications: Implement retry logic with exponential backoff

  Would you like me to start implementing any of these components? I'd suggest starting with:
  1. Updating the intent endpoint to check active subscriptions
  2. Enhancing trial eligibility to include IP checking
  3. Creating the abandoned cart tracking endpoint
