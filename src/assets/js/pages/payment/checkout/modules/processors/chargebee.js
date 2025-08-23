// Chargebee payment processor
import { createPaymentIntent } from '../payment-request.js';

export class ChargebeeProcessor {
  constructor(siteKey, webManager) {
    this.siteKey = siteKey;
    this.webManager = webManager;
  }

  // Process the payment
  async processPayment() {
    try {
      console.log('🟢 Chargebee: Processing payment');
      
      // Use unified payment intent handler
      const result = await createPaymentIntent(this.webManager);
      
      // Redirect to Chargebee hosted page
      console.log('🟢 Chargebee: Redirecting to hosted page:', result.redirectUrl);
      window.location.href = result.redirectUrl;
      
      // Return a promise that never resolves (we're redirecting)
      return new Promise(() => {});
      
    } catch (error) {
      // Just pass through the error without adding prefixes
      throw error;
    }
  }
}