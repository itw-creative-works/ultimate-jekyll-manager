// Coinbase Commerce payment processor
import { createPaymentIntent } from '../payment-request.js';

export class CoinbaseProcessor {
  constructor(webManager) {
    this.webManager = webManager;
  }

  // Process the payment
  async processPayment() {
    try {
      console.log('🪙 Coinbase: Processing crypto payment');
      
      // Use unified payment intent handler
      const result = await createPaymentIntent(this.webManager);
      
      // Redirect to Coinbase Commerce checkout
      console.log('🪙 Coinbase: Redirecting to checkout:', result.redirectUrl);
      window.location.href = result.redirectUrl;
      
      // Return a promise that never resolves (we're redirecting)
      return new Promise(() => {});
      
    } catch (error) {
      // Just pass through the error without adding prefixes
      throw error;
    }
  }
}