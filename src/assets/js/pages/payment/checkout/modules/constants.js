// Shared constants for checkout

// API endpoints - dynamic based on environment
export function getApiBaseUrl(webManager, type = '') {
  // Check if we're in development mode
  if (webManager && webManager.isDevelopment() && type === 'development') {
    // Local Firebase emulator - update project ID as needed
    return 'http://localhost:5002';
  }
  return 'https://api.itwcreativeworks.com';
}
