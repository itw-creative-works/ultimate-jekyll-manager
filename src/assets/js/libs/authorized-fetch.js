// Authorized Fetch - Wrapper for wonderful-fetch with Firebase Authentication
import fetch from 'wonderful-fetch';

/**
 * Makes an authorized API request with Firebase token
 * @param {string} url - The API endpoint URL
 * @param {Object} options - Request options for wonderful-fetch
 * @returns {Promise} - The response from the API
 */
export async function authorizedFetch(url, options = {}) {
  // Get webManager reference from global window.Manager
  const webManager = window.Manager?.webManager;

  // Deep clone options to avoid mutating the original
  const requestOptions = JSON.parse(JSON.stringify(options));

  // Get Firebase auth instance and current user
  const { getAuth } = await import('@firebase/auth');
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    console.warn('Did we fully wait for auth state to be determined?');
    throw new Error('No authenticated user found');
  }

  // Get the ID token - let it throw if it fails
  const idToken = await user.getIdToken();

  // Ensure headers object exists
  if (!requestOptions.headers) {
    requestOptions.headers = {};
  }

  // Set the Authorization header with Bearer token
  requestOptions.headers['Authorization'] = 'Bearer ' + idToken;

  // Make the request using wonderful-fetch
  return fetch(url, requestOptions);
}

// Export default
export default authorizedFetch;
