// Libraries
// ...

// Configuration
const config = {
  discountCodes: {
    'FLASH20': 20,
    'SAVE10': 10,
    'WELCOME15': 15
  }
};

// State management
let state = {
  product: null,
  billingCycle: 'yearly',
  discountPercent: 0,
  subtotal: 0,
  total: 0,
  isSubscription: false,
  hasFreeTrial: false,
  paymentMethod: 'card'
};

// Fetch product details
async function fetchProductDetails(productId) {
  try {
    // Fallback test data
    return {
      id: 'pro-plan',
      name: 'Pro Plan',
      description: 'Advanced features for power users',
      price_monthly: 29,
      price_yearly: 290,
      is_subscription: true,
      has_free_trial: true,
      free_trial_days: 14
    };
  } catch (error) {
    console.error('Error fetching product details:', error);
    throw error;
  }
}

// Fetch trial eligibility from server
async function fetchTrialEligibility(productId) {
  try {
    // Simulate API call to check trial eligibility
    // Replace with actual API endpoint
    const response = await fetch(`/api/trial-eligibility?product=${productId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error('Trial eligibility check failed');
    }

    const data = await response.json();
    return data.eligible || false;
  } catch (error) {
    console.warn('Trial eligibility check failed, assuming not eligible:', error);
    return false; // Default to not eligible if API fails
  }
}

// Unified UI update function - handles all state changes
function updateAllUI() {
  // Update product info
  document.getElementById('product-name').textContent = state.product.name;
  document.getElementById('product-description').textContent = state.product.description;

  if (state.isSubscription) {
    // Show subscription toggle
    document.getElementById('subscription-toggle').classList.remove('d-none');

    // Update prices in toggle buttons
    document.getElementById('monthly-price-lg').textContent = `$${state.product.price_monthly}.00`;
    document.getElementById('yearly-price-lg').textContent = `$${state.product.price_yearly}.00`;

    // Calculate and update savings percentage
    const monthlyAnnual = state.product.price_monthly * 12;
    const yearlyPrice = state.product.price_yearly;
    const savingsPercent = Math.round(((monthlyAnnual - yearlyPrice) / monthlyAnnual) * 100);

    // Update savings badge text
    const savingsBadge = document.getElementById('savings-badge');
    if (savingsBadge) {
      savingsBadge.textContent = `Save ${savingsPercent}%`;
    }

    // Get current pricing
    const basePrice = state.billingCycle === 'monthly'
      ? state.product.price_monthly
      : state.product.price_yearly;

    // Calculate discounted price
    const discountAmount = (basePrice * state.discountPercent) / 100;
    const discountedPrice = basePrice - discountAmount;

    const period = state.billingCycle === 'monthly' ? '/mo' : '/yr';
    const periodText = state.billingCycle === 'monthly' ? 'monthly' : 'yearly';

    // Update product price display (show discounted price)
    document.getElementById('product-price').textContent = `$${discountedPrice.toFixed(2)}${period}`;

    // Update recurring amount display (show discounted price)
    document.getElementById('recurring-amount').innerHTML =
      `$${discountedPrice.toFixed(2)} <span id="recurring-period">${periodText}</span>`;

    // Update button visual states
    const monthlyLabel = document.querySelector('label[for="monthly"]');
    const yearlyLabel = document.querySelector('label[for="yearly"]');
    const monthlyCheckmark = monthlyLabel?.querySelector('span.rounded-circle');
    const yearlyCheckmark = yearlyLabel?.querySelector('span.rounded-circle');

    if (monthlyLabel && yearlyLabel && monthlyCheckmark && yearlyCheckmark) {
      // Remove any existing selected state
      monthlyLabel.classList.remove('billing-selected');
      yearlyLabel.classList.remove('billing-selected');

      if (state.billingCycle === 'monthly') {
        // Monthly is selected
        document.getElementById('monthly').checked = true;
        monthlyLabel.classList.add('billing-selected');
        monthlyCheckmark.className = 'bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center';
        yearlyCheckmark.className = 'bg-secondary bg-opacity-25 text-secondary rounded-circle d-inline-flex align-items-center justify-content-center';
      } else {
        // Yearly is selected
        document.getElementById('yearly').checked = true;
        yearlyLabel.classList.add('billing-selected');
        yearlyCheckmark.className = 'bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center';
        monthlyCheckmark.className = 'bg-secondary bg-opacity-25 text-secondary rounded-circle d-inline-flex align-items-center justify-content-center';
      }
    }

    // Update trial badge based on current state
    const trialBadge = document.getElementById('trial-badge');
    const trialMessage = document.getElementById('trial-message');

    if (state.hasFreeTrial) {
      trialBadge.classList.remove('d-none');
      trialMessage.textContent = `Start with a ${state.product.free_trial_days}-day free trial`;
    } else {
      trialBadge.classList.add('d-none');
    }

    // Update complete purchase button text based on trial
    const purchaseBtn = document.getElementById('complete-purchase');
    if (state.hasFreeTrial) {
      purchaseBtn.textContent = 'Start Free Trial';
    } else {
      purchaseBtn.textContent = 'Complete Purchase';
    }

    // Update subscription terms
    updateSubscriptionTerms();

    // Calculate and update all pricing
    calculatePrices();
  } else {
    // One-time purchase
    document.getElementById('product-price').textContent = `$${state.product.price}`;
    calculatePrices();
  }
}

    // Update subscription terms text
    function updateSubscriptionTerms() {
      const termsDiv = document.getElementById('subscription-terms');
      const termsText = document.getElementById('terms-text');

      if (!state.isSubscription) {
        termsDiv.classList.add('d-none');
        return;
      }

      if (state.hasFreeTrial) {
        // Calculate trial end date
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + state.product.free_trial_days);

        const formattedDate = trialEndDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });

        const basePrice = state.billingCycle === 'monthly'
          ? state.product.price_monthly
          : state.product.price_yearly;

        // Apply discount to the recurring price (always calculate, even if 0%)
        const discountAmount = (basePrice * state.discountPercent) / 100;
        const discountedPrice = basePrice - discountAmount;

        const periodText = state.billingCycle === 'monthly' ? 'monthly' : 'yearly';

        termsText.textContent = `You won't be charged for your free trial. On ${formattedDate}, your ${periodText} subscription will start and you'll be charged $${discountedPrice.toFixed(2)} plus applicable tax. Cancel anytime before then.`;
        termsDiv.classList.remove('d-none');
      } else {
        // No trial - show regular subscription terms with renewal date
        const periodText = state.billingCycle === 'monthly' ? 'monthly' : 'yearly';
        const basePrice = state.billingCycle === 'monthly'
          ? state.product.price_monthly
          : state.product.price_yearly;

        // Apply discount to the recurring price (always calculate, even if 0%)
        const discountAmount = (basePrice * state.discountPercent) / 100;
        const discountedPrice = basePrice - discountAmount;

        // Calculate next renewal date (30 days for monthly, 365 days for yearly)
        const renewalDate = new Date();
        const daysToAdd = state.billingCycle === 'monthly' ? 30 : 365;
        renewalDate.setDate(renewalDate.getDate() + daysToAdd);

        const formattedRenewalDate = renewalDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });

        termsText.textContent = `Your ${periodText} subscription will start today and renew on ${formattedRenewalDate} for $${discountedPrice.toFixed(2)} plus applicable tax. Cancel anytime.`;
        termsDiv.classList.remove('d-none');
      }
    }

    // Update product display (legacy wrapper)
    function updateProductDisplay() {
      updateAllUI();
    }

    // Setup event listeners
    function setupEventListeners() {
      // Payment method selection
      document.querySelectorAll('input[name="payment-method"]').forEach(radio => {
        radio.addEventListener('change', function() {
          state.paymentMethod = this.value;
          switchPaymentMethod(this.value);
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

      // Form inputs - Format card number
      const cardNumberInput = document.getElementById('cardNumber');
      if (cardNumberInput) {
        cardNumberInput.addEventListener('input', function(e) {
          let value = e.target.value.replace(/\s/g, '');
          let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
          e.target.value = formattedValue;
        });
      }

      // Format expiry date
      const expiryInput = document.getElementById('cardExpiry');
      if (expiryInput) {
        expiryInput.addEventListener('input', function(e) {
          let value = e.target.value.replace(/\D/g, '');
          if (value.length >= 2) {
            value = value.slice(0, 2) + ' / ' + value.slice(2, 4);
          }
          e.target.value = value;
        });
      }

      // Complete purchase
      document.getElementById('complete-purchase').addEventListener('click', completePurchase);
    }

    // Switch payment method
    function switchPaymentMethod(method) {
      // Hide all payment forms
      document.querySelectorAll('.payment-form').forEach(form => {
        form.classList.add('d-none');
      });

      // Show selected payment form
      document.getElementById(`payment-form-${method}`).classList.remove('d-none');
    }

    // Centralized billing cycle change handler
    function handleBillingCycleChange(newCycle = null) {
      // Update state if a specific cycle is provided
      if (newCycle && newCycle !== state.billingCycle) {
        state.billingCycle = newCycle;
      }

      // Update all UI elements
      updateAllUI();
    }

    // Hide all discount messages
    function hideAllDiscountMessages() {
      document.getElementById('discount-message-loading').classList.add('d-none');
      document.getElementById('discount-message-success').classList.add('d-none');
      document.getElementById('discount-message-error').classList.add('d-none');
    }

    // Apply discount code
    function applyDiscountCode() {
      const codeInput = document.getElementById('discount-code');
      const applyBtn = document.getElementById('apply-discount');
      const code = codeInput.value.trim().toUpperCase();

      if (code === '') {
        hideAllDiscountMessages();
        document.getElementById('error-text').textContent = 'Please enter a discount code';
        document.getElementById('discount-message-error').classList.remove('d-none');
        return;
      }

      // Show loading state
      applyBtn.disabled = true;
      applyBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
      hideAllDiscountMessages();
      document.getElementById('discount-message-loading').classList.remove('d-none');

      // Simulate API check with timeout
      setTimeout(() => {
        applyBtn.disabled = false;
        applyBtn.textContent = 'Apply';
        hideAllDiscountMessages();

        if (config.discountCodes[code]) {
          state.discountPercent = config.discountCodes[code];

          document.getElementById('success-text').textContent = `Discount applied: ${state.discountPercent}% off`;
          document.getElementById('discount-message-success').classList.remove('d-none');

          // Update discount percent display
          document.getElementById('discount-percent').textContent = `${state.discountPercent}%`;

          updateAllUI();
        } else {
          document.getElementById('error-text').textContent = 'Invalid discount code';
          document.getElementById('discount-message-error').classList.remove('d-none');

          // Reset discount
          state.discountPercent = 0;
          updateAllUI();
        }
      }, 1000);
    }

    // Calculate prices
    function calculatePrices() {
      let basePrice;

      if (state.isSubscription) {
        basePrice = state.billingCycle === 'monthly'
          ? state.product.price_monthly
          : state.product.price_yearly;
      } else {
        basePrice = state.product.price || 0;
      }

      state.subtotal = basePrice;
      const discountAmount = (state.subtotal * state.discountPercent) / 100;

      // Calculate total after discount
      const discountedTotal = state.subtotal - discountAmount;

      // Update UI
      document.getElementById('subtotal').textContent = `$${state.subtotal.toFixed(2)}`;
      document.getElementById('discount-amount').textContent = discountAmount.toFixed(2);

      // Show/hide discount row
      if (state.discountPercent > 0) {
        document.getElementById('discount-row').classList.remove('d-none');
      } else {
        document.getElementById('discount-row').classList.add('d-none');
      }

      // Handle trial discount
      const trialDiscountRow = document.getElementById('trial-discount-row');
      if (state.hasFreeTrial && state.isSubscription) {
        // Show trial discount (full discounted amount)
        trialDiscountRow.classList.remove('d-none');
        document.getElementById('trial-discount-amount').textContent = discountedTotal.toFixed(2);
        state.total = 0; // Free trial means $0 due today
        document.getElementById('total-price').textContent = '$0.00';
      } else {
        // Hide trial discount
        trialDiscountRow.classList.add('d-none');
        state.total = discountedTotal;
        document.getElementById('total-price').textContent = `$${discountedTotal.toFixed(2)}`;
      }
    }

    // Validate form
    function validateForm() {
      const paymentForm = document.querySelector(`#payment-form-${state.paymentMethod} form`);
      const emailInput = document.getElementById('email');

      // Validate email
      if (!emailInput.value || !emailInput.checkValidity()) {
        emailInput.reportValidity();
        return false;
      }

      // Validate payment form if it exists
      if (paymentForm && !paymentForm.checkValidity()) {
        paymentForm.reportValidity();
        return false;
      }

      return true;
    }

    // Complete purchase
    async function completePurchase() {
      if (!validateForm()) {
        return;
      }

      const btn = document.getElementById('complete-purchase');
      const originalContent = btn.innerHTML;

      // Show loading state
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Processing...';

      try {
        // Simulate payment processing
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Track purchase event
        if (typeof gtag !== 'undefined') {
          gtag('event', 'purchase', {
            transaction_id: 'ORD-' + Date.now(),
            value: state.total,
            currency: 'USD',
            items: [{
              item_name: state.product.name,
              price: state.total,
              quantity: 1
            }]
          });
        }

        // WebManager analytics
        if (webManager && webManager.analytics) {
          webManager.analytics.track('Purchase Completed', {
            product: state.product.name,
            total: state.total,
            billing_cycle: state.billingCycle,
            payment_method: state.paymentMethod
          });
        }

        // Store order data
        const orderData = {
          orderId: 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
          product: state.product.name,
          total: state.total,
          billingCycle: state.billingCycle,
          hasFreeTrial: state.hasFreeTrial && state.isSubscription,
          paymentMethod: state.paymentMethod,
          email: document.getElementById('email').value
        };

        sessionStorage.setItem('orderData', JSON.stringify(orderData));

        // Redirect to confirmation
        window.location.href = '/order/confirmation';

      } catch (error) {
        console.error('Purchase error:', error);
        btn.disabled = false;
        btn.innerHTML = originalContent;

        // Show error message
        alert('There was an error processing your payment. Please try again.');
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
    const productId = urlParams.get('productId');

    // Product ID is required
    if (!productId) {
      throw new Error('Product ID is missing from URL.');
    }

    // Check for testing parameters
    const _test_trialEligible = urlParams.get('_test_trialEligible');

    // Fetch product details and trial eligibility in parallel
    const [productData, trialEligible] = await Promise.allSettled([
      fetchProductDetails(productId),
      fetchTrialEligibility(productId)
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
    if (_test_trialEligible && window.webManager && window.webManager.isDevelopment && window.webManager.isDevelopment()) {
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

    // Update UI with product details
    updateAllUI();

    // Set up event listeners
    setupEventListeners();

    // Auto-insert WELCOME15 coupon code and apply it
    const discountInput = document.getElementById('discount-code');
    if (discountInput) {
      discountInput.value = 'WELCOME15';
      // Automatically apply the coupon
      applyDiscountCode();
    }

  } catch (error) {
    console.error('Checkout initialization failed:', error);
    showError(error.message || 'Failed to load checkout. Please refresh the page and try again.');
  } finally {
    // Hide preloader once everything is loaded (success or failure)
    hidePreloader();
  }
}

// Show error message
function showError(message) {
  const checkoutSection = document.querySelector('section.py-5');
  if (checkoutSection) {
    checkoutSection.innerHTML = `
      <div class="text-center">
        <div class="alert alert-danger" role="alert">
          <h4 class="alert-heading">Oops! Something went wrong</h4>
          <p>${message}</p>
          <hr>
          <button class="btn btn-outline-danger" onclick="window.location.reload()">
            Refresh Page
          </button>
        </div>
      </div>
    `;
  }
}

// Hide preloader with animation
function hidePreloader() {
  const preloader = document.getElementById('checkout-preloader');
  if (preloader) {
    preloader.style.opacity = '0';
    preloader.style.transition = 'opacity 0.3s ease-out';
    setTimeout(() => {
      preloader.remove();
    }, 300);
  }
}

// Module export
export default (Manager, options) => {
  return new Promise(async function (resolve, reject) {
    // Store webManager reference for global access
    window.webManager = Manager?.webManager;

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeCheckout);
    } else {
      initializeCheckout();
    }

    // Resolve
    return resolve();
  });
}
