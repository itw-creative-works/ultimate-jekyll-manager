// Checkout session management
import { state } from './state.js';

// Generate a unique checkout session ID
export function generateCheckoutId() {
  // Check if we already have a session ID in URL params (from abandoned cart email)
  const urlParams = new URLSearchParams(window.location.search);
  const existingCheckoutId = urlParams.get('checkoutId');

  if (existingCheckoutId) {
    return existingCheckoutId;
  }

  // Generate new session ID
  // Format: CHK-{timestamp}-{random}-{random}
  const timestamp = Date.now().toString(36);
  const random1 = Math.random().toString(36).substring(2, 8);
  const random2 = Math.random().toString(36).substring(2, 8);

  return `CHK-${timestamp}-${random1}-${random2}`.toUpperCase();
}

// Build payment intent data according to API schema
export function buildPaymentIntentData(webManager) {
  const user = webManager.auth().getUser();
  const formData = state.formData || {};
  const urlParams = new URLSearchParams(window.location.search);

  // Get processor name
  let processorName = state.paymentMethod;
  if (state.paymentMethod === 'card') {
    // Determine which processor will be used for card payments
    const forcedProcessor = urlParams.get('_test_cardProcessor');

    if (forcedProcessor) {
      processorName = forcedProcessor;
    } else if (state.apiKeys?.stripe?.publishableKey) {
      processorName = 'stripe';
    } else if (state.apiKeys?.chargebee?.siteKey) {
      processorName = 'chargebee';
    } else {
      processorName = 'stripe';
    }
  }

  // Extract UTM parameters
  const utm = {
    source: urlParams.get('utm_source') || '',
    medium: urlParams.get('utm_medium') || '',
    campaign: urlParams.get('utm_campaign') || '',
    term: urlParams.get('utm_term') || '',
    content: urlParams.get('utm_content') || ''
  };

  // Check for test app ID override
  const _test_appId = urlParams.get('_test_appId');
  const appId = _test_appId || webManager.config.brand.id;

  // Build the payment intent data structure
  const paymentIntentData = {
    // Unique checkout session ID
    // id: state.checkoutId,

    // App ID (use test override if provided)
    app: appId,

    // Payment processor
    processor: processorName,

    // Discount code
    discount: formData.discount_code || null,

    // Product information
    product: {
      id: state.product.id,
      total: state.total,
      frequency: state.isSubscription ? state.billingCycle : null
    },

    // Auth information
    auth: {
      uid: user.uid || '',
      email: user.email || ''
    },

    // Supplemental form data (any additional form fields)
    supplemental: formData || {},

    // UTM tracking parameters
    utm: utm,

    // Cancel URL (current page URL)
    cancelUrl: window.location.href,

    // Verification (reCAPTCHA)
    verification: {
      status: 'pending',
      'g-recaptcha-response': '' // Will be populated before sending
    }
  };

  // Remove null values to keep payload clean (except frequency which should stay null)
  Object.keys(paymentIntentData).forEach(key => {
    if (paymentIntentData[key] === null && key !== 'discount') {
      delete paymentIntentData[key];
    }
  });

  // Remove billing-cycle from supplemental data
  delete paymentIntentData.supplemental['billing-cycle'];

  // Remove discount if null
  if (paymentIntentData.discount === null) {
    delete paymentIntentData.discount;
  }

  return paymentIntentData;
}
