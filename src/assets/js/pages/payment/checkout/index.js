// Libraries
import { state } from './modules/state.js';
import { fetchProductDetails, fetchTrialEligibility, warmupServer } from './modules/api.js';
import { initializeRecaptcha } from './modules/recaptcha.js';
import {
  updateAllUI,
  handleBillingCycleChange,
  showError,
  hidePreloader,
  updatePaymentButtonVisibility
} from './modules/ui.js';
import { applyDiscountCode, autoApplyWelcomeCoupon } from './modules/discount.js';
import { paymentManager } from './modules/processors-main.js';
import { FormManager } from '__main_assets__/js/libs/form-manager.js';
import {
  generateCheckoutId,
  buildPaymentIntentData,
} from './modules/session.js';
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
      handleBillingCycleChange(fieldValue);
    }
  });

  // Handle non-submit button clicks
  formManager.addEventListener('button', (event) => {
    const { action } = event.detail;

    if (action === 'apply-discount') {
      applyDiscountCode();
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

    // Set payment method in state
    state.paymentMethod = paymentMethod;

    // Track add_payment_info event when payment method is selected
    const basePrice = state.isSubscription
      ? (state.billingCycle === 'monthly' ? state.product.price_monthly : state.product.price_annually)
      : state.product.price;

    trackAddPaymentInfo(state.product, state.total || basePrice, state.billingCycle, paymentMethod);
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

    // Store form data in state
    state.formData = formData;

    // Wait 1 second to simulate processing time
    if (webManager.isDevelopment()) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Add custom validation if needed
    if (!state.paymentMethod) {
      throw new Error('Please select a payment method');
    }

    // Build payment intent data according to API schema
    const paymentIntentData = buildPaymentIntentData(webManager);

    // Log the structured payment data
    console.log('🟢 Payment intent data:', paymentIntentData);

    // Store pre-payment analytics data
    const analyticsData = {
      transaction_id: state.checkoutId,
      value: state.total,
      currency: 'USD',
      items: [{
        item_name: state.product.name,
        price: state.total,
        quantity: 1
      }]
    };

    // Track initiate checkout event
    if (typeof gtag !== 'undefined') {
      gtag('event', 'begin_checkout', analyticsData);
    }

    // Store order data for confirmation page (legacy format for now)
    const orderData = {
      orderId: state.checkoutId,
      product: state.product.name,
      productId: state.product.id,
      total: state.total,
      subtotal: state.subtotal,
      discountPercent: state.discountPercent,
      billingCycle: state.billingCycle,
      hasFreeTrial: state.hasFreeTrial && state.isSubscription,
      paymentMethod: state.paymentMethod,
      email: webManager.auth().getUser().email,
      timestamp: new Date().toISOString(),
      formData: formData
    };

    sessionStorage.setItem('pendingOrder', JSON.stringify(orderData));

    // Store the payment intent data in state for processors to use
    state.paymentIntentData = paymentIntentData;

    // Process payment with selected processor (will redirect)
    await paymentManager.processPayment(state.paymentMethod);

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
    // Generate or retrieve checkout session ID
    state.checkoutId = generateCheckoutId();
    console.log('Checkout session ID:', state.checkoutId);

    // Get product ID from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('product');
    const frequency = urlParams.get('frequency') || 'annually';
    const _test_appId = urlParams.get('_test_appId');
    const _test_trialEligible = urlParams.get('_test_trialEligible');

    // Product ID is required
    if (!productId) {
      throw new Error('Product ID is missing from URL.');
    }

    // Check for testing parameters
    const appId = _test_appId || webManager.config.brand.id;

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
    state.product = productData.value;
    state.isSubscription = state.product.is_subscription;
    state.hasFreeTrial = state.product.has_free_trial;

    // Create mutable trial eligibility result for testing
    let trialEligibilityResult = trialEligible;

    // Override trial eligibility for testing (only in development)
    if (_test_trialEligible && webManager.isDevelopment()) {
      if (_test_trialEligible === 'false') {
        trialEligibilityResult = { status: 'fulfilled', value: false };
      } else if (_test_trialEligible === 'true') {
        trialEligibilityResult = { status: 'fulfilled', value: true };
      }
    }

    // Apply trial eligibility with server/test response
    if (trialEligibilityResult.status === 'fulfilled') {
      state.hasFreeTrial = trialEligibilityResult.value && state.product.has_free_trial;
    }

    // Initialize payment processors with API keys
    if (state.apiKeys) {
      paymentManager.initialize(state.apiKeys, webManager);
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
      showError('No payment methods are currently available. Please contact support for assistance.');
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
      state.billingCycle = frequency;
      console.log('Setting billing cycle from URL:', frequency);
    }

    // Update UI with product details
    updateAllUI();

    // Set up event listeners and FormManager
    setupEventListeners();

    // Set form to ready state
    formManager.setFormState('ready');

    // Track begin_checkout event on page load
    const basePrice = state.isSubscription
      ? (state.billingCycle === 'monthly' ? state.product.price_monthly : state.product.price_annually)
      : state.product.price;

    trackBeginCheckout(state.product, basePrice, state.billingCycle);
    console.log('Tracked begin_checkout event for:', state.product.id);

    // Auto-apply welcome coupon
    autoApplyWelcomeCoupon();

  } catch (error) {
    console.error('Checkout initialization failed:', error);
    showError(error.message || 'Failed to load checkout. Please refresh the page and try again.');
  } finally {
    // Hide preloader once everything is loaded (success or failure)
    webManager.auth().listen({}, () => {
      hidePreloader();
    });
  }
}
