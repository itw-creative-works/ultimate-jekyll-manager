import authorizedFetch from '__main_assets__/js/libs/authorized-fetch.js';

// Constants
const SIGNUP_MAX_AGE = 5 * 60 * 1000;

// Auth Module
export default function (Manager, options) {
  // Shortcuts
  const { webManager } = Manager;

  // Get auth policy
  const config = webManager.config.auth.config;
  const policy = config.policy;

  // Skip auth module entirely if policy is disabled (e.g., vert iframes)
  if (policy === 'disabled') {
    return;
  }

  const authenticated = config.redirects.authenticated;
  const unauthenticated = config.redirects.unauthenticated;

  // Log policy
  console.log('[Auth] policy:', policy, {
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
      console.log('[Auth] state changed:', state);

      // Set user ID for analytics tracking
      setAnalyticsUserId(user, webManager);

      // Check if we're in the process of signing out
      if (authSignout === 'true' && user) {
        // Mark that we're about to sign out
        justSignedOut = true;
        return; // Let pages.js handle the signout
      }

      // Handle authentication state changes and page policies
      if (user) {
        // User is authenticated

        // Send user signup metadata if account is new
        await sendUserSignupMetadata(user, webManager);

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

        // Append authReturnUrl to all signup/signin links so users return here after auth
        updateAuthLinks();
      }
    });
  } catch (e) {
    console.warn('[Auth] Error setting up auth listener:', e);

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
  console.log('[Auth] Redirecting to:', newURL.href);

  // Quit on testing
  // return;

  // Redirect to the new URL
  window.location.href = newURL;
}

// Add authReturnUrl to all signup/signin links so users return to the current page after auth
// Uses click handler so the return URL always reflects the *current* location (e.g. after chat ID is added)
function updateAuthLinks() {
  const authPaths = ['/signin', '/signup'];

  document.querySelectorAll('a[href]').forEach(($link) => {
    try {
      const href = new URL($link.href, window.location.origin);

      if (!authPaths.includes(href.pathname)) { return; }

      $link.addEventListener('click', (e) => {
        const url = new URL($link.href, window.location.origin);
        url.searchParams.set('authReturnUrl', window.location.href);
        $link.href = url.toString();
      });
    } catch (e) {}
  });
}

function setAnalyticsUserId(user, webManager) {
  const userId = user?.uid;
  const email = user?.email;
  const metaPixelId = webManager.config.tracking['meta-pixel'];

  // Short-circuit if no user
  if (!userId) {
    // Clear user ID when logged out
    gtag('set', { user_id: null });

    // Facebook Pixel - Clear advanced matching
    fbq('init', metaPixelId, {});

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
  fbq('init', metaPixelId, {
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
    // Skip on auth pages to avoid blocking redirect (metadata will be sent on destination page)
    const pagePath = document.documentElement.getAttribute('data-page-path');
    const authPages = ['/signin', '/signup', '/reset'];
    if (authPages.includes(pagePath)) {
      return;
    }

    // Check if this is a new user account (created in last X minutes)
    const accountAge = Date.now() - new Date(user.metadata.creationTime).getTime();
    const signupProcessed = webManager.storage().get('flags.signupProcessed', null) === user.uid;

    /* @dev-only:start */
    {
      // Log account age for debugging
      const ageInMinutes = Math.floor(accountAge / 1000 / 60);
      console.log('[Auth] Account age:', ageInMinutes, 'minutes, signupProcessed:', signupProcessed);
    }
    /* @dev-only:end */

    // Only proceed if account is new and we haven't sent signup metadata yet
    if (accountAge >= SIGNUP_MAX_AGE || signupProcessed) {
      return;
    }

    // Get attribution data from storage
    const attribution = webManager.storage().get('attribution', {});

    // Build the payload
    const payload = {
      // New structure
      attribution: attribution,
      context: webManager.utilities().getContext(),
    };

    // Get server API URL
    const serverApiURL = `${webManager.getApiUrl()}/backend-manager/user/signup`;

    // Log
    console.log('[Auth] Sending user metadata:', payload);

    // Make API call to send signup metadata
    const response = await authorizedFetch(serverApiURL, {
      method: 'POST',
      response: 'json',
      tries: 3,
      body: payload,
    });

    // Log
    console.log('[Auth] User metadata sent successfully:', response);

    // Mark signup as sent for this user (keep the attribution data for reference)
    webManager.storage().set('flags.signupProcessed', user.uid);
  } catch (error) {
    console.error('[Auth] Error sending user metadata:', error);
    // Don't throw - we don't want to block the signup flow
  }
}
