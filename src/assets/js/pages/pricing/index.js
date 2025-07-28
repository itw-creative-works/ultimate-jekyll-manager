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
        planButtons: '.btn-primary',
        cardTitle: '.card-title'
      }
    };
    
    // Setup billing toggle functionality
    function setupBillingToggle() {
      const billingRadios = document.querySelectorAll(config.selectors.billingRadios);
      const amountElements = document.querySelectorAll(config.selectors.amountElements);
      const billingInfoElements = document.querySelectorAll(config.selectors.billingInfoElements);
      
      billingRadios.forEach(radio => {
        radio.addEventListener('change', function() {
          const billingType = this.dataset.billing;
          updatePricing(billingType, amountElements, billingInfoElements);
        });
      });
    }
    
    // Update pricing display based on billing type
    function updatePricing(billingType, amountElements, billingInfoElements) {
      // Update prices
      amountElements.forEach(amount => {
        amount.textContent = billingType === 'monthly' 
          ? amount.dataset.monthly 
          : amount.dataset.yearly;
      });
      
      // Update billing info
      billingInfoElements.forEach(info => {
        info.textContent = billingType === 'monthly'
          ? info.dataset.monthly
          : info.dataset.yearly;
      });
    }
    
    // Setup plan button click handlers
    function setupPlanButtons() {
      const planButtons = document.querySelectorAll(config.selectors.planButtons);
      
      planButtons.forEach(button => {
        button.addEventListener('click', function(e) {
          handlePlanSelection(this);
        });
      });
    }
    
    // Handle plan selection
    function handlePlanSelection(button) {
      const card = button.closest('.card');
      if (!card) return;
      
      const planName = card.querySelector(config.selectors.cardTitle)?.textContent;
      const billingType = document.querySelector(`${config.selectors.billingRadios}:checked`)?.dataset.billing;
      
      if (planName && button.textContent.includes('Get')) {
        // Track analytics
        if (webManager && webManager.analytics) {
          webManager.analytics.track('Plan Selected', {
            plan: planName,
            billing: billingType
          });
        }
        
        // Log for debugging
        console.log(`Selected plan: ${planName} (${billingType} billing)`);
        
        // Redirect to checkout or handle purchase
        const checkoutUrl = `/order/checkout?plan=${encodeURIComponent(planName)}&billing=${billingType}`;
        window.location.href = checkoutUrl;
      }
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