// Payment Checkout Page
import { FormManager } from '__main_assets__/js/libs/form-manager.js';
import { fetchAppConfig, fetchTrialEligibility, warmupServer, createPaymentIntent } from './modules/api.js';
import { state, buildBindingsState, resolveProcessor } from './modules/state.js';
import { applyDiscountCode, autoApplyWelcomeCoupon } from './modules/discount.js';
import { initializeRecaptcha } from './modules/recaptcha.js';
import { trackBeginCheckout, trackAddPaymentInfo } from './modules/tracking.js';

let webManager = null;
let formManager = null;

// Module export
export default (Manager) => {
  return new Promise(async function (resolve) {
    webManager = Manager.webManager;
    await webManager.dom().ready();
    await initializeCheckout();
    return resolve();
  });
};

// Update UI via bindings (single source of truth)
function updateUI() {
  webManager.bindings().update(buildBindingsState(webManager));
}

// Show fatal error and hide checkout content
function showError(message) {
  state.error = { show: true, message };
  updateUI();
}

// Generate unique checkout session ID
function generateCheckoutId() {
  const urlParams = new URLSearchParams(window.location.search);
  const existing = urlParams.get('checkoutId');
  if (existing) return existing;

  const timestamp = Date.now().toString(36);
  const random1 = Math.random().toString(36).substring(2, 8);
  const random2 = Math.random().toString(36).substring(2, 8);
  return `CHK-${timestamp}-${random1}-${random2}`.toUpperCase();
}

// Initialize checkout
async function initializeCheckout() {
  try {
    // Generate session ID
    state.checkoutId = generateCheckoutId();

    // Parse URL params
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('product');
    const frequency = urlParams.get('frequency') || 'annually';
    const _dev_trialEligible = urlParams.get('_dev_trialEligible');

    if (!productId) {
      throw new Error('Product ID is missing from URL.');
    }

    // Set frequency from URL
    if (frequency === 'monthly' || frequency === 'annually') {
      state.frequency = frequency;
    }

    // Fire-and-forget server warmup
    warmupServer(webManager);

    // Parallel fetch: app config + trial eligibility + reCAPTCHA
    const [appConfigResult, trialResult, recaptchaResult] = await Promise.allSettled([
      fetchAppConfig(webManager),
      fetchTrialEligibility(productId, webManager),
      initializeRecaptcha(webManager.config?.recaptcha?.['site-key'], webManager),
    ]);

    // App config is required
    if (appConfigResult.status === 'rejected') {
      throw new Error(`Failed to load checkout. Please refresh and try again.`);
    }

    const appConfig = appConfigResult.value;
    state.appConfig = appConfig;
    state.processors = appConfig.payment?.processors || {};

    // Find product
    const product = appConfig.payment?.products?.find(p => p.id === productId);
    if (!product) {
      throw new Error(`Product "${productId}" not found.`);
    }
    state.product = product;

    // Trial eligibility
    let trialEligible = trialResult.status === 'fulfilled' ? trialResult.value : false;

    // Dev override for trial
    if (_dev_trialEligible && webManager.isDevelopment()) {
      trialEligible = _dev_trialEligible === 'true';
    }

    // Only eligible if product also supports trials
    state.trialEligible = trialEligible && (product.trial?.days > 0);

    // Check payment methods are available
    const hasPaymentMethods = !!(
      state.processors?.stripe?.publishableKey
      || state.processors?.chargebee?.site
      || state.processors?.paypal?.clientId
      || state.processors?.coinbase?.enabled
    );

    if (!hasPaymentMethods) {
      showError('No payment methods are currently available. Please contact support for assistance.');
      return;
    }

    // Log reCAPTCHA status
    if (recaptchaResult.status === 'rejected') {
      console.warn('reCAPTCHA initialization failed:', recaptchaResult.reason);
    }

    // Update UI with loaded data
    updateUI();

    // Setup form and events
    setupForm();

    // Sync radio button to match URL frequency
    formManager.setData({ frequency: state.frequency });

    // Track begin_checkout
    trackBeginCheckout(state);

    // Auto-apply welcome coupon
    autoApplyWelcomeCoupon(formManager, updateUI);

  } catch (error) {
    console.error('Checkout initialization failed:', error);
    showError(error.message || 'Failed to load checkout. Please refresh the page and try again.');
  }
}

// Setup FormManager and event listeners
function setupForm() {
  formManager = new FormManager('#checkout-form', {
    autoReady: false,
    allowResubmit: false,
    submittingText: 'Processing...',
    submittedText: 'Redirecting...',
  });

  // Frequency changes
  formManager.on('change', ({ name, value }) => {
    if (name !== 'frequency') return;
    if (!value || value === state.frequency) return;

    state.frequency = value;
    updateUI();
  });

  // Form submission (payment)
  formManager.on('submit', async ({ $submitButton }) => {
    if (!$submitButton) {
      throw new Error('Please choose a payment method.');
    }

    const paymentMethod = $submitButton.getAttribute('data-payment-method');
    if (!paymentMethod) {
      throw new Error('Invalid payment method selected.');
    }

    // Track payment info
    trackAddPaymentInfo(state, paymentMethod);

    // Resolve processor (card -> stripe/chargebee, paypal -> paypal, etc.)
    const processor = resolveProcessor(paymentMethod);

    // Create payment intent and redirect
    const response = await createPaymentIntent({
      webManager,
      state,
      processor,
      formData: formManager.getData(),
    });

    // Redirect to processor checkout
    window.location.href = response.url;

    // Never resolves -- we're navigating away
    return new Promise(() => {});
  });

  // Discount button
  const $applyDiscountBtn = document.querySelector('[data-action="apply-discount"]');
  if ($applyDiscountBtn) {
    $applyDiscountBtn.addEventListener('click', () => {
      const data = formManager.getData();
      applyDiscountCode(data.discount, updateUI);
    });
  }

  // Switch account link
  const $switchAccountLink = document.getElementById('switch-account');
  if ($switchAccountLink) {
    const currentUrl = encodeURIComponent(window.location.href);
    $switchAccountLink.href = `/signin?authSignout=true&authReturnUrl=${currentUrl}`;
  }

  // Help button
  const $helpButton = document.getElementById('checkout-help-button');
  if ($helpButton) {
    $helpButton.addEventListener('click', (e) => {
      e.preventDefault();
      chatsy.open();
    });
  }

  // Set form ready
  formManager.ready();

  /* @dev-only:start */
  // Dev mode: expose debug helpers + dev tools panel
  {
    window._checkout = {
      get state() { return JSON.parse(JSON.stringify(state)); },
      get formData() { return formManager.getData(); },
      get bindings() { return buildBindingsState(webManager); },
      resolveProcessor: (method) => resolveProcessor(method || 'card'),
    };
    console.log('%c[Checkout Dev] window._checkout available', 'color: #8B5CF6');

    initDevPanel();
  }
  /* @dev-only:end */
}

/* @dev-only:start */
// Dev tools panel (dev mode only)
function initDevPanel() {
  const $panel = document.getElementById('checkout-dev-panel');
  if (!$panel) return;

  // Show the panel
  $panel.hidden = false;

  const products = state.appConfig?.payment?.products || [];
  const params = new URLSearchParams(window.location.search);

  // Populate product dropdown
  const $productSelect = $panel.querySelector('[data-dev-param="product"]');
  products.forEach(p => {
    const $option = document.createElement('option');
    $option.value = p.id;
    $option.textContent = `${p.name} (${p.type})`;
    $productSelect.appendChild($option);
  });

  // Set current values from URL
  $panel.querySelectorAll('[data-dev-param]').forEach($el => {
    const val = params.get($el.getAttribute('data-dev-param'));
    if (val !== null) $el.value = val;
  });

  // Apply & reload
  document.getElementById('checkout-dev-apply').addEventListener('click', () => {
    const newParams = new URLSearchParams();
    $panel.querySelectorAll('[data-dev-param]').forEach($el => {
      const val = $el.value.trim();
      if (val) newParams.set($el.getAttribute('data-dev-param'), val);
    });
    window.location.search = newParams.toString();
  });
}
/* @dev-only:end */
