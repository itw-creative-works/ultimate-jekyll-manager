// Stripe payment processor
import { state, getPaymentIds } from '../../modules/state.js';
import { getRecaptchaToken } from '../../modules/recaptcha.js';
import { getPaymentIntentEndpoint, PROCESSORS } from '../../modules/constants.js';

export class StripeProcessor {
  constructor(apiKey, webManager) {
    this.apiKey = apiKey;
    this.webManager = webManager;
  }

  // Create checkout session for Stripe
  async createCheckoutSession() {
    const paymentIds = getPaymentIds();
    const email = this.webManager.auth().getUser().email;

    console.log('🔵 Stripe: Creating checkout session', {
      paymentIds,
      email,
      product: state.product?.id,
      total: state.total,
      billingCycle: state.billingCycle,
      isSubscription: state.isSubscription
    });

    // Build return URLs
    const confirmationUrl = new URL('/payment/confirmation', window.location.origin);
    const cancelUrl = new URL(window.location.href);

    // Add important parameters to confirmation URL
    confirmationUrl.searchParams.set('session_id', '{CHECKOUT_SESSION_ID}');
    confirmationUrl.searchParams.set('product_id', state.product.id);

    // Prepare line items based on product type
    const lineItems = [];

    if (state.isSubscription) {
      // Subscription product
      lineItems.push({
        price: paymentIds.stripePriceId,
        quantity: 1
      });
    } else {
      // One-time product
      lineItems.push({
        price_data: {
          currency: 'usd',
          product: paymentIds.stripeProductId,
          unit_amount: Math.round(state.total * 100) // Convert to cents
        },
        quantity: 1
      });
    }

    // Build checkout session data
    const sessionData = {
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: state.isSubscription ? 'subscription' : 'payment',
      success_url: confirmationUrl.toString(),
      cancel_url: cancelUrl.toString(),
      customer_email: email,
      client_reference_id: `${state.product.id}_${Date.now()}`,
      metadata: {
        product_id: state.product.id,
        product_name: state.product.name,
        billing_cycle: state.billingCycle,
        discount_percent: state.discountPercent.toString(),
        has_trial: state.hasFreeTrial.toString()
      }
    };

    // Add discount/coupon if applicable
    if (state.discountPercent > 0 && state.product._raw?.stripeCouponId) {
      sessionData.discounts = [{
        coupon: state.product._raw.stripeCouponId
      }];
    }

    // Add subscription trial if applicable
    if (state.isSubscription && state.hasFreeTrial) {
      sessionData.subscription_data = {
        trial_period_days: state.product.free_trial_days,
        metadata: {
          trial_days: state.product.free_trial_days.toString()
        }
      };
    }

    // Allow promotion codes
    sessionData.allow_promotion_codes = true;

    // Get reCAPTCHA token
    const recaptchaToken = await getRecaptchaToken('stripe_checkout');

    // Prepare unified request data
    const requestData = {
      processor: PROCESSORS.STRIPE,
      recaptcha_token: recaptchaToken,
      processor_data: sessionData,
      api_key: this.apiKey,
      form_data: state.formData || {} // Include form data
    };

    const paymentEndpoint = getPaymentIntentEndpoint(this.webManager);

    console.log('🔵 Stripe: Sending API request', {
      url: `${paymentEndpoint}?processor=${PROCESSORS.STRIPE}`,
      requestData,
      hasRecaptcha: !!recaptchaToken
    });

    try {
      // Call backend API to create session
      const response = await fetch(`${paymentEndpoint}?processor=${PROCESSORS.STRIPE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create checkout session');
      }

      const data = await response.json();
      return data.url; // Return the checkout URL

    } catch (error) {
      console.error('Stripe checkout session error:', error);
      throw new Error(`Stripe checkout failed: ${error.message}`);
    }
  }

  // Process the payment (redirect to Stripe)
  async processPayment() {
    try {
      const checkoutUrl = await this.createCheckoutSession();

      // Redirect to Stripe Checkout
      window.location.href = checkoutUrl;

      // Return a promise that never resolves (we're redirecting)
      return new Promise(() => {});

    } catch (error) {
      throw error;
    }
  }
}
