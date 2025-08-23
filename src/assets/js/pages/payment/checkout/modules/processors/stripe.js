// Stripe payment processor
import { createPaymentIntent } from '../payment-request.js';

export class StripeProcessor {
  constructor(apiKey, webManager) {
    this.apiKey = apiKey;
    this.webManager = webManager;
  }

  // Process the payment
  async processPayment() {
    try {
      console.log('🔵 Stripe: Processing payment');
      
      // Use unified payment intent handler
      const result = await createPaymentIntent(this.webManager);
      
      // Redirect to Stripe Checkout
      console.log('🔵 Stripe: Redirecting to checkout:', result.redirectUrl);
      window.location.href = result.redirectUrl;
      
      // Return a promise that never resolves (we're redirecting)
      return new Promise(() => {});
      
    } catch (error) {
      // Just pass through the error without adding prefixes
      throw error;
    }
  }
}