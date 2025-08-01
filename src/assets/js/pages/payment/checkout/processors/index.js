// Payment processor factory/manager
import { StripeProcessor } from './stripe/index.js';
import { PayPalProcessor } from './paypal/index.js';
import { ChargebeeProcessor } from './chargebee/index.js';
import { state } from '../modules/state.js';

export class PaymentProcessorManager {
  constructor() {
    this.processors = {};
    this.apiKeys = null;
  }

  // Initialize processors with API keys
  initialize(apiKeys, webManager) {
    this.apiKeys = apiKeys;

    if (apiKeys?.stripe?.publishableKey) {
      this.processors.stripe = new StripeProcessor(apiKeys.stripe.publishableKey, webManager);
    }

    if (apiKeys?.chargebee?.siteKey) {
      this.processors.chargebee = new ChargebeeProcessor(apiKeys.chargebee.siteKey, webManager);
    }

    if (apiKeys?.paypal?.clientId) {
      this.processors.paypal = new PayPalProcessor(
        apiKeys.paypal.clientId,
        webManager
      );
    }

    // Crypto/Coinbase - assume available if crypto payment is configured
    // Since Coinbase doesn't use public keys, we check for a flag or assume it's enabled
    if (apiKeys?.crypto?.enabled === true) {
      // Enable crypto by default or if explicitly enabled
      this.processors.crypto = {
        // Placeholder processor for crypto
        processPayment: async () => {
          // This will be handled differently - likely redirect to Coinbase Commerce
          throw new Error('Crypto payment processing not yet implemented');
        }
      };
    }
  }

  // Get processor by payment method
  getProcessor(paymentMethod) {
    let processorName;

    // Determine processor based on payment method and available API keys
    if (paymentMethod === 'card') {
      // Check for _test_cardProcessor override in URL params (for testing)
      const urlParams = new URLSearchParams(window.location.search);
      const forcedProcessor = urlParams.get('_test_cardProcessor');

      if (forcedProcessor && this.processors[forcedProcessor]) {
        processorName = forcedProcessor;
      } else {
        // If Chargebee is available, use it for card payments
        if (this.apiKeys?.chargebee?.siteKey && this.processors.chargebee) {
          processorName = 'chargebee';
        } else {
          processorName = 'stripe';
        }
      }
    } else {
      // Map other payment methods to processors
      const processorMap = {
        'paypal': 'paypal',
        'crypto': 'crypto' // To be implemented
      };
      processorName = processorMap[paymentMethod];
    }

    const processor = this.processors[processorName];

    if (!processor) {
      throw new Error(`Payment processor "${processorName}" not available or not configured`);
    }

    return processor;
  }

  // Process payment with selected method
  async processPayment(paymentMethod) {
    try {
      const processor = this.getProcessor(paymentMethod);
      const processorName = this.getProcessorName(paymentMethod);

      console.log('🔄 Processing payment:', {
        paymentMethod,
        processor: processorName,
        apiKeys: this.apiKeys ? Object.keys(this.apiKeys) : [],
        availableProcessors: Object.keys(this.processors)
      });

      return await processor.processPayment();
    } catch (error) {
      console.error(`Payment processing error (${paymentMethod}):`, error);
      throw error;
    }
  }

  // Helper to get processor name for logging
  getProcessorName(paymentMethod) {
    if (paymentMethod === 'card') {
      const urlParams = new URLSearchParams(window.location.search);
      const forcedProcessor = urlParams.get('_test_cardProcessor');

      if (forcedProcessor && this.processors[forcedProcessor]) {
        return forcedProcessor;
      }

      return this.apiKeys?.chargebee?.siteKey && this.processors.chargebee ? 'chargebee' : 'stripe';
    }

    const processorMap = {
      'paypal': 'paypal',
      'crypto': 'crypto'
    };

    return processorMap[paymentMethod] || 'unknown';
  }

  // Check if a payment method is available
  isPaymentMethodAvailable(paymentMethod) {
    try {
      this.getProcessor(paymentMethod);
      return true;
    } catch {
      return false;
    }
  }

  // Get list of available payment methods
  getAvailablePaymentMethods() {
    const methods = [];

    // Card payment - check which processor will be used
    if (this.processors.chargebee || this.processors.stripe) {
      // Check for _test_cardProcessor override
      const urlParams = new URLSearchParams(window.location.search);
      const forcedProcessor = urlParams.get('_test_cardProcessor');

      let cardProcessor;
      if (forcedProcessor && this.processors[forcedProcessor]) {
        cardProcessor = forcedProcessor;
      } else {
        cardProcessor = this.apiKeys?.chargebee?.siteKey && this.processors.chargebee
          ? 'chargebee'
          : 'stripe';
      }

      methods.push({ id: 'card', name: 'Credit Card', processor: cardProcessor });
    }

    if (this.processors.paypal) {
      methods.push({ id: 'paypal', name: 'PayPal', processor: 'paypal' });
    }

    // Crypto can be added later
    if (this.processors.crypto) {
      methods.push({ id: 'crypto', name: 'Crypto', processor: 'crypto' });
    }

    return methods;
  }
}

// Create singleton instance
export const paymentManager = new PaymentProcessorManager();
