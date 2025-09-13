// This file is required by /signin, /signup, and /reset pages since the logic is mostly the same
import { FormManager } from '__main_assets__/js/libs/form-manager.js';

// Module
export default function (Manager) {
  // Shortcuts
  const { webManager } = Manager;

  // Form manager instance
  let formManager = null;

  // Handle DOM ready
  webManager.dom().ready()
  .then(async () => {
    // Check for authSignout parameter first
    await handleAuthSignout(webManager);

    // Check for redirect result from OAuth providers
    await handleRedirectResult();

    // Update auth return URL in all auth-related links
    updateAuthReturnUrl();

    // Setup password visibility toggle
    setupPasswordToggle();

    // Initialize the appropriate form based on the page
    initializePageForm();
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

  // Initialize signin form
  function initializeSigninForm() {
    formManager = new FormManager('#signin-form', {
      errorContainer: '.auth-error-alert',
      submitButtonLoadingText: 'Signing in...',
      allowMultipleSubmit: false,
      validateOnSubmit: false, // We'll handle validation manually
      fieldErrorClass: 'is-invalid',
      fieldSuccessClass: 'is-valid'
    });

    // Handle form submission
    formManager.addEventListener('submit', async (e) => {
      // Prevent FormManager's default submit handler
      e.preventDefault();

      const { submitButton } = e.detail;
      const provider = submitButton?.getAttribute('data-provider');

      try {
        if (provider === 'email') {
          await handleEmailSignin();
        } else if (provider) {
          await signInWithProvider(provider, 'signin');
        }
      } catch (error) {
        // Don't call setFormState here - handleEmailSignin already handles it
        console.error('Signin error:', error);
      }
    });
  }

  // Initialize signup form
  function initializeSignupForm() {
    formManager = new FormManager('#signup-form', {
      errorContainer: '.auth-error-alert',
      submitButtonLoadingText: 'Creating account...',
      allowMultipleSubmit: false,
      validateOnSubmit: false, // We'll handle validation manually
      fieldErrorClass: 'is-invalid',
      fieldSuccessClass: 'is-valid'
    });

    // Handle form submission
    formManager.addEventListener('submit', async (e) => {
      // Prevent FormManager's default submit handler
      e.preventDefault();

      const { submitButton } = e.detail;
      const provider = submitButton?.getAttribute('data-provider');

      try {
        if (provider === 'email') {
          await handleEmailSignup();
        } else if (provider) {
          await signInWithProvider(provider, 'signup');
        }
      } catch (error) {
        // Don't call setFormState here - handleEmailSignup already handles it
        console.error('Signup error:', error);
      }
    });
  }

  // Initialize reset form
  function initializeResetForm() {
    formManager = new FormManager('#reset-form', {
      errorContainer: '.auth-error-alert',
      successContainer: '.auth-success-alert',
      submitButtonLoadingText: 'Sending...',
      submitButtonSuccessText: 'Email Sent!',
      allowMultipleSubmit: false,
      validateOnSubmit: true,
      fieldErrorClass: 'is-invalid',
      fieldSuccessClass: 'is-valid'
    });

    // Handle form submission
    formManager.addEventListener('submit', async (e) => {
      // Prevent FormManager's default submit handler
      e.preventDefault();

      try {
        await handlePasswordReset();
      } catch (error) {
        // Don't call setFormState here - handlePasswordReset already handles it
        console.error('Reset error:', error);
      }
    });
  }

  async function handleRedirectResult() {
    try {
      // Import Firebase auth functions
      const { getAuth, getRedirectResult } = await import('@firebase/auth');
      const auth = getAuth();

      // Check for redirect result
      const result = await getRedirectResult(auth);

      if (result && result.user) {
        console.log('Successfully authenticated via redirect:', result.user.email);

        // Determine the provider from the result
        const providerId = result.providerId || result.user.providerData?.[0]?.providerId || 'unknown';

        // Track based on whether this is a new user
        const isNewUser = result.additionalUserInfo?.isNewUser;
        const pagePath = document.documentElement.getAttribute('data-page-path');
        const isSignupPage = pagePath === '/signup';

        if (isNewUser || isSignupPage) {
          trackSignup(providerId, result.user);
        } else {
          trackLogin(providerId, result.user);
        }
      }
    } catch (error) {
      // Only capture unexpected errors to Sentry
      if (!isUserError(error.code)) {
        webManager.sentry().captureException(new Error('Error handling redirect result', { cause: error }));
      }

      // Handle specific OAuth errors
      if (error.code === 'auth/account-exists-with-different-credential') {
        if (formManager) {
          formManager.showError('An account already exists with the same email address but different sign-in credentials. Try signing in with a different provider.');
        }
      } else if (error.code === 'auth/popup-blocked') {
        if (formManager) {
          formManager.showError('Popup was blocked. Please allow popups for this site and try again.');
        }
      } else if (error.code && error.code !== 'auth/cancelled-popup-request') {
        if (formManager) {
          formManager.showError(`Authentication error: ${error.message}`);
        }
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

  async function handleEmailSignup() {
    // Get form data from FormManager
    const formData = formManager.getData();
    console.log('Signup FormManager data:', formData);

    // Try to get values directly from the input fields as a fallback
    const emailInput = document.querySelector('#signup-form input[name="email"]');
    const passwordInput = document.querySelector('#signup-form input[name="password"]');
    const emailFromInput = emailInput ? emailInput.value : '';
    const passwordFromInput = passwordInput ? passwordInput.value : '';

    const email = formData.email?.trim() || emailFromInput?.trim() || '';
    const password = formData.password || passwordFromInput || '';

    console.log('Email value:', email, 'Password value:', password);

    // Validate required fields for email signup
    const errors = {};
    if (!email) {
      errors.email = 'Email is required';
    } else if (!formManager.isValidEmail(email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    // If validation fails, show errors and return
    if (Object.keys(errors).length > 0) {
      formManager.setFormState('ready');
      formManager.showErrors(errors);
      return;
    }


    try {
      // Import Firebase auth functions
      const { getAuth, createUserWithEmailAndPassword } = await import('@firebase/auth');

      // Get auth instance and create user
      const auth = getAuth();
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // Track signup
      trackSignup('email', userCredential.user);

      // FormManager will handle the success state
      formManager.setFormState('submitted');
    } catch (error) {
      // Only capture unexpected errors to Sentry (not user errors)
      if (!isUserError(error.code)) {
        webManager.sentry().captureException(new Error('Signup error', { cause: error }));
      }

      // Handle Firebase-specific errors
      if (error.code === 'auth/email-already-in-use') {
        // Try to sign in with the same credentials
        try {
          // Log
          console.log('Email already in use, attempting to sign in instead:', email);

          const userCredential = await attemptEmailSignIn(email, password);

          // Track this as a login instead of signup
          trackLogin('email', userCredential.user);

          // Set success state
          formManager.setFormState('submitted');
          return;
        } catch (signInError) {
          // Only capture unexpected errors to Sentry
          if (!isUserError(signInError.code)) {
            webManager.sentry().captureException(new Error('Signin error during signup flow', { cause: signInError }));
          }

          // If sign in fails, set back to ready and show error
          formManager.setFormState('ready');
          formManager.showError('An account with this email already exists');
          return;
        }
      }

      // Set form back to ready state for other errors
      formManager.setFormState('ready');

      // Handle other Firebase-specific errors
      let errorMessage = 'An error occurred. Please try again.';

      if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please choose a stronger password';
      } else if (error.message) {
        errorMessage = error.message;
      }

      // Show error using FormManager
      formManager.showError(errorMessage);
    }
  }

  async function handleEmailSignin() {
    // Get form data from FormManager
    const formData = formManager.getData();
    console.log('Signin FormManager data:', formData);

    // Try to get values directly from the input fields as a fallback
    const emailInput = document.querySelector('#signin-form input[name="email"]');
    const passwordInput = document.querySelector('#signin-form input[name="password"]');
    const emailFromInput = emailInput ? emailInput.value : '';
    const passwordFromInput = passwordInput ? passwordInput.value : '';

    const email = formData.email?.trim() || emailFromInput?.trim() || '';
    const password = formData.password || passwordFromInput || '';

    console.log('Email value:', email, 'Password value:', password);

    // Validate required fields for email signin
    const errors = {};
    if (!email) {
      errors.email = 'Email is required';
    } else if (!formManager.isValidEmail(email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (!password) {
      errors.password = 'Password is required';
    }

    // If validation fails, show errors and return
    if (Object.keys(errors).length > 0) {
      formManager.setFormState('ready');
      formManager.showErrors(errors);
      return;
    }


    try {
      // Sign in with email and password
      const userCredential = await attemptEmailSignIn(email, password);

      // Track login
      trackLogin('email', userCredential.user);

      // FormManager will handle the success state
      formManager.setFormState('submitted');
    } catch (error) {
      // Only capture unexpected errors to Sentry (not user errors)
      if (!isUserError(error.code)) {
        webManager.sentry().captureException(new Error('Login error', { cause: error }));
      }

      // Set form back to ready state
      formManager.setFormState('ready');

      // Handle Firebase-specific errors
      let errorMessage = 'An error occurred. Please try again.';

      if (error.code === 'auth/invalid-credential') {
        errorMessage = 'Invalid email or password. Please check your credentials and try again';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address';
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again';
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'This account has been disabled';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later';
      } else if (error.message) {
        errorMessage = error.message;
      }

      // Show error using FormManager
      formManager.showError(errorMessage);
    }
  }

  async function handlePasswordReset() {
    // Get form data from FormManager (already validated)
    const formData = formManager.getData();
    console.log('FormManager data:', formData);

    // Try to get email directly from the input field as a fallback
    const emailInput = document.querySelector('#reset-form input[name="email"]');
    const emailFromInput = emailInput ? emailInput.value : '';
    console.log('Email from input directly:', emailFromInput);

    const email = formData.email?.trim() || emailFromInput?.trim() || '';
    console.log('Final email value:', email);

    if (!email) {
      formManager.setFormState('ready');
      formManager.showError('Please enter your email address');
      return;
    }


    try {
      // Import Firebase auth functions
      const { getAuth, sendPasswordResetEmail } = await import('@firebase/auth');

      // Get auth instance
      const auth = getAuth();

      // Send password reset email
      await sendPasswordResetEmail(auth, email);

      // Track password reset
      trackPasswordReset();

      // Show success message
      formManager.showSuccess(`Password reset email sent to ${email}. Please check your inbox.`);

      // Set form to submitted state
      formManager.setFormState('submitted');
    } catch (error) {
      // Only capture unexpected errors to Sentry (not user errors)
      if (!isUserError(error.code)) {
        webManager.sentry().captureException(new Error('Password reset error', { cause: error }));
      }

      // Handle Firebase-specific errors
      if (error.code === 'auth/user-not-found') {
        // For security, we don't reveal if the user exists
        // Still show success to prevent email enumeration
        trackPasswordReset(email); // Track as success for security
        formManager.showSuccess(`If an account exists for ${email}, a password reset email has been sent.`);
        formManager.setFormState('submitted');
        return;
      }

      // Set form back to ready state for other errors
      formManager.setFormState('ready');

      // Handle other Firebase-specific errors
      let errorMessage = 'An error occurred. Please try again.';

      if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many requests. Please try again later';
      } else if (error.message) {
        errorMessage = error.message;
      }

      // Show error using FormManager
      formManager.showError(errorMessage);
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

      try {
        // Try popup first for better UX
        const result = await signInWithPopup(auth, provider);
        console.log('Successfully authenticated via popup:', result.user.email);

        // Track based on whether this is a new user
        const isNewUser = result.additionalUserInfo?.isNewUser;
        if (isNewUser || action === 'signup') {
          trackSignup(providerName, result.user);
        } else {
          trackLogin(providerName, result.user);
        }

        // Set form to submitted state
        if (formManager) {
          formManager.setFormState('submitted');
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

        if (!$passwordInput) return;

        // Toggle the input type
        const currentType = $passwordInput.type;
        const newType = currentType === 'password' ? 'text' : 'password';
        $passwordInput.type = newType;

        // Toggle icon visibility
        const $showIcon = $button.querySelector('.uj-password-show');
        const $hideIcon = $button.querySelector('.uj-password-hide');

        if ($showIcon && $hideIcon) {
          if (newType === 'text') {
            $showIcon.classList.add('d-none');
            $hideIcon.classList.remove('d-none');
          } else {
            $showIcon.classList.remove('d-none');
            $hideIcon.classList.add('d-none');
          }
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

    // Google Analytics 4
    gtag('event', 'login', {
      method: method,
      user_id: userId
    });

    // Facebook Pixel
    fbq('trackCustom', 'Login', {
      method: method,
      status: 'success'
    });

    // TikTok Pixel
    ttq.track('Login', {
      content_name: 'Account',
      content_id: userId,
      status: 'success'
    });
  }

  // Analytics tracking functions
  function trackSignup(method, user) {
    const userId = user.uid;

    // Google Analytics 4
    gtag('event', 'sign_up', {
      method: method,
      user_id: userId
    });

    // Facebook Pixel
    fbq('track', 'CompleteRegistration', {
      content_name: 'Account',
      status: 'success',
      value: 0,
      currency: 'USD'
    });

    // TikTok Pixel
    ttq.track('CompleteRegistration', {
      content_name: 'Account',
      content_id: userId,
      status: 'success'
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
      content_name: 'Password Reset',
      content_type: 'account_recovery'
    });
  }
}
