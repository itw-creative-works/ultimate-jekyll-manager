// Payment processor factory/manager
import { StripeProcessor } from './processors/stripe.js';
import { PayPalProcessor } from './processors/paypal.js';
import { ChargebeeProcessor } from './processors/chargebee.js';
import { CoinbaseProcessor } from './processors/coinbase.js';
import { state } from './state.js';

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

    if (apiKeys?.coinbase?.enabled === true) {
      this.processors.coinbase = new CoinbaseProcessor(webManager);
    }
  }

  // Get processor by payment method - returns { processor, name }
  getProcessor(paymentMethod) {
    let processorName;

    // Determine processor based on payment method and available API keys
    if (paymentMethod === 'card') {
      // Check for _dev_cardProcessor override in URL params (for testing)
      const urlParams = new URLSearchParams(window.location.search);
      const forcedProcessor = urlParams.get('_dev_cardProcessor');

      if (forcedProcessor && this.processors[forcedProcessor]) {
        processorName = forcedProcessor;
      } else {
        // Prefer Stripe if available, otherwise fall back to Chargebee
        if (this.apiKeys?.stripe?.publishableKey && this.processors.stripe) {
          processorName = 'stripe';
        } else if (this.apiKeys?.chargebee?.siteKey && this.processors.chargebee) {
          processorName = 'chargebee';
        } else {
          processorName = 'stripe'; // Default fallback
        }
      }
    } else {
      // Map other payment methods to processors
      const processorMap = {
        'paypal': 'paypal',
        'crypto': 'coinbase' // Crypto payments processed by Coinbase Commerce
      };
      processorName = processorMap[paymentMethod];
    }

    const processor = this.processors[processorName];

    if (!processor) {
      throw new Error(`Payment processor "${processorName}" not available or not configured`);
    }

    return { processor, name: processorName };
  }

  // Process payment with selected method
  async processPayment(paymentMethod) {
    try {
      const { processor, name: processorName } = this.getProcessor(paymentMethod);

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

  // Check if a payment method is available
  isPaymentMethodAvailable(paymentMethod) {
    try {
      const { processor } = this.getProcessor(paymentMethod);
      return !!processor;
    } catch {
      return false;
    }
  }

  // Get list of available payment methods
  getAvailablePaymentMethods() {
    const methods = [];

    // Card payment - check which processor will be used
    if (this.processors.chargebee || this.processors.stripe) {
      try {
        const { name: cardProcessor } = this.getProcessor('card');
        methods.push({ id: 'card', name: 'Credit Card', processor: cardProcessor });
      } catch {
        // Card processor not available
      }
    }

    if (this.processors.paypal) {
      methods.push({ id: 'paypal', name: 'PayPal', processor: 'paypal' });
    }

    // Coinbase Commerce for crypto payments
    if (this.processors.coinbase) {
      methods.push({ id: 'crypto', name: 'Crypto', processor: 'coinbase' });
    }

    return methods;
  }
}

// Create singleton instance
export const paymentManager = new PaymentProcessorManager();
