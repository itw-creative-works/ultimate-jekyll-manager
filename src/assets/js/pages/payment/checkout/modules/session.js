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
    const forcedProcessor = urlParams.get('_dev_cardProcessor');

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

  // Get UTM parameters from storage
  const utmData = webManager.storage().get('marketing.utm');
  let utm = {};

  // Check if stored UTM data exists and is less than 30 days old
  if (utmData && utmData.timestamp && utmData.tags) {
    const daysDiff = (new Date() - new Date(utmData.timestamp)) / (1000 * 60 * 60 * 24);
    if (daysDiff < 30) {
      utm = utmData.tags;
    }
  }

  // Check for test app ID override
  const _dev_appId = urlParams.get('_dev_appId');
  const appId = _dev_appId || webManager.config.brand.id;

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

    // UTM tracking parameters (convert to expected format)
    utm: {
      source: utm.utm_source || '',
      medium: utm.utm_medium || '',
      campaign: utm.utm_campaign || '',
      term: utm.utm_term || '',
      content: utm.utm_content || ''
    },

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
