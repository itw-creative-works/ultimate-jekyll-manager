document.addEventListener('DOMContentLoaded', function() {
  // Billing toggle using Bootstrap's radio buttons
  const billingRadios = document.querySelectorAll('input[name="billing"]');
  const amountElements = document.querySelectorAll('.amount');
  const billingInfoElements = document.querySelectorAll('.billing-info');
  
  billingRadios.forEach(radio => {
    radio.addEventListener('change', function() {
      const billingType = this.dataset.billing;
      
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
    });
  });
  
  // Plan button clicks
  const planButtons = document.querySelectorAll('.btn-primary');
  
  planButtons.forEach(button => {
    button.addEventListener('click', function() {
      const card = this.closest('.card');
      if (card) {
        const planName = card.querySelector('.card-title')?.textContent;
        const billingType = document.querySelector('input[name="billing"]:checked')?.dataset.billing;
        
        if (planName && this.textContent.includes('Get')) {
          console.log(`Selected plan: ${planName} (${billingType} billing)`);
          // Add your checkout/purchase logic here
        }
      }
    });
  });
});