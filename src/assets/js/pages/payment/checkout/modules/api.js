// API calls for checkout
import { config, state } from './state.js';
import { getApiBaseUrl } from './constants.js';
import fetch from 'wonderful-fetch';

// Fetch product details
export async function fetchProductDetails(appId, productId, webManager) {
  try {
    // Get API base URL (uses dev server in development)
    const apiBaseUrl = getApiBaseUrl(webManager, 'production');

    // Fetch from actual API endpoint
    const response = await fetch(`${apiBaseUrl}/get-app`, {
      response: 'json',
      query: {
        id: appId,
      }
    });

    // Log
    console.log('Fetched site configuration:', response);

    // Store site config and API keys
    config.siteConfig = response;
    state.apiKeys = response.apiKeys;

    // Extract product from the products object
    const product = response.products[productId];
    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    // Transform to expected format for backward compatibility
    return {
      id: productId,
      name: product.name,
      description: product.description || '',
      price_monthly: product.pricing.monthly.price,
      price_annually: product.pricing.annually.price,
      is_subscription: product.type === 'subscription',
      has_free_trial: product.trial > 0,
      free_trial_days: product.trial,
      // Store the full product data for later use
      _raw: product
    };
  } catch (e) {
    console.error('Error fetching product details:', e);
    throw e;
  }
}

// Fetch trial eligibility from server
export async function fetchTrialEligibility(appId, productId, webManager) {
  try {
    // Get API base URL (uses dev server in development)
    const apiBaseUrl = getApiBaseUrl(webManager, 'development');

    // API call to check trial eligibility
    const response = await fetch(`${apiBaseUrl}/payment/trial-eligibility`, {
      method: 'GET',
      response: 'json',
      query: {
        app: appId,
        product: productId
      }
    });

    return response.eligible || false;
  } catch (e) {
    console.warn('Trial eligibility check failed, assuming not eligible:', e);
    return false; // Default to not eligible if API fails
  }
}

// Warmup server by making a lightweight request to payment intent API
export async function warmupServer(webManager) {
  try {
    // Get payment intent endpoint
    const apiBaseUrl = getApiBaseUrl(webManager, 'development');

    // Fire and forget - no await needed
    fetch(`${apiBaseUrl}/payment/intent`, {
      method: 'GET',
      query: {
        wakeup: 'true'
      }
    }).catch(e => {
      console.debug('Server warmup failed (non-critical):', e);
    });

    console.debug('Server warmup initiated');
  } catch (e) {
    // Fail silently - this is non-critical
    console.debug('Server warmup error (non-critical):', e);
  }
}
