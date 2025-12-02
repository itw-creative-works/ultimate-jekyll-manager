// This file is required by /signin, /signup, and /reset pages since the logic is mostly the same
import { FormManager } from '__main_assets__/js/libs/form-manager.js';

// Module
export default function (Manager) {
  // Shortcuts
  const { webManager } = Manager;

  // Form manager instance
  let formManager = null;

  // Check query string for popup parameter
  const url = new URL(window.location.href);
  const useAuthPopup = url.searchParams.get('authPopup') === 'true' || window !== window.top;

  // Handle DOM ready
  webManager.dom().ready()
  .then(async () => {
    // Check for authSignout parameter first
    await handleAuthSignout(webManager);

    // Initialize the appropriate form based on the page (needs to be done early for error handling)
    initializePageForm();

    // Check for redirect result from OAuth providers
    await handleRedirectResult();

    // Check subdomain auth restrictions and redirect if needed
    if (checkSubdomainAuth()) {
      return;
    }

    // Update auth return URL in all auth-related links
    updateAuthReturnUrl();

    // Setup password visibility toggle
    setupPasswordToggle();
  });

  // Initialize the form based on current page
  function initializePageForm() {
    const pagePath = document.documentElement.getAttribute('data-page-path');

    if (!pagePath) {
      console.warn('No data-page-path attribute found on HTML element');
      return;
    }

    if (pagePath === '/signin') {
      initializeSigninForm();
    } else if (pagePath === '/signup') {
      initializeSignupForm();
    } else if (pagePath === '/reset') {
      initializeResetForm();
    }
  }

  // Shared validation for signin/signup forms - only validate when email provider is selected
  function validateEmailProvider({ data, setError, $submitButton }) {
    const provider = $submitButton?.getAttribute('data-provider');

    if (provider === 'email') {
      if (!data.email?.trim()) {
        setError('email', 'Email is required');
      }
      if (!data.password) {
        setError('password', 'Password is required');
      }
    }
  }

  // Shared submit handler factory for signin/signup forms
  function createAuthSubmitHandler(action, emailHandler) {
    return async ({ data, $submitButton }) => {
      const provider = $submitButton?.getAttribute('data-provider');

      if (provider === 'email') {
        await emailHandler(data);
      } else if (provider) {
        await signInWithProvider(provider, action);
      }
    };
  }

  // Initialize signin form
  function initializeSigninForm() {
    formManager = new FormManager('#signin-form', {
      allowResubmit: false,
      submittingText: 'Signing in...',
      submittedText: 'Signed In!',
    });

    formManager.on('validation', validateEmailProvider);
    formManager.on('submit', createAuthSubmitHandler('signin', handleEmailSignin));
  }

  // Initialize signup form
  function initializeSignupForm() {
    formManager = new FormManager('#signup-form', {
      allowResubmit: false,
      submittingText: 'Creating account...',
      submittedText: 'Account Created!',
    });

    formManager.on('validation', validateEmailProvider);
    formManager.on('submit', createAuthSubmitHandler('signup', handleEmailSignup));
  }

  // Initialize reset form
  function initializeResetForm() {
    formManager = new FormManager('#reset-form', {
      allowResubmit: false,
      submittingText: 'Sending...',
      submittedText: 'Email Sent!',
    });

    formManager.on('submit', ({ data }) => handlePasswordReset(data));
  }

  async function handleRedirectResult() {
    try {
      // Import Firebase auth functions
      const { getAuth, getRedirectResult } = await import('@firebase/auth');
      const auth = getAuth();

      // Check for redirect result
      const result = await getRedirectResult(auth);

      // Log results for debugging
      console.log('Redirect result:', result);

      // If no result, just return
      if (!result || !result.user) {
        return;
      }

      console.log('Successfully authenticated via redirect:', result.user.email);

      // Determine the provider from the result
      const providerId = result.providerId || result.user.providerData?.[0]?.providerId || 'unknown';

      // Track based on whether this is a new user
      const isNewUser = result.additionalUserInfo?.isNewUser;
      const pagePath = document.documentElement.getAttribute('data-page-path');
      const isSignupPage = pagePath === '/signup';

      if (isNewUser || isSignupPage) {
        trackSignup(providerId, result.user);
        formManager.showSuccess('Account created successfully!');
      } else {
        trackLogin(providerId, result.user);
        formManager.showSuccess('Successfully signed in!');
      }
    } catch (error) {
      // Only capture unexpected errors to Sentry
      if (!isUserError(error.code)) {
        webManager.sentry().captureException(new Error('Error handling redirect result', { cause: error }));
      }

      // Handle specific OAuth errors
      if (error.code === 'auth/account-exists-with-different-credential') {
        formManager.showError('An account already exists with the same email address but different sign-in credentials. Try signing in with a different provider.');
      } else if (error.code === 'auth/popup-blocked') {
        formManager.showError('Popup was blocked. Please allow popups for this site and try again.');
      } else if (error.code === 'auth/operation-not-allowed') {
        formManager.showError('This sign-in method is not enabled.');
      } else if (error.code && error.code !== 'auth/cancelled-popup-request') {
        formManager.showError(`Authentication error: ${error.message}`);
      }
    }
  }

  async function handleAuthSignout(webManager) {
    const url = new URL(window.location.href);
    const authSignout = url.searchParams.get('authSignout');

    if (authSignout !== 'true') {
      return;
    }

    try {
      console.log('Signing out user due to authSignout=true parameter');

      // Sign out the user using webManager
      await webManager.auth().signOut();

      // Remove the authSignout parameter from URL to prevent sign-out loop
      url.searchParams.delete('authSignout');
      window.history.replaceState({}, document.title, url.toString());
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

  function checkSubdomainAuth() {
    // Get the allowSubdomainAuth config value (defaults to true if not set)
    const allowSubdomainAuth = webManager.config.auth?.config?.allowSubdomainAuth ?? true;

    // Check if current hostname is a subdomain
    const hostname = window.location.hostname;
    const parts = hostname.split('.');

    // If hostname has 3 or more parts (e.g., subdomain.site.com), it's a subdomain
    // Skip localhost and IP addresses
    const isSubdomain = parts.length >= 3 && !hostname.includes('localhost') && !/^\d+\.\d+\.\d+\.\d+$/.test(hostname);

    // Log relevant info
    console.log('checkSubdomainAuth - hostname:', hostname, 'parts:', parts, 'isSubdomain:', isSubdomain, 'allowSubdomainAuth:', allowSubdomainAuth);

    // If subdomain auth is allowed, no need to redirect regardless of current domain
    if (allowSubdomainAuth) {
      return false;
    }

    // If not a subdomain, no need to redirect
    if (!isSubdomain) {
      return false;
    }

    // Redirect to apex domain
    const apexDomain = parts.slice(-2).join('.');
    const currentUrl = new URL(window.location.href);
    currentUrl.hostname = apexDomain;

    // Log
    console.log('Redirecting to apex domain for authentication:', currentUrl.href);

    // Perform the redirect
    window.location.href = currentUrl.href;

    // Stop further execution
    return true;
  }

  function updateAuthReturnUrl() {
    const url = new URL(window.location.href);
    const authReturnUrl = url.searchParams.get('authReturnUrl');

    // Quit if no authReturnUrl is provided
    if (!authReturnUrl) {
      console.warn('No authReturnUrl provided in URL parameters.');
      return;
    }

    // Update all relevant URLs
    document.querySelectorAll('a[href]').forEach((link) => {
      // Only update auth-related links
      if (!link.href.includes('/signin') && !link.href.includes('/signup') && !link.href.includes('/reset')) {
        return;
      }

      // Update href to include authReturnUrl
      const href = new URL(link.href, window.location.origin);
      href.searchParams.set('authReturnUrl', authReturnUrl);
      link.href = href.toString();
    });
  }

  async function attemptEmailSignIn(email, password) {
    const { getAuth, signInWithEmailAndPassword } = await import('@firebase/auth');
    const auth = getAuth();
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential;
  }

  async function handleEmailSignup(formData) {
    // Use the form data passed from the submit event (already validated)

    // Sanitize email by trimming
    const email = formData.email?.trim() || '';
    const password = formData.password || '';

    // Import Firebase auth functions
    const { getAuth, createUserWithEmailAndPassword } = await import('@firebase/auth');

    // Get auth instance and create user
    const auth = getAuth();

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // Track signup
      trackSignup('email', userCredential.user);

      // Show success message
      formManager.showSuccess('Account created successfully!');
    } catch (error) {
      // Handle Firebase-specific errors
      if (error.code === 'auth/email-already-in-use') {
        // Try to sign in with the same credentials
        try {
          console.log('Email already in use, attempting to sign in instead:', email);

          const userCredential = await attemptEmailSignIn(email, password);

          // Track this as a login instead of signup
          trackLogin('email', userCredential.user);

          // Show success message
          formManager.showSuccess('Successfully signed in!');
          return;
        } catch (signInError) {
          // Throw error for outer catch to handle
          throw new Error('An account with this email already exists');
        }
      }

      // Re-throw the error to be handled by the form handler
      throw error;
    }
  }

  async function handleEmailSignin(formData) {
    // Use the form data passed from the submit event (already validated)

    // Sanitize email by trimming
    const email = formData.email?.trim() || '';
    const password = formData.password || '';

    // Log
    console.log('Attempting email sign-in for:', email);

    // Sign in with email and password
    const userCredential = await attemptEmailSignIn(email, password);

    // Track login
    trackLogin('email', userCredential.user);

    // Show success message
    formManager.showSuccess('Successfully signed in!');
  }

  async function handlePasswordReset(formData) {
    // Use the form data passed from the submit event (already validated)

    // Sanitize email by trimming
    const email = formData.email?.trim() || '';

    // Import Firebase auth functions
    const { getAuth, sendPasswordResetEmail } = await import('@firebase/auth');

    // Get auth instance
    const auth = getAuth();

    try {
      // Send password reset email
      await sendPasswordResetEmail(auth, email);

      // Track password reset
      trackPasswordReset();

      // Show success message
      formManager.showSuccess(`Password reset email sent to ${email}. Please check your inbox.`);
    } catch (error) {
      // Handle Firebase-specific errors
      if (error.code === 'auth/user-not-found') {
        // For security, we don't reveal if the user exists
        // Still show success to prevent email enumeration
        trackPasswordReset(email); // Track as success for security
        formManager.showSuccess(`If an account exists for ${email}, a password reset email has been sent.`);
        return;
      }

      // Re-throw the error to be handled by the form handler
      throw error;
    }
  }


  async function signInWithProvider(providerName, action = 'signin') {
    try {
      // Import Firebase auth functions and providers
      const {
        getAuth,
        signInWithPopup,
        signInWithRedirect,
        GoogleAuthProvider,
        FacebookAuthProvider,
        TwitterAuthProvider,
        GithubAuthProvider
      } = await import('@firebase/auth');

      const auth = getAuth();

      let provider;

      // Create provider based on provider name
      switch (providerName) {
        case 'google.com':
          provider = new GoogleAuthProvider();
          break;
        case 'facebook.com':
          provider = new FacebookAuthProvider();
          break;
        case 'twitter.com':
          provider = new TwitterAuthProvider();
          break;
        case 'github.com':
          provider = new GithubAuthProvider();
          break;
        default:
          throw new Error(`Unsupported provider: ${providerName}`);
      }

      /* @dev-only:start */
      {
        // // Add device_id and device_name for private IP addresses (required by Firebase)
        // const deviceId = webManager.storage().get('devDeviceId') || crypto.randomUUID();
        // webManager.storage().set('devDeviceId', deviceId);

        // provider.setCustomParameters({
        //   device_id: deviceId,
        //   device_name: navigator.userAgent.substring(0, 100),
        // });

        // Show warning in dev mode when using redirect
        if (!useAuthPopup) {
          webManager.utilities().showNotification(
            'OAuth redirect may fail in development. Use localhost:4000 or add ?authPopup=true to the URL',
            {
              type: 'warning',
              timeout: 10000 // Show for 10 seconds
            }
          );

          // Wait
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      /* @dev-only:end */

      // Use popup if query parameter is set, otherwise use redirect
      if (useAuthPopup) {
        try {
          // Try popup
          const result = await signInWithPopup(auth, provider);
          console.log('Successfully authenticated via popup:', result.user.email);

          // Track based on whether this is a new user
          const isNewUser = result.additionalUserInfo?.isNewUser;
          if (isNewUser || action === 'signup') {
            trackSignup(providerName, result.user);
            // Show success message
            formManager.showSuccess('Account created successfully!');
          } else {
            trackLogin(providerName, result.user);
            // Show success message
            formManager.showSuccess('Successfully signed in!');
          }
        } catch (popupError) {
          // Check if popup was blocked or failed
          if (popupError.code === 'auth/popup-blocked' ||
              popupError.code === 'auth/popup-closed-by-user' ||
              popupError.code === 'auth/cancelled-popup-request') {

            console.log('Popup failed, falling back to redirect:', popupError.code);

            // Fallback to redirect
            await signInWithRedirect(auth, provider);
            // Note: This will redirect the user away from the page
            // The handleRedirectResult function will handle the result when they return
          } else {
            // Re-throw other errors
            throw popupError;
          }
        }
      } else {
        // Use redirect by default
        console.log('Using redirect for authentication');
        await signInWithRedirect(auth, provider);
        // Note: This will redirect the user away from the page
        // The handleRedirectResult function will handle the result when they return
      }
    } catch (error) {
      // Only capture unexpected errors to Sentry
      if (!isUserError(error.code)) {
        webManager.sentry().captureException(new Error('OAuth provider sign-in error', { cause: error }));
      }

      // Handle specific errors
      if (error.code === 'auth/account-exists-with-different-credential') {
        throw new Error('An account already exists with the same email address but different sign-in credentials. Try signing in with a different provider.');
      } else if (error.code === 'auth/invalid-credential') {
        throw new Error('Invalid credentials. Please try again.');
      } else if (error.code === 'auth/operation-not-allowed') {
        throw new Error('This sign-in method is not enabled. Please contact support.');
      } else if (error.code === 'auth/user-disabled') {
        throw new Error('This account has been disabled. Please contact support.');
      }

      throw error;
    }
  }

  function setupPasswordToggle() {
    const $toggleButtons = document.querySelectorAll('.uj-password-toggle');

    $toggleButtons.forEach($button => {
      $button.addEventListener('click', () => {
        // Find the password input in the same input group
        const $inputGroup = $button.closest('.input-group');
        const $passwordInput = $inputGroup.querySelector('input');

        if (!$passwordInput) {
          return;
        }

        // Toggle the input type
        const currentType = $passwordInput.type;
        const newType = currentType === 'password' ? 'text' : 'password';
        $passwordInput.type = newType;

        // Toggle icon visibility
        const $showIcon = $button.querySelector('.uj-password-show');
        const $hideIcon = $button.querySelector('.uj-password-hide');

        if (!$showIcon || !$hideIcon) {
          return;
        }

        if (newType === 'text') {
          $showIcon.classList.add('d-none');
          $hideIcon.classList.remove('d-none');
        } else {
          $showIcon.classList.remove('d-none');
          $hideIcon.classList.add('d-none');
        }
      });
    });
  }

  // Helper function to determine if an error is a user error
  function isUserError(errorCode) {
    const userErrors = [
      'auth/user-not-found',
      'auth/wrong-password',
      'auth/invalid-credential',
      'auth/invalid-email',
      'auth/weak-password',
      'auth/email-already-in-use',
      'auth/user-disabled',
      'auth/too-many-requests',
      'auth/popup-closed-by-user',
      'auth/cancelled-popup-request'
    ];
    return userErrors.includes(errorCode);
  }

  function trackLogin(method, user) {
    const userId = user.uid;
    const methodName = method.charAt(0).toUpperCase() + method.slice(1);

    // Google Analytics 4
    gtag('event', 'login', {
      method: method,
      user_id: userId
    });

    // Facebook Pixel
    fbq('trackCustom', 'Login', {
      content_name: `Account Login ${methodName}`,
      method: method,
    });

    // TikTok Pixel
    ttq.track('Login', {
      content_id: `account-login-${method}`,
      content_type: 'product',
      content_name: `Account Login ${methodName}`
    });
  }

  // Analytics tracking functions
  function trackSignup(method, user) {
    const userId = user.uid;
    const methodName = method.charAt(0).toUpperCase() + method.slice(1);

    // Google Analytics 4
    gtag('event', 'sign_up', {
      method: method,
      user_id: userId
    });

    // Facebook Pixel
    fbq('track', 'CompleteRegistration', {
      content_name: `Account Registration ${methodName}`,
      method: method,
    });

    // TikTok Pixel
    ttq.track('CompleteRegistration', {
      content_id: `account-registration-${method}`,
      content_type: 'product',
      content_name: `Account Registration ${methodName}`
    });
  }

  // Password reset tracking function
  function trackPasswordReset() {
    // Google Analytics 4
    gtag('event', 'password_reset', {
      method: 'email',
      status: 'success'
    });

    // Facebook Pixel
    fbq('trackCustom', 'PasswordReset', {
      method: 'email',
      status: 'success'
    });

    // TikTok Pixel
    ttq.track('SubmitForm', {
      content_id: 'password-reset',
      content_type: 'product',
      content_name: 'Password Reset'
    });
  }
}
