// Shared constants for checkout

// API endpoints - dynamic based on environment
export function getApiBaseUrl(webManager) {
  // Check if we're in development mode
  if (webManager && webManager.isDevelopment()) {
    // Local Firebase emulator - update project ID as needed
    return 'http://localhost:5001/your-project-id/us-central1/api';
  }
  return 'https://api.itwcreativeworks.com';
}

// Generate payment intent endpoint
export function getPaymentIntentEndpoint(webManager) {
  return `${getApiBaseUrl(webManager)}/payment/intent`;
}

// Payment processor names (ensure consistency)
export const PROCESSORS = {
  STRIPE: 'stripe',
  PAYPAL: 'paypal',
  CHARGEBEE: 'chargebee',
  CRYPTO: 'crypto'
};