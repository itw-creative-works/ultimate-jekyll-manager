// Libraries
// ...

// Module
export default (Manager, options) => {
  return new Promise(async function (resolve, reject) {
    // Shortcuts
    const { webManager } = Manager;

    // Configuration
    const config = {
      selectors: {
        billingRadios: 'input[name="billing"]',
        amountElements: '.amount',
        billingInfoElements: '.billing-info',
        pricePerUnitElements: '.price-per-unit',
        planButtons: '.btn-primary',
        cardTitle: '.card-title'
      }
    };

    // Setup billing toggle functionality
    function setupBillingToggle() {
      const billingRadios = document.querySelectorAll(config.selectors.billingRadios);
      const amountElements = document.querySelectorAll(config.selectors.amountElements);
      const billingInfoElements = document.querySelectorAll(config.selectors.billingInfoElements);
      const pricePerUnitElements = document.querySelectorAll(config.selectors.pricePerUnitElements);

      // Debug log to check if elements are found
      console.log('Amount elements found:', amountElements.length);
      console.log('Billing info elements found:', billingInfoElements.length);
      console.log('Price per unit elements found:', pricePerUnitElements.length);

      billingRadios.forEach(radio => {
        radio.addEventListener('change', function() {
          const billingType = this.dataset.billing;
          console.log('Billing type changed to:', billingType);
          updatePricing(billingType, amountElements, billingInfoElements, pricePerUnitElements);
        });
      });
    }

    // Update pricing display based on billing type
    function updatePricing(billingType, amountElements, billingInfoElements, pricePerUnitElements) {
      // Update prices
      amountElements.forEach(amount => {
        const newPrice = billingType === 'monthly'
          ? amount.dataset.monthly
          : amount.dataset.annually;
        
        console.log(`Updating price from ${amount.textContent} to ${newPrice} (${billingType})`);
        console.log('Monthly value:', amount.dataset.monthly, 'Annual value:', amount.dataset.annually);
        
        // Update the text content with the new price
        amount.textContent = newPrice;
      });

      // Update billing info
      billingInfoElements.forEach(info => {
        const newText = billingType === 'monthly'
          ? info.dataset.monthly
          : info.dataset.annually;
        
        info.textContent = newText;
      });

      // Update price per unit
      pricePerUnitElements.forEach(pricePerUnit => {
        const newPricePerUnit = billingType === 'monthly'
          ? pricePerUnit.dataset.monthly
          : pricePerUnit.dataset.annually;
        
        pricePerUnit.textContent = newPricePerUnit;
      });
    }

    // Setup plan button click handlers
    function setupPlanButtons() {
      // Select all buttons with data-plan-id attribute
      const planButtons = document.querySelectorAll('button[data-plan-id]');

      planButtons.forEach(button => {
        button.addEventListener('click', function() {
          handlePlanSelection(this);
        });
      });
    }

    // Track add to cart event to all analytics providers
    function trackAddToCart(planId, planName, price, billingType) {
      const items = [{
        item_id: planId,
        item_name: planName,
        item_category: 'subscription',
        item_variant: billingType,
        price: price,
        quantity: 1
      }];

      // Google Analytics 4
      gtag('event', 'add_to_cart', {
        currency: 'USD',
        value: price,
        items: items
      });

      // Facebook Pixel
      fbq('track', 'AddToCart', {
        content_ids: [planId],
        content_name: planName,
        content_type: 'product',
        currency: 'USD',
        value: price
      });

      // TikTok Pixel
      ttq.track('AddToCart', {
        content_id: planId,
        content_type: 'product',
        content_name: planName,
        price: price,
        quantity: 1,
        currency: 'USD',
        value: price
      });
    }

    // Handle plan selection
    function handlePlanSelection(button) {
      const planId = button.dataset.planId;
      const billingType = document.querySelector(`${config.selectors.billingRadios}:checked`)?.dataset.billing || 'monthly';

      if (!planId) return;

      // Get plan name and price for analytics
      const card = button.closest('.card');
      const planNameElement = card?.querySelector('.h3, .h2, .card-title');
      const planName = planNameElement?.textContent || planId;
      const priceElement = card?.querySelector('.amount');
      const price = priceElement ? parseFloat(priceElement.textContent) : 0;

      // Track add to cart event
      trackAddToCart(planId, planName, price, billingType);

      // Log for debugging
      console.log(`Added to cart: ${planId} (${billingType} frequency) - $${price}`);

      // Special handling for enterprise plan
      if (planId === 'enterprise') {
        window.location.href = '/contact';
        return;
      }

      // Build URL going directly to checkout (skip cart page)
      const url = new URL('/payment/checkout', window.location.origin);
      url.searchParams.set('product', planId);
      
      // Add frequency parameter for non-basic plans
      if (planId !== 'basic') {
        url.searchParams.set('frequency', billingType);
      }

      // Redirect directly to checkout
      window.location.href = url.toString();
    }

    // Initialize pricing functionality
    function init() {
      setupBillingToggle();
      setupPlanButtons();
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }

    // Resolve
    return resolve();
  });
};
