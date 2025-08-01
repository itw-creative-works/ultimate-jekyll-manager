// Libraries
// ...

// Module
export default (Manager, options) => {
  return new Promise(async function (resolve, reject) {
    // Shortcuts
    const { webManager } = Manager;

    // Load order data from sessionStorage
    function loadOrderData() {
      const orderData = JSON.parse(sessionStorage.getItem('orderData') || '{}');

      // DOM elements
      const orderNumber = document.getElementById('order-number');
      const productName = document.getElementById('product-name');
      const totalPaid = document.getElementById('total-paid');
      const subscriptionInfo = document.getElementById('subscription-info');
      const billingInfo = document.getElementById('billing-info');

      if (orderData.orderId) {
        // Populate order details
        orderNumber.textContent = orderData.orderId;
        productName.textContent = orderData.product || 'Product';
        totalPaid.textContent = `$${(orderData.total || 0).toFixed(2)}`;

        // Handle subscription information
        if (orderData.billingCycle) {
          subscriptionInfo.classList.remove('d-none');

          if (orderData.hasFreeTrial) {
            billingInfo.innerHTML = `
              <strong>Free Trial Active!</strong> Your trial period has begun.
              You'll be charged ${orderData.billingCycle === 'monthly' ? 'monthly' : 'yearly'} after the trial ends.
            `;
          } else {
            billingInfo.innerHTML = `
              Your ${orderData.billingCycle} subscription is now active.
              You'll be charged automatically each ${orderData.billingCycle === 'monthly' ? 'month' : 'year'}.
            `;
          }
        }

        // Track analytics
        trackPurchaseSuccess(orderData);

        // Clear order data after displaying
        sessionStorage.removeItem('orderData');
      } else {
        // Fallback for direct page access
        orderNumber.textContent = generateOrderNumber();
        productName.textContent = 'Your Purchase';
        totalPaid.textContent = '$0.00';
      }
    }

    // Generate a mock order number
    function generateOrderNumber() {
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000);
      return `ORD-${timestamp}-${random}`;
    }

    // Trigger celebration animation
    function triggerCelebration() {
      // Check if confetti library is available
      if (typeof window.confetti !== 'undefined') {
        window.confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#5b6fff', '#8b5cf6', '#22d3ee', '#34d399', '#fb923c']
        });
      } else {
        // Fallback celebration
        showFallbackCelebration();
      }
    }

    // Fallback celebration if confetti is not available
    function showFallbackCelebration() {
      const celebration = document.createElement('div');
      celebration.className = 'confetti-fallback';
      celebration.innerHTML = '🎉';
      celebration.style.fontSize = '5rem';
      celebration.style.position = 'fixed';
      celebration.style.top = '50%';
      celebration.style.left = '50%';
      celebration.style.transform = 'translate(-50%, -50%)';
      celebration.style.pointerEvents = 'none';
      celebration.style.zIndex = '9999';

      document.body.appendChild(celebration);

      // Trigger animation
      setTimeout(() => {
        celebration.classList.add('celebrate');
      }, 10);

      // Remove after animation
      setTimeout(() => {
        celebration.remove();
      }, 1000);
    }

    // Track purchase success
    function trackPurchaseSuccess(orderData) {
      // Google Analytics 4
      if (typeof gtag !== 'undefined') {
        gtag('event', 'purchase', {
          transaction_id: orderData.orderId,
          value: orderData.total,
          currency: 'USD',
          items: [{
            item_name: orderData.product,
            price: orderData.total,
            quantity: 1
          }]
        });
      }

      // Facebook Pixel
      if (typeof fbq !== 'undefined') {
        fbq('track', 'Purchase', {
          value: orderData.total,
          currency: 'USD',
          content_ids: [orderData.orderId],
          content_type: 'product'
        });
      }

      // WebManager analytics
      if (webManager && webManager.analytics) {
        webManager.analytics.track('Order Confirmed', {
          orderId: orderData.orderId,
          product: orderData.product,
          total: orderData.total,
          billing_cycle: orderData.billingCycle,
          payment_method: orderData.paymentMethod
        });
      }
    }

    // Initialize confirmation page
    function init() {
      loadOrderData();
      triggerCelebration();
    }

    // Initialize when DOM is ready
    webManager.dom().ready()
    .then(() => {
      init();
    });

    // Resolve
    return resolve();
  });
}
