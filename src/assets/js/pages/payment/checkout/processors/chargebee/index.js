// Chargebee payment processor implementation
import { state, getPaymentIds } from '../../modules/state.js';
import { getRecaptchaToken } from '../../modules/recaptcha.js';
import { getPaymentIntentEndpoint, PROCESSORS } from '../../modules/constants.js';

export class ChargebeeProcessor {
  constructor(siteKey, webManager) {
    this.siteKey = siteKey;
    this.webManager = webManager;
  }

  // Create hosted page session for Chargebee
  async createHostedPageSession() {
    const paymentIds = getPaymentIds();
    const email = this.webManager.auth().getUser().email;

    console.log('🟢 Chargebee: Creating hosted page session', {
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
    confirmationUrl.searchParams.set('chargebee_session_id', '{CHARGEBEE_SESSION_ID}');
    confirmationUrl.searchParams.set('product_id', state.product.id);

    // Prepare hosted page data
    const hostedPageData = {
      plan_id: paymentIds.chargebeePlanId,
      customer: {
        email: email
      },
      success_url: confirmationUrl.toString(),
      cancel_url: cancelUrl.toString(),
      pass_thru_content: JSON.stringify({
        product_id: state.product.id,
        billing_cycle: state.billingCycle,
        discount_percent: state.discountPercent
      })
    };

    // Get reCAPTCHA token
    const recaptchaToken = await getRecaptchaToken('chargebee_checkout');

    // Prepare unified request data
    const requestData = {
      processor: PROCESSORS.CHARGEBEE,
      recaptcha_token: recaptchaToken,
      processor_data: hostedPageData,
      api_key: this.siteKey,
      form_data: state.formData || {} // Include form data
    };

    const paymentEndpoint = getPaymentIntentEndpoint(this.webManager);

    console.log('🟢 Chargebee: Sending API request', {
      url: `${paymentEndpoint}?processor=${PROCESSORS.CHARGEBEE}`,
      requestData,
      hasRecaptcha: !!recaptchaToken
    });

    try {
      // Call backend API to create hosted page
      const response = await fetch(`${paymentEndpoint}?processor=${PROCESSORS.CHARGEBEE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create Chargebee hosted page');
      }

      const data = await response.json();
      return data.url; // Return the hosted page URL

    } catch (error) {
      console.error('Chargebee hosted page error:', error);
      throw new Error(`Chargebee checkout failed: ${error.message}`);
    }
  }

  // Process payment (redirect to Chargebee)
  async processPayment() {
    try {
      const hostedPageUrl = await this.createHostedPageSession();

      // Redirect to Chargebee hosted page
      window.location.href = hostedPageUrl;

      // Return a promise that never resolves (we're redirecting)
      return new Promise(() => {});

    } catch (error) {
      throw error;
    }
  }
}
