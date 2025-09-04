// Libraries
let webManager = null;

/* Test URL
  https://localhost:3000/payment/confirmation?order_id=ORD-TRIAL-123&product_id=pro&product_name=Pro%20Plan&amount=0&currency=USD&frequency=annually&payment_method=stripe&trial=true&track=true
*/

// Module
export default (Manager, options) => {
  return new Promise(async function (resolve) {
    // Set webManager
    webManager = Manager.webManager;

    // Initialize when DOM is ready
    await webManager.dom().ready();
    
    loadOrderData();
    await triggerCelebration();
    
    // Resolve after initialization
    return resolve();
  });
};

// Load order data from URL parameters
function loadOrderData() {
  const urlParams = new URLSearchParams(window.location.search);

  // Parse order data from URL
  const orderData = {
    orderId: urlParams.get('order_id') || urlParams.get('transaction_id'),
    productId: urlParams.get('product_id') || urlParams.get('product'),
    productName: urlParams.get('product_name'),
    total: parseFloat(urlParams.get('amount') || urlParams.get('total') || 0),
    currency: urlParams.get('currency') || 'USD',
    billingCycle: urlParams.get('frequency') || urlParams.get('billing_cycle'),
    paymentMethod: urlParams.get('payment_method'),
    hasFreeTrial: urlParams.get('trial') === 'true',
    email: urlParams.get('email')
  };

  // DOM elements
  const $orderNumber = document.getElementById('order-number');
  const $productName = document.getElementById('product-name');
  const $totalPaid = document.getElementById('total-paid');
  const $subscriptionInfo = document.getElementById('subscription-info');
  const $billingInfo = document.getElementById('billing-info');

  if (orderData.orderId) {
    // Populate order details
    if ($orderNumber) $orderNumber.textContent = orderData.orderId;
    if ($productName) $productName.textContent = orderData.productName || orderData.productId || 'Product';
    if ($totalPaid) $totalPaid.textContent = `$${orderData.total.toFixed(2)}`;

    // Handle subscription information
    if (orderData.billingCycle && $subscriptionInfo) {
      $subscriptionInfo.classList.remove('d-none');

      if ($billingInfo) {
        if (orderData.hasFreeTrial) {
          $billingInfo.innerHTML = `
            <strong>Free Trial Active!</strong> Your trial period has begun.
            You'll be charged ${orderData.billingCycle === 'monthly' ? 'monthly' : 'annually'} after the trial ends.
          `;
        } else {
          $billingInfo.innerHTML = `
            Your ${orderData.billingCycle} subscription is now active.
            You'll be charged automatically each ${orderData.billingCycle === 'monthly' ? 'month' : 'year'}.
          `;
        }
      }
    }

    // Track analytics only if not already tracked
    trackPurchaseIfNotTracked(orderData);
  } else {
    // Fallback for direct page access without params
    if ($orderNumber) $orderNumber.textContent = generateOrderNumber();
    if ($productName) $productName.textContent = 'Your Purchase';
    if ($totalPaid) $totalPaid.textContent = '$0.00';
  }
}

// Generate a mock order number
function generateOrderNumber() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `ORD-${timestamp}-${random}`;
}

// Trigger celebration animation
async function triggerCelebration() {
  try {
    // Load confetti library using webManager
    await webManager.dom().loadScript({
      src: 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js'
    });

    // Fire confetti
    window.confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#5b6fff', '#8b5cf6', '#22d3ee', '#34d399', '#fb923c']
    });

    // Optional: Fire from multiple angles for more celebration
    setTimeout(() => {
      window.confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#5b6fff', '#8b5cf6', '#22d3ee']
      });
    }, 250);

    setTimeout(() => {
      window.confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#34d399', '#fb923c', '#5b6fff']
      });
    }, 400);

  } catch (error) {
    console.log('Confetti library failed to load:', error);
  }
}

// Track purchase only if not already tracked for this order
function trackPurchaseIfNotTracked(orderData) {
  const urlParams = new URLSearchParams(window.location.search);
  const shouldTrack = urlParams.get('track') === 'true';

  // Only track if the track parameter is present and true
  if (!shouldTrack) {
    console.log('Tracking parameter not present or false, skipping tracking');
    return;
  }

  // Track the purchase
  trackPurchase(orderData);

  // Remove only the 'track' parameter from URL to prevent re-tracking on refresh
  urlParams.delete('track');
  const newUrl = urlParams.toString()
    ? `${window.location.pathname}?${urlParams.toString()}`
    : window.location.pathname;

  window.history.replaceState({}, document.title, newUrl);
  console.log('Removed track parameter from URL to prevent duplicate tracking');

  // Also store in localStorage as backup (in case user navigates back with track=true)
  const trackedOrders = JSON.parse(localStorage.getItem('trackedPurchases') || '[]');
  if (!trackedOrders.includes(orderData.orderId)) {
    trackedOrders.push(orderData.orderId);

    // Keep only last 50 orders
    if (trackedOrders.length > 50) {
      trackedOrders.shift();
    }

    localStorage.setItem('trackedPurchases', JSON.stringify(trackedOrders));
  }
}

// Track purchase event to all analytics providers
function trackPurchase(orderData) {
  // Prepare items array for consistent tracking
  const items = [{
    item_id: orderData.productId,
    item_name: orderData.productName || orderData.productId,
    item_category: orderData.billingCycle ? 'subscription' : 'one-time',
    item_variant: orderData.billingCycle,
    price: orderData.total,
    quantity: 1
  }];

  // Google Analytics 4
  gtag('event', 'purchase', {
    transaction_id: orderData.orderId,
    value: orderData.total,
    currency: orderData.currency,
    items: items
  });

  // Facebook Pixel
  fbq('track', 'Purchase', {
    content_ids: [orderData.productId],
    content_name: orderData.productName || orderData.productId,
    content_type: 'product',
    currency: orderData.currency,
    value: orderData.total,
    num_items: 1
  });

  // TikTok Pixel
  ttq.track('CompletePayment', {
    content_id: orderData.productId,
    content_type: 'product',
    content_name: orderData.productName || orderData.productId,
    price: orderData.total,
    quantity: 1,
    currency: orderData.currency,
    value: orderData.total
  });

  console.log('Tracked purchase event:', {
    orderId: orderData.orderId,
    productId: orderData.productId,
    total: orderData.total,
    currency: orderData.currency
  });
}
