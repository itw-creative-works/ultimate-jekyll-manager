// API calls for checkout
import { config, state } from './state.js';

// Fetch product details
export async function fetchProductDetails(_test_appId, productId, webManager) {
  try {
    // Fetch from actual API endpoint
    const response = await fetch(`https://api.itwcreativeworks.com/get-app?id=${_test_appId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch site configuration');
    }

    const data = await response.json();

    // Log
    console.log('Fetched site configuration:', data);

    // Store site config and API keys
    config.siteConfig = data;
    state.apiKeys = data.apiKeys;

    // Extract product from the products object
    const product = data.products[productId];
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
  } catch (error) {
    console.error('Error fetching product details:', error);
    throw error;
  }
}

// Fetch trial eligibility from server
export async function fetchTrialEligibility(productId) {
  try {
    // Simulate API call to check trial eligibility
    // Replace with actual API endpoint
    const response = await fetch(`/api/trial-eligibility?product=${productId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error('Trial eligibility check failed');
    }

    const data = await response.json();
    return data.eligible || false;
  } catch (error) {
    console.warn('Trial eligibility check failed, assuming not eligible:', error);
    return false; // Default to not eligible if API fails
  }
}
