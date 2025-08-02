// Libraries
let webManager = null;
let formManager = null;

// Import modules
import { state } from './modules/state.js';
import { fetchProductDetails, fetchTrialEligibility } from './modules/api.js';
import { initializeRecaptcha } from './modules/recaptcha.js';
import {
  updateAllUI,
  handleBillingCycleChange,
  showError,
  hidePreloader
} from './modules/ui.js';
import { applyDiscountCode, autoApplyWelcomeCoupon } from './modules/discount.js';
import { paymentManager } from './processors/index.js';
import { FormManager } from '__main_assets__/js/libs/form-manager.js';

// Variables
const recaptchaSiteKey = '6LdxsmAnAAAAACbft_UmKZXJV_KTEiuG-7tfgJJ5';

// Setup event listeners using FormManager
function setupEventListeners() {
  // Initialize FormManager
  formManager = new FormManager('#checkout-form', {
    autoDisable: true, // Enable automatic form disabling during submission
    showSpinner: true,
    allowMultipleSubmit: false, // Prevent multiple submissions
    errorContainer: '.form-error-message', // Use class to support multiple containers
    submitButtonLoadingText: 'Processing payment...'
  });

  // Listen for form field changes
  formManager.addEventListener('change', (event) => {
    const { fieldName, fieldValue } = event.detail;

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
    state.paymentMethod = paymentMethod === 'stripe' ? 'card' : paymentMethod;

    // Process the payment
    await completePurchase();
  });

  // Switch account link (keep as is - not part of form)
  const switchAccountLink = document.getElementById('switch-account');
  if (switchAccountLink) {
    const currentUrl = encodeURIComponent(window.location.href);
    switchAccountLink.href = `/signin?authSignout=true&authReturnUrl=${currentUrl}`;
  }
}

// Complete purchase
async function completePurchase() {
  try {
    // Get form data from FormManager
    const formData = formManager.getData();

    // Wait 1 second to simulate processing time
    if (webManager.isDevelopment()) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Add custom validation if needed
    if (!state.paymentMethod) {
      throw new Error('Please select a payment method');
    }

    // Log collected form data
    console.log('🟢 Collected form data:', formData);

    // Store pre-payment analytics data
    const analyticsData = {
      transaction_id: 'ORD-' + Date.now(),
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

    // Store order data for confirmation page
    const orderData = {
      orderId: analyticsData.transaction_id + '-' + Math.random().toString(36).substring(2, 9),
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
      formData: formData // Include form data
    };

    sessionStorage.setItem('pendingOrder', JSON.stringify(orderData));

    // Store form data in state for processors to access
    state.formData = formData;

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

    // Check for specific error types
    if (error.message.includes('not configured') || error.message.includes('not available')) {
      formManager.showError('This payment method is currently unavailable. Please try another payment method or contact support.');
    } else {
      formManager.showError(errorMessage);
    }
  }
}

// Initialize checkout with parallel API calls
async function initializeCheckout() {
  try {
    // Update main tag alignment for checkout page
    const mainTag = document.querySelector('main');
    if (mainTag) {
      mainTag.classList.remove('align-items-center');
      mainTag.classList.add('align-items-start');
    }

    // Get product ID from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const _test_appId = urlParams.get('_test_appId') || webManager.config.brand.id;
    const productId = urlParams.get('productId');

    // Product ID is required
    if (!productId) {
      throw new Error('Product ID is missing from URL.');
    }

    // Check for testing parameters
    const _test_trialEligible = urlParams.get('_test_trialEligible');

    // Fetch product details, trial eligibility, and initialize reCAPTCHA in parallel
    const [productData, trialEligible, recaptchaInit] = await Promise.allSettled([
      fetchProductDetails(_test_appId, productId, webManager),
      fetchTrialEligibility(productId),
      initializeRecaptcha(recaptchaSiteKey, webManager)
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

    // Log available payment methods
    const availableMethods = paymentManager.getAvailablePaymentMethods();
    console.log('Available payment methods:');
    availableMethods.forEach(method => {
      console.log(`- ${method.name} (${method.processor})`);
    });

    // Log reCAPTCHA initialization result
    if (recaptchaInit.status === 'rejected') {
      console.warn('reCAPTCHA initialization failed:', recaptchaInit.reason);
    } else if (!recaptchaInit.value) {
      console.warn('reCAPTCHA was not initialized (no site key or initialization failed)');
    }

    // Update UI with product details
    updateAllUI();

    // Set up event listeners and FormManager
    setupEventListeners();

    // Set form to ready state
    if (formManager) {
      formManager.setFormState('ready');
    }

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

// Module export
export default (Manager) => {
  return new Promise(async function (resolve) {
    // Shortcuts
    webManager = Manager.webManager;

    // Initialize when DOM is ready
    webManager.dom().ready()
    .then(() => {
      // Initialize checkout
      initializeCheckout();
    });

    // Resolve
    return resolve();
  });
}
