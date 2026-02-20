// API calls for checkout
import fetch from 'wonderful-fetch';
import authorizedFetch from '__main_assets__/js/libs/authorized-fetch.js';
import { getRecaptchaToken } from './recaptcha.js';

// Fetch app config (products + processors)
export async function fetchAppConfig(webManager) {
  const response = await fetch(`${webManager.getApiUrl()}/backend-manager/app`, {
    response: 'json',
  });

  console.log('Fetched app config:', response);
  return response;
}

// Fetch trial eligibility
export async function fetchTrialEligibility(productId, webManager) {
  try {
    const response = await authorizedFetch(`${webManager.getApiUrl()}/backend-manager/payments/trial-eligibility`, {
      method: 'GET',
      response: 'json',
      query: { product: productId },
    });

    return response.eligible || false;
  } catch (e) {
    console.warn('Trial eligibility check failed, assuming eligible:', e);
    return true;
  }
}

// Fire-and-forget server warmup
export function warmupServer(webManager) {
  fetch(`${webManager.getApiUrl()}/backend-manager/payments/intent`, {
    method: 'GET',
    query: { wakeup: 'true' },
  }).catch(() => {});
}

// Create payment intent and return { url }
export async function createPaymentIntent({ webManager, state, processor, formData }) {
  // Get reCAPTCHA token
  const recaptchaToken = await getRecaptchaToken('payment_intent');

  // User info
  const user = webManager.auth().getUser();

  // Discount code from form data
  const discountCode = state.discountPercent > 0
    ? (formData.discount || '').trim().toUpperCase()
    : undefined;

  // Build payload (flat fields to match backend schema)
  const payload = {
    processor,
    productId: state.product.id,
    frequency: state.frequency,
    trial: state.trialEligible,
    auth: {
      uid: user?.uid || '',
      email: user?.email || '',
    },
    attribution: webManager.storage().get('attribution', {}),
    cancelUrl: window.location.href,
    verification: {
      status: 'pending',
      'g-recaptcha-response': recaptchaToken || '',
    },
  };

  // Optional fields
  if (discountCode) {
    payload.discount = discountCode;
  }

  if (formData) {
    // Clean form data -- remove fields we handle explicitly
    const supplemental = { ...formData };
    delete supplemental.frequency;
    delete supplemental.discount;
    payload.supplemental = supplemental;
  }

  console.log('Sending payment intent:', { processor, productId: state.product.id, payload });

  // POST to backend (authorized — attaches Firebase ID token)
  const response = await authorizedFetch(`${webManager.getApiUrl()}/backend-manager/payments/intent`, {
    method: 'POST',
    response: 'json',
    body: payload,
  });

  if (!response.url) {
    throw new Error('No checkout URL returned from server');
  }

  console.log('Payment intent created:', response);
  return response;
}
