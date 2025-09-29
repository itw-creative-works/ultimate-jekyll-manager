
  1. Unified Endpoint Structure

  All processors now use the same endpoint:
  - Production: https://api.itwcreativeworks.com/payment/intent?processor={PROCESSOR}
  - Development: http://localhost:5001/your-project-id/us-central1/api/payment/intent?processor={PROCESSOR}

  The endpoint automatically switches based on webManager.isDevelopment().

  2. Standardized Request Body

  All processors send the same request structure:
  {
    processor: 'stripe' | 'paypal' | 'chargebee',
    recaptcha_token: 'token_from_google',
    processor_data: { /* processor-specific data */ },
    api_key: 'processor_api_key',
    is_subscription: true/false  // for PayPal
  }

  3. Backend Architecture (Firebase Functions)

  Your backend can now have a clean structure:
  /functions
    /payment
      - intent.js  // Main handler
      /modules
        - recaptcha.js  // Shared reCAPTCHA verification
        - stripe.js     // Stripe-specific logic
        - paypal.js     // PayPal-specific logic
        - chargebee.js  // Chargebee-specific logic

  The main handler can:
  1. Verify reCAPTCHA token (common for all)
  2. Extract processor from query param
  3. Validate request body
  4. Delegate to appropriate processor module
  5. Return standardized response: { url: "checkout_url" }

  This architecture makes it easy to:
  - Add new payment processors
  - Share common logic (reCAPTCHA, logging, error handling)
  - Test locally with Firebase emulator
  - Maintain consistent API structure
