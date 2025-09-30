import fetch from 'wonderful-fetch';

// Auth Module
export default function (Manager, options) {
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

  // Track if we just signed out to avoid redirect loops
  let justSignedOut = false;

  // Setup Auth listener
  try {
    webManager.auth().listen({}, async (state) => {
      const user = state.user;
      const url = new URL(window.location.href);
      const authReturnUrl = url.searchParams.get('authReturnUrl');
      const authSignout = url.searchParams.get('authSignout');

      // Log
      console.log('Auth state changed:', state);

      // Set user ID for analytics tracking
      setAnalyticsUserId(user);

      // Check if we're in the process of signing out
      if (authSignout === 'true' && user) {
        // Mark that we're about to sign out
        justSignedOut = true;
        return; // Let pages.js handle the signout
      }

      // Handle authentication state changes and page policies
      if (user) {
        // User is authenticated

        // Check if this is a new user account (created in last 5 minutes) and send metadata
        const accountAge = Date.now() - new Date(user.metadata.creationTime).getTime();
        const fiveMinutes = 5 * 60 * 1000;

        /* @dev-only:start */
        {
          // Log account age for debugging
          const ageInMinutes = Math.floor(accountAge / 1000 / 60);
          console.log('Account age:', ageInMinutes, 'minutes');
        }
        /* @dev-only:end */

        // Send user signup metadata if account is new
        if (accountAge < fiveMinutes) {
          await sendUserSignupMetadata(user, webManager);
        }

        // Check if page requires user to be unauthenticated (e.g., signin page)
        if (policy === 'unauthenticated') {
          // Check for authReturnUrl first (takes precedence)
          if (authReturnUrl) {
            redirect(authReturnUrl);
            return;
          }

          // Otherwise redirect to default authenticated destination
          redirect(authenticated);
        }
      } else {
        // User is not authenticated

        // If we just signed out and have authReturnUrl, stay on the page
        if (justSignedOut && authReturnUrl) {
          justSignedOut = false; // Reset flag
          return; // Stay on current page to allow re-authentication
        }

        // Check if page requires authentication (e.g., account page)
        if (policy === 'authenticated') {
          redirect(unauthenticated, window.location.href);
        }
      }
    });
  } catch (e) {
    console.warn('Error setting up auth listener:', e);

    return;
  }
}

// Redirect function
function redirect(url, returnUrl) {
  if (!url) {
    return;
  }

  // Set the authReturnUrl to the current URL
  const newURL = new URL(url, window.location.origin);

  // Attach return URL
  if (returnUrl) {
    newURL.searchParams.set('authReturnUrl', returnUrl);
  }

  // Log
  console.log('Redirecting to:', newURL.href);

  // Quit on testing
  // return;

  // Redirect to the new URL
  window.location.href = newURL;
}

function setAnalyticsUserId(user) {
  const userId = user?.uid;
  const email = user?.email;

  // Short-circuit if no user
  if (!userId) {
    // Clear user ID when logged out
    gtag('set', { user_id: null });

    // Facebook Pixel - Clear advanced matching
    fbq('init', fbq.pixelId, {});

    // TikTok Pixel - Clear user data
    ttq.identify({});

    // Return early
    return;
  }

  // Google Analytics 4 - Set user ID and user properties
  gtag('set', {
    user_id: userId,
    user_properties: {
      email_domain: email ? email.split('@')[1] : undefined
    }
  });

  // Facebook Pixel - Set advanced matching with user data
  fbq('init', fbq.pixelId, {
    external_id: userId,
    // em: email ? btoa(email.toLowerCase().trim()) : undefined,
    em: email,
    // ph: phone ? btoa(phone.trim()) : undefined
  });

  // TikTok Pixel - Identify user
  ttq.identify({
    external_id: userId,
    // email: email ? btoa(email.toLowerCase().trim()) : undefined,
    email: email,
    // phone_number: phone ? btoa(phone.trim()) : undefined
  });
}

// Send user metadata to server (affiliate, UTM params, etc.)
async function sendUserSignupMetadata(user, webManager) {
  try {
    // Get the auth token
    const token = await webManager.auth().getIdToken();

    // Get affiliate data from storage
    const affiliateData = webManager.storage().get('marketing.affiliate', null);
    const utmData = webManager.storage().get('marketing.utm', null);
    const signupSent = webManager.storage().get('marketing.signupSent', false);

    // Only proceed if we have some marketing data to send
    if (signupSent) {
      return;
    }

    // Build the payload
    const payload = {
      // @TODO: REMOVE ONCE LEGACY SERVER CODE IS GONE
      affiliateCode: affiliateData?.code || '',

      // New structure
      affiliateData: affiliateData || {},
      utmData: utmData || {},
    };

    // Get server API URL
    const serverApiURL = webManager.getApiUrl() + '/backend-manager';

    // Make API call to reset API key
    const response = await fetch(serverApiURL, {
      method: 'POST',
      body: {
        authenticationToken: token,
        command: 'user:sign-up',
        payload: payload
      }
    });

    // Log
    console.log('User metadata sent successfully:', response);

    // Mark signup as sent (keep the marketing data for reference)
    webManager.storage().set('marketing.signupSent', true);
  } catch (error) {
    console.error('Error sending user metadata:', error);
    // Don't throw - we don't want to block the signup flow
  }
}
