// Module
module.exports = (Manager, options) => {
  // Shortcuts
  const { webManager } = Manager;

  // Get auth policy
  const config = webManager.config.auth.config;
  const policy = config.policy;
  const authenticated = config.redirects.authenticated;
  const unauthenticated = config.redirects.unauthenticated;

  // Log policy
  console.log('Auth policy:', policy, {
    authenticated,
    unauthenticated
  });

  // Setup Auth listener
  try {
    webManager.auth().listen({}, (state) => {
      const user = state.user;
      const url = new URL(window.location.href);
      const authReturnUrl = url.searchParams.get('authReturnUrl');
      const authSignout = url.searchParams.get('authSignout');

      // Log
      console.log('Auth state changed:', state);

      // If user is logged in and authReturnUrl is set, redirect to that URL
      // But skip if authSignout is present (user is being signed out)
      if (user && authReturnUrl && authSignout !== 'true') {
        console.log('Redirecting to authReturnUrl:', authReturnUrl);
        window.location.href = authReturnUrl;
      }

      // Update UI elements
      updateUIElements(state);

      // Quit if policy is not set
      if (!policy) {
        return;
      }

      // If policy is authenticated, check if user is authenticated
      if (policy === 'authenticated') {
        if (!user) {
          // User is not authenticated, redirect to login
          redirect(unauthenticated);
        }
      } else if (policy === 'unauthenticated') {
        if (user) {
          // User is authenticated, redirect to home
          redirect(authenticated);
        }
      }
    });
  } catch (e) {
    console.warn('Error setting up auth listener:', e);

    return;
  }
}

// Redirect function
function redirect(url) {
  if (!url) {
    return;
  }

  // Set the authReturnUrl to the current URL
  const newURL = new URL(url, window.location.origin);
  newURL.searchParams.set('authReturnUrl', window.location.href);
  window.location.href = newURL;
}

function updateUIElements(state) {
    const user = state.user;

    // Update email elements
    const emailElements = document.querySelectorAll('.uj-auth-email');
    emailElements.forEach(element => {
        element.textContent = user?.email || '';
    });

}
