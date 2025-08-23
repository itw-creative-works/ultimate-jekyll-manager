// Unified payment request handler
import { state } from './state.js';
import { getRecaptchaToken } from './recaptcha.js';
import { getApiBaseUrl } from './constants.js';
import fetch from 'wonderful-fetch';

// Make payment intent request to server
export async function createPaymentIntent(webManager) {
  try {
    // Get reCAPTCHA token
    const recaptchaToken = await getRecaptchaToken('payment_intent');

    // Get payment intent data from state
    const paymentIntentData = state.paymentIntentData || {};

    // Update verification with reCAPTCHA token
    paymentIntentData.verification = {
      ...paymentIntentData.verification,
      'g-recaptcha-response': recaptchaToken
    };

    // Get API endpointok
    const apiBaseUrl = getApiBaseUrl(webManager, 'development');
    const paymentEndpoint = `${apiBaseUrl}/payment/intent`;

    console.log('🚀 Sending payment intent request:', {
      url: paymentEndpoint,
      processor: paymentIntentData.processor,
      data: paymentIntentData
    });

    // Make the request
    const response = await fetch(paymentEndpoint, {
      method: 'POST',
      response: 'json',
      body: paymentIntentData,
    });

    console.log('✅ Payment intent created:', response);

    // Validate response
    if (!response.redirectUrl) {
      throw new Error('No checkout URL returned from server');
    }

    return response;
  } catch (e) {
    console.error('Payment intent request error:', e);
    throw e;
  }
}
