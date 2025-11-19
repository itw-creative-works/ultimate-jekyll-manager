// Libraries
import { raw } from './modules/state.js';
import { fetchProductDetails, fetchTrialEligibility, warmupServer } from './modules/api.js';
import { initializeRecaptcha } from './modules/recaptcha.js';
import {
  updateAllUI,
  handleBillingCycleChange,
  showError,
  updatePaymentButtonVisibility,
  initializeCheckoutUI
} from './modules/ui-bindings.js';
import { applyDiscountCode, autoApplyWelcomeCoupon } from './modules/discount-bindings.js';
import { paymentManager } from './modules/processors-main.js';
import { FormManager } from '__main_assets__/js/libs/form-manager.js';
import {
  generateCheckoutId,
  buildPaymentIntentData,
} from './modules/session.js';
import { calculatePrices } from './modules/pricing.js';
let webManager = null;
let formManager = null;

// Constants
const RECAPTCHA_SITE_KEY = '6LdxsmAnAAAAACbft_UmKZXJV_KTEiuG-7tfgJJ5';

// Module export
export default (Manager, options) => {
  return new Promise(async function (resolve) {
    // Set webManager
    webManager = Manager.webManager;

    // Initialize when DOM is ready
    await webManager.dom().ready();

    // Initialize checkout
    await initializeCheckout();

    // Resolve
    return resolve();
  });
}

// Analytics tracking functions
function trackBeginCheckout(product, price, billingCycle) {
  const items = [{
    item_id: product.id,
    item_name: product.name,
    item_category: product.is_subscription ? 'subscription' : 'one-time',
    item_variant: billingCycle,
    price: price,
    quantity: 1
  }];

  // Google Analytics 4
  gtag('event', 'begin_checkout', {
    currency: 'USD',
    value: price,
    items: items
  });

  // Facebook Pixel
  fbq('track', 'InitiateCheckout', {
    content_ids: [product.id],
    content_name: product.name,
    content_type: 'product',
    currency: 'USD',
    value: price,
    num_items: 1
  });

  // TikTok Pixel
  ttq.track('InitiateCheckout', {
    content_id: product.id,
    content_type: 'product',
    content_name: product.name,
    price: price,
    quantity: 1,
    currency: 'USD',
    value: price
  });
}

function trackAddPaymentInfo(product, price, billingCycle, paymentMethod) {
  const items = [{
    item_id: product.id,
    item_name: product.name,
    item_category: product.is_subscription ? 'subscription' : 'one-time',
    item_variant: billingCycle,
    price: price,
    quantity: 1
  }];

  // Google Analytics 4
  gtag('event', 'add_payment_info', {
    currency: 'USD',
    value: price,
    payment_type: paymentMethod,
    items: items
  });

  // Facebook Pixel
  fbq('track', 'AddPaymentInfo', {
    content_ids: [product.id],
    content_name: product.name,
    content_type: 'product',
    currency: 'USD',
    value: price
  });

  // TikTok Pixel
  ttq.track('AddPaymentInfo', {
    content_id: product.id,
    content_type: 'product',
    content_name: product.name,
    price: price,
    quantity: 1,
    currency: 'USD',
    value: price
  });
}

// Setup event listeners using FormManager
function setupEventListeners() {
  // Initialize FormManager
  formManager = new FormManager('#checkout-form', {
    autoDisable: true, // Enable automatic form disabling during submission
    showSpinner: true,
    allowMultipleSubmissions: false, // Prevent multiple submissions
    submitButtonLoadingText: 'Processing...'
  });

  // Listen for form field changes
  formManager.addEventListener('change', (event) => {
    const { fieldName, fieldValue, data } = event.detail;

    // Handle billing cycle changes
    if (fieldName === 'billing-cycle') {
      handleBillingCycleChange(fieldValue, webManager);
    }
  });

  // Handle non-submit button clicks
  formManager.addEventListener('button', (event) => {
    const { action } = event.detail;

    if (action === 'apply-discount') {
      applyDiscountCode(webManager);
    }
  });

  // Handle form submission
  formManager.addEventListener('submit', async (event) => {
    event.preventDefault();

    // Get the submit button that was clicked
    const submitButton = event.detail.submitButton;
    if (!submitButton) {
      formManager.showError('Please choose a payment method.');
      return;
    }

    // Check if a payment method was selected
    const paymentMethod = submitButton.getAttribute('data-payment-method');
    if (!paymentMethod) {
      formManager.showError('Invalid payment method selected.');
      return;
    }

    // Set payment method in raw
    raw.paymentMethod = paymentMethod;

    // Track add_payment_info event when payment method is selected
    const basePrice = raw.product.is_subscription
      ? (raw.billingCycle === 'monthly' ? raw.product.price_monthly : raw.product.price_annually)
      : raw.product.price;

    trackAddPaymentInfo(raw.product, basePrice, raw.billingCycle, paymentMethod);
    console.log('Tracked add_payment_info event:', paymentMethod);

    // Process the payment
    await completePurchase();
  });

  // Switch account link (keep as is - not part of form)
  const $switchAccountLink = document.getElementById('switch-account');
  if ($switchAccountLink) {
    const currentUrl = encodeURIComponent(window.location.href);
    $switchAccountLink.href = `/signin?authSignout=true&authReturnUrl=${currentUrl}`;
  }

  // Help button - opens Chatsy
  const $helpButton = document.getElementById('checkout-help-button');
  if ($helpButton) {
    $helpButton.addEventListener('click', (e) => {
      e.preventDefault();
      chatsy.open();
    });
  }
}

// Complete purchase
async function completePurchase() {
  try {
    // Get form data from FormManager
    const formData = formManager.getData();

    // Store form data in raw
    raw.formData = formData;

    // Wait 1 second to simulate processing time
    if (webManager.isDevelopment()) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Add custom validation if needed
    if (!raw.paymentMethod) {
      throw new Error('Please select a payment method');
    }

    // Build payment intent data according to API schema
    const paymentIntentData = buildPaymentIntentData(webManager);

    // Log the structured payment data
    console.log('🟢 Payment intent data:', paymentIntentData);

    // Calculate pricing for analytics
    const prices = calculatePrices(raw);

    // Store pre-payment analytics data
    const analyticsData = {
      transaction_id: raw.checkoutId,
      value: prices.total,
      currency: 'USD',
      items: [{
        item_name: raw.product.name,
        price: prices.total,
        quantity: 1
      }]
    };

    // Track initiate checkout event
    if (typeof gtag !== 'undefined') {
      gtag('event', 'begin_checkout', analyticsData);
    }

    // Store order data for confirmation page (legacy format for now)
    const orderData = {
      orderId: raw.checkoutId,
      product: raw.product.name,
      productId: raw.product.id,
      total: prices.total,
      subtotal: prices.subtotal,
      discountPercent: raw.discountPercent,
      billingCycle: raw.billingCycle,
      hasFreeTrial: raw.product.has_free_trial,
      paymentMethod: raw.paymentMethod,
      email: webManager.auth().getUser().email,
      timestamp: new Date().toISOString(),
      formData: formData
    };

    sessionStorage.setItem('pendingOrder', JSON.stringify(orderData));

    // Store the payment intent data in raw for processors to use
    raw.paymentIntentData = paymentIntentData;

    // Process payment with selected processor (will redirect)
    await paymentManager.processPayment(raw.paymentMethod);

    // This code won't run if redirect is successful
    // If we get here, something went wrong
    throw new Error('Payment redirect failed');

  } catch (error) {
    console.error('Purchase error:', error);

    // FormManager will handle button state restoration
    formManager.setFormState('ready');

    // Show user-friendly error message
    const errorMessage = error.message || 'There was an error processing your payment. Please try again.';

    formManager.showError(errorMessage);
  }
}

// Initialize checkout with parallel API calls
async function initializeCheckout() {
  try {
    // Initialize UI with loading states (replaces fullscreen loader)
    initializeCheckoutUI();

    // Generate or retrieve checkout session ID
    raw.checkoutId = generateCheckoutId();
    console.log('Checkout session ID:', raw.checkoutId);

    // Get product ID from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('product');
    const frequency = urlParams.get('frequency') || 'annually';
    const _dev_appId = urlParams.get('_dev_appId');
    const _dev_trialEligible = urlParams.get('_dev_trialEligible');

    // Product ID is required
    if (!productId) {
      throw new Error('Product ID is missing from URL.');
    }

    // Check for testing parameters
    const appId = _dev_appId || webManager.config.brand.id;

    // Warmup server (fire and forget)
    warmupServer(webManager);

    // Fetch product details, trial eligibility, and initialize reCAPTCHA in parallel
    const [productData, trialEligible, recaptchaInit] = await Promise.allSettled([
      fetchProductDetails(appId, productId, webManager),
      fetchTrialEligibility(appId, productId, webManager),
      initializeRecaptcha(RECAPTCHA_SITE_KEY, webManager)
    ]);

    // Handle product fetch result
    if (productData.status === 'rejected') {
      throw new Error(`Failed to load product details for "${productId}". The product may not exist or there was a server error.`);
    }

    // Set product data
    raw.product = productData.value;

    // Create mutable trial eligibility result for testing
    let trialEligibilityResult = trialEligible;

    // Override trial eligibility for testing (only in development)
    if (_dev_trialEligible && webManager.isDevelopment()) {
      if (_dev_trialEligible === 'false') {
        trialEligibilityResult = { status: 'fulfilled', value: false };
      } else if (_dev_trialEligible === 'true') {
        trialEligibilityResult = { status: 'fulfilled', value: true };
      }
    }

    // Apply trial eligibility with server/test response
    if (trialEligibilityResult.status === 'fulfilled') {
      raw.product.has_free_trial = trialEligibilityResult.value && raw.product.has_free_trial;
    }

    // Initialize payment processors with API keys
    if (raw.apiKeys) {
      paymentManager.initialize(raw.apiKeys, webManager);
    }

    // Update payment button visibility based on available processors
    updatePaymentButtonVisibility(paymentManager);

    // Log available payment methods
    const availableMethods = paymentManager.getAvailablePaymentMethods();
    console.log('Available payment methods:');
    availableMethods.forEach(method => {
      console.log(`- ${method.name} (${method.processor})`);
    });

    if (availableMethods.length === 0) {
      console.error('No payment methods available! Check API keys configuration.');
      showError('No payment methods are currently available. Please contact support for assistance.', webManager);
      return; // Stop initialization since we can't proceed without payment methods
    }

    // Log reCAPTCHA initialization result
    if (recaptchaInit.status === 'rejected') {
      console.warn('reCAPTCHA initialization failed:', recaptchaInit.reason);
    } else if (!recaptchaInit.value) {
      console.warn('reCAPTCHA was not initialized (no site key or initialization failed)');
    }

    // Set billing cycle from URL parameter (before UI updates)
    if (frequency === 'monthly' || frequency === 'annually') {
      raw.billingCycle = frequency;
      console.log('Setting billing cycle from URL:', frequency);
    }

    // Update UI with product details
    updateAllUI(webManager);

    // Set up event listeners and FormManager
    setupEventListeners();

    // Set form to ready state
    formManager.setFormState('ready');

    // Track begin_checkout event on page load
    const basePrice = raw.product.is_subscription
      ? (raw.billingCycle === 'monthly' ? raw.product.price_monthly : raw.product.price_annually)
      : raw.product.price;

    trackBeginCheckout(raw.product, basePrice, raw.billingCycle);
    console.log('Tracked begin_checkout event for:', raw.product.id);

    // Auto-apply welcome coupon
    autoApplyWelcomeCoupon(webManager);

  } catch (error) {
    console.error('Checkout initialization failed:', error);
    showError(error.message || 'Failed to load checkout. Please refresh the page and try again.', webManager);
  } finally {
    // The bindings system handles loading states, no need for a separate preloader
    // Auth listener is still useful for other purposes
    webManager.auth().listen({}, () => {
      console.log('Auth state updated');
    });
  }
}
