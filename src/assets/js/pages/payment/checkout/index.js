// Libraries
let webManager = null;

// Import modules
import { state } from './modules/state.js';
import { fetchProductDetails, fetchTrialEligibility } from './modules/api.js';
import { initializeRecaptcha } from './modules/recaptcha.js';
import {
  updateAllUI,
  handleBillingCycleChange,
  switchPaymentMethod,
  showError,
  hidePreloader
} from './modules/ui.js';
import { applyDiscountCode, autoApplyWelcomeCoupon } from './modules/discount.js';
import { validateForm } from './modules/validation.js';
import { paymentManager } from './processors/index.js';
import { collectFormData, validateFormData } from './modules/form.js';

const recaptchaSiteKey = '6LdxsmAnAAAAACbft_UmKZXJV_KTEiuG-7tfgJJ5';

// Update available payment methods UI
function updateAvailablePaymentMethods() {
  const availableMethods = paymentManager.getAvailablePaymentMethods();

  // For now, let's allow all payment methods during development
  // The error handling in completePurchase will deal with unavailable processors
  console.log('Available payment methods:' );
  availableMethods.forEach(method => {
    console.log(`- ${method.name} (${method.processor})`);
  });

  // Enable all payment method buttons for testing
  document.querySelectorAll('input[name="payment-method"]').forEach(radio => {
    radio.disabled = false;
    const methodLabel = document.querySelector(`label[for="${radio.id}"]`);
    if (methodLabel) {
      methodLabel.style.opacity = '1';
      methodLabel.style.cursor = 'pointer';
    }
  });
}

// Setup event listeners
function setupEventListeners() {
  // Payment method selection
  document.querySelectorAll('input[name="payment-method"]').forEach(radio => {
    radio.addEventListener('change', function() {
      if (!this.disabled) {
        state.paymentMethod = this.value;
        switchPaymentMethod(this.value);
      }
    });
  });

  // Billing cycle change
  document.querySelectorAll('input[name="billing-cycle"]').forEach(radio => {
    radio.addEventListener('change', function() {
      handleBillingCycleChange(this.value);
    });
  });

  // Discount code
  document.getElementById('apply-discount').addEventListener('click', applyDiscountCode);
  document.getElementById('discount-code').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyDiscountCode();
    }
  });

  // Note: Card form inputs removed since we use Stripe Checkout redirect

  // Complete purchase
  document.getElementById('complete-purchase').addEventListener('click', completePurchase);

  // Switch account
  const switchAccountLink = document.getElementById('switch-account');
  if (switchAccountLink) {
    const currentUrl = encodeURIComponent(window.location.href);
    switchAccountLink.href = `/signin?authSignout=true&authReturnUrl=${currentUrl}`;
  }
}

// Complete purchase
async function completePurchase() {
  if (!validateForm(webManager)) {
    return;
  }

  const btn = document.getElementById('complete-purchase');
  const originalContent = btn.innerHTML;

  // Show loading state
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Processing...';

  try {
    // Collect all form data
    const formData = collectFormData();
    
    // Validate form data
    const validation = validateFormData(formData);
    if (!validation.isValid) {
      showError(validation.errors.join('<br>'));
      btn.disabled = false;
      btn.innerHTML = originalContent;
      return;
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
    btn.disabled = false;
    btn.innerHTML = originalContent;

    // Show user-friendly error message
    const errorMessage = error.message || 'There was an error processing your payment. Please try again.';

    // Check for specific error types
    if (error.message.includes('not configured') || error.message.includes('not available')) {
      showError('This payment method is currently unavailable. Please try another payment method or contact support.');
    } else {
      showError(errorMessage);
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
      initializeRecaptcha(recaptchaSiteKey)
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
    
    // Log reCAPTCHA initialization result
    if (recaptchaInit.status === 'rejected') {
      console.warn('reCAPTCHA initialization failed:', recaptchaInit.reason);
    } else if (!recaptchaInit.value) {
      console.warn('reCAPTCHA was not initialized (no site key or initialization failed)');
    }

    // Update UI with product details
    updateAllUI();

    // Set up event listeners
    setupEventListeners();

    // Auto-apply welcome coupon
    autoApplyWelcomeCoupon();

    // Hide/disable unavailable payment methods
    updateAvailablePaymentMethods();

  } catch (error) {
    console.error('Checkout initialization failed:', error);
    showError(error.message || 'Failed to load checkout. Please refresh the page and try again.');
  } finally {
    // Hide preloader once everything is loaded (success or failure)
    webManager.auth().listen({}, (state) => {
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
