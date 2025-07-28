// Libraries
// ...

// Module
export default (Manager, options) => {
  return new Promise(async function (resolve, reject) {
    // Shortcuts
    const { webManager } = Manager;

    // Configuration
    const config = {
      redirectDelay: 1000,
      authCheckMethods: ['cookie', 'localStorage', 'sessionStorage'],
      authKeys: {
        cookie: 'auth_token',
        localStorage: 'user_id',
        sessionStorage: 'user_session'
      }
    };
    
    // Check if user is authenticated
    function checkAuthStatus() {
      // Check cookie
      if (config.authCheckMethods.includes('cookie')) {
        if (document.cookie.includes(config.authKeys.cookie)) {
          return true;
        }
      }
      
      // Check localStorage
      if (config.authCheckMethods.includes('localStorage')) {
        if (localStorage.getItem(config.authKeys.localStorage)) {
          return true;
        }
      }
      
      // Check sessionStorage
      if (config.authCheckMethods.includes('sessionStorage')) {
        if (sessionStorage.getItem(config.authKeys.sessionStorage)) {
          return true;
        }
      }
      
      // Additional auth check via webManager
      if (webManager && typeof webManager.isAuthenticated === 'function') {
        return webManager.isAuthenticated();
      }
      
      return false;
    }
    
    // Get product parameter from URL
    function getProductFromUrl() {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('product') || '';
    }
    
    // Track begin checkout event
    function trackBeginCheckout() {
      // Google Analytics 4
      if (typeof gtag !== 'undefined') {
        gtag('event', 'begin_checkout', {
          'event_category': 'ecommerce',
          'event_label': 'cart_to_checkout'
        });
      }
      
      // Facebook Pixel
      if (typeof fbq !== 'undefined') {
        fbq('track', 'InitiateCheckout');
      }
      
      // WebManager analytics
      if (webManager && webManager.analytics) {
        webManager.analytics.track('Begin Checkout', {
          source: 'cart_page'
        });
      }
    }
    
    // Redirect to sign in page
    function redirectToSignIn(productParam) {
      const checkoutUrl = `/order/checkout${productParam ? '?product=' + productParam : ''}`;
      const returnUrl = encodeURIComponent(checkoutUrl);
      const signInUrl = `/auth/signin?return=${returnUrl}`;
      
      // Store intent in sessionStorage for post-login actions
      sessionStorage.setItem('checkout_intent', JSON.stringify({
        product: productParam,
        timestamp: Date.now()
      }));
      
      window.location.href = signInUrl;
    }
    
    // Redirect to checkout page
    function redirectToCheckout(productParam) {
      const checkoutUrl = `/order/checkout${productParam ? '?product=' + productParam : ''}`;
      
      // Show progress indicator
      const progressEl = document.querySelector('.progress-indicator');
      if (progressEl) {
        progressEl.classList.remove('d-none');
      }
      
      // Redirect after delay
      setTimeout(() => {
        window.location.href = checkoutUrl;
      }, config.redirectDelay);
    }
    
    // Show error state
    function showErrorState(message) {
      const container = document.querySelector('.cart-redirect .col-lg-6');
      if (!container) return;
      
      container.innerHTML = `
        <div class="text-center">
          <div class="text-danger display-1 mb-3">
            <i class="fas fa-exclamation-circle"></i>
          </div>
          <h2 class="h4 mb-3">Something went wrong</h2>
          <p class="text-danger fw-medium mb-4">${message || 'Unable to process your request. Please try again.'}</p>
          <button class="btn btn-primary btn-lg mt-3" onclick="location.reload()">
            <i class="fas fa-redo me-2"></i>
            Try Again
          </button>
        </div>
      `;
    }
    
    // Main cart redirect logic
    function handleCartRedirect() {
      try {
        // Track analytics event
        trackBeginCheckout();
        
        // Get product from URL params
        const productParam = getProductFromUrl();
        
        // Check authentication status
        const isSignedIn = checkAuthStatus();
        
        // Perform redirect based on auth status
        if (!isSignedIn) {
          redirectToSignIn(productParam);
        } else {
          redirectToCheckout(productParam);
        }
      } catch (error) {
        console.error('Cart redirect error:', error);
        showErrorState(error.message);
      }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', handleCartRedirect);
    } else {
      handleCartRedirect();
    }

    // Resolve
    return resolve();
  });
}