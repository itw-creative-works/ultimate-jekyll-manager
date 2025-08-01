// PayPal payment processor
import { state, getPaymentIds } from '../../modules/state.js';
import { getRecaptchaToken } from '../../modules/recaptcha.js';
import { getPaymentIntentEndpoint, PROCESSORS } from '../../modules/constants.js';

export class PayPalProcessor {
  constructor(clientId, webManager) {
    this.clientId = clientId;
    this.webManager = webManager;
  }

  // Create order for PayPal
  async createOrder() {
    const paymentIds = getPaymentIds();
    const email = this.webManager.auth().getUser().email;

    console.log('🟡 PayPal: Creating order', {
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
    confirmationUrl.searchParams.set('order_id', '{ORDER_ID}');
    confirmationUrl.searchParams.set('product_id', state.product.id);

    // Prepare order data based on product type
    let orderData;

    if (state.isSubscription) {
      // Create subscription
      orderData = {
        type: 'subscription',
        plan_id: paymentIds.paypalPlanId,
        subscriber: {
          email_address: email
        },
        application_context: {
          brand_name: window.webManager?.config?.brand?.name || 'Our Store',
          return_url: confirmationUrl.toString(),
          cancel_url: cancelUrl.toString(),
          user_action: 'SUBSCRIBE_NOW'
        },
        custom_id: `${state.product.id}_${Date.now()}`,
        // Add start time for trial
        ...(state.hasFreeTrial && {
          start_time: new Date(Date.now() + (state.product.free_trial_days * 24 * 60 * 60 * 1000)).toISOString()
        })
      };
    } else {
      // Create one-time purchase order
      const amount = state.total.toFixed(2);

      orderData = {
        type: 'order',
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: state.product.id,
          description: state.product.name,
          custom_id: `${state.product.id}_${Date.now()}`,
          amount: {
            currency_code: 'USD',
            value: amount,
            breakdown: {
              item_total: {
                currency_code: 'USD',
                value: state.subtotal.toFixed(2)
              },
              ...(state.discountPercent > 0 && {
                discount: {
                  currency_code: 'USD',
                  value: ((state.subtotal * state.discountPercent) / 100).toFixed(2)
                }
              })
            }
          },
          items: [{
            name: state.product.name,
            description: state.product.description,
            unit_amount: {
              currency_code: 'USD',
              value: state.subtotal.toFixed(2)
            },
            quantity: '1',
            category: 'DIGITAL_GOODS'
          }]
        }],
        application_context: {
          brand_name: window.webManager?.config?.brand?.name || 'Our Store',
          return_url: confirmationUrl.toString(),
          cancel_url: cancelUrl.toString(),
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW'
        },
        payer: {
          email_address: email
        }
      };
    }

    // Get reCAPTCHA token
    const recaptchaToken = await getRecaptchaToken('paypal_checkout');

    // Prepare unified request data
    const requestData = {
      processor: PROCESSORS.PAYPAL,
      recaptcha_token: recaptchaToken,
      processor_data: orderData,
      api_key: this.clientId,
      is_subscription: state.isSubscription,
      form_data: state.formData || {} // Include form data
    };

    const paymentEndpoint = getPaymentIntentEndpoint(this.webManager);

    console.log('🟡 PayPal: Sending API request', {
      url: `${paymentEndpoint}?processor=${PROCESSORS.PAYPAL}`,
      requestData,
      hasRecaptcha: !!recaptchaToken
    });

    try {
      // Call backend API to create order/subscription
      const response = await fetch(`${paymentEndpoint}?processor=${PROCESSORS.PAYPAL}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create PayPal order');
      }

      const data = await response.json();

      // Extract approval URL
      const approvalLink = data.links?.find(link => link.rel === 'approve' || link.rel === 'approval_url');
      if (!approvalLink) {
        throw new Error('No approval URL returned from PayPal');
      }

      return approvalLink.href;

    } catch (error) {
      console.error('PayPal order creation error:', error);
      throw new Error(`PayPal checkout failed: ${error.message}`);
    }
  }

  // Process the payment (redirect to PayPal)
  async processPayment() {
    try {
      const approvalUrl = await this.createOrder();

      // Redirect to PayPal
      window.location.href = approvalUrl;

      // Return a promise that never resolves (we're redirecting)
      return new Promise(() => {});

    } catch (error) {
      throw error;
    }
  }
}
