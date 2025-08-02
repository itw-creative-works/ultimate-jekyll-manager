// This file is required by /signin, /signup, and /reset pages since the logic is mostly the same

// Module
module.exports = (Manager, options) => {
  // Shortcuts
  const { webManager } = Manager;

  // Handle DOM ready
  webManager.dom().ready()
  .then(async () => {
    // Check for authSignout parameter first
    await handleAuthSignout(webManager);

    // Check for redirect result from OAuth providers
    await handleRedirectResult();

    // Update auth return URL in all auth-related links
    updateAuthReturnUrl();

    // Autofocus email input on signin/signup/reset pages
    autoFocusEmailInput();

    // Setup click handlers for signin/signup buttons
    setupAuthHandlers();

    // Setup password visibility toggle
    setupPasswordToggle();
  });
}

async function handleRedirectResult() {
  try {
    // Import Firebase auth functions
    const { getAuth, getRedirectResult } = await import('web-manager/node_modules/firebase/auth');
    const auth = getAuth();

    // Check for redirect result
    const result = await getRedirectResult(auth);

    if (result && result.user) {
      console.log('Successfully authenticated via redirect:', result.user.email);

      // Handle successful authentication
      await handleAuthSuccess(result.user);
    }
  } catch (error) {
    console.error('Error handling redirect result:', error);

    // Handle specific OAuth errors
    if (error.code === 'auth/account-exists-with-different-credential') {
      showError('An account already exists with the same email address but different sign-in credentials. Try signing in with a different provider.');
    } else if (error.code === 'auth/popup-blocked') {
      showError('Popup was blocked. Please allow popups for this site and try again.');
    } else if (error.code === 'auth/cancelled-popup-request') {
      // User cancelled, no need to show error
    } else if (error.code) {
      showError(`Authentication error: ${error.message}`);
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

function autoFocusEmailInput() {
  // Find the email input field
  const $emailInput = document.querySelector('input[name="email"]');

  // If not found quit
  if (!$emailInput) {
    return;
  }

  // If already focused, quit
  if (document.activeElement === $emailInput) {
    return;
  }

  // Focus the email input
  $emailInput.focus();
}

function setupAuthHandlers() {
  const isSignupPage = window.location.pathname.includes('/signup');
  const isSigninPage = window.location.pathname.includes('/signin');

  // Get all auth buttons
  const signupButtons = document.querySelectorAll('.uj-signup-btn');
  const signinButtons = document.querySelectorAll('.uj-signin-btn');

  // Handle signup buttons
  signupButtons.forEach(button => {
    button.addEventListener('click', async (e) => {
      e.preventDefault();

      const provider = button.getAttribute('data-provider');

      try {
        if (provider === 'email') {
          await handleEmailSignup();
        } else {
          await handleProviderSignup(provider);
        }
      } catch (error) {
        console.error('Signup error:', error);
        showError(error.message);
      }
    });
  });

  // Handle signin buttons
  signinButtons.forEach(button => {
    button.addEventListener('click', async (e) => {
      e.preventDefault();

      const provider = button.getAttribute('data-provider');

      try {
        if (provider === 'email') {
          await handleEmailSignin();
        } else {
          await handleProviderSignin(provider);
        }
      } catch (error) {
        console.error('Signin error:', error);
        showError(error.message);
      }
    });
  });

  // Handle form submission for email auth
  const form = document.querySelector('form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      try {
        if (isSignupPage) {
          await handleEmailSignup();
        } else if (isSigninPage) {
          await handleEmailSignin();
        }
      } catch (error) {
        console.error('Auth error:', error);
        showError(error.message);
      }
    });
  }
}

async function attemptEmailSignIn(email, password) {
  const { getAuth, signInWithEmailAndPassword } = await import('web-manager/node_modules/firebase/auth');
  const auth = getAuth();
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential;
}

async function handleEmailSignup() {
  // Get form values
  const $emailField = document.getElementById('email');
  const $passwordField = document.getElementById('password');
  // const $termsCheckbox = document.getElementById('terms');
  // const $marketingCheckbox = document.getElementById('marketing');

  const email = $emailField?.value?.trim() || '';
  const password = $passwordField?.value || '';

  // Validate required fields with field focusing
  if (!email) {
    $emailField?.focus();
    throw new Error('Please enter your email address');
  }

  if (!password) {
    $passwordField?.focus();
    throw new Error('Please enter a password');
  }

  // // Validate terms agreement
  // if (!termsCheckbox || !termsCheckbox.checked) {
  //   termsCheckbox?.focus();
  //   throw new Error('You must agree to the Terms of Service');
  // }

  // // Validate marketing agreement
  // if (!marketingCheckbox || !marketingCheckbox.checked) {
  //   marketingCheckbox?.focus();
  //   throw new Error('You must agree to receive marketing communications');
  // }

  // Show loading state
  showLoading(true);

  try {
    // Import Firebase auth functions
    const { getAuth, createUserWithEmailAndPassword } = await import('web-manager/node_modules/firebase/auth');

    // Get auth instance and create user
    const auth = getAuth();
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    // Handle successful signup
    await handleAuthSuccess(userCredential.user);
  } catch (error) {
    showLoading(false);

    // Handle Firebase-specific errors and focus appropriate fields
    if (error.code === 'auth/invalid-email') {
      $emailField?.focus();
      throw new Error('Please enter a valid email address');
    } else if (error.code === 'auth/weak-password') {
      $passwordField?.focus();
      throw new Error('Password is too weak. Please choose a stronger password');
    } else if (error.code === 'auth/email-already-in-use') {
      // Try to sign in with the same credentials
      try {
        const userCredential = await attemptEmailSignIn(email, password);

        // If sign in succeeds, handle it as a successful auth
        await handleAuthSuccess(userCredential.user);
        return; // Exit early to prevent throwing the error
      } catch (signInError) {
        // If sign in fails, show the original error
        $emailField?.focus();
        throw new Error('An account with this email already exists');
      }
    }

    throw error;
  }
}

async function handleEmailSignin() {
  // Get form values
  const $emailField = document.getElementById('email');
  const $passwordField = document.getElementById('password');

  const email = $emailField?.value?.trim() || '';
  const password = $passwordField?.value || '';

  // Validate required fields with field focusing
  if (!email) {
    $emailField?.focus();
    throw new Error('Please enter your email address');
  }

  if (!password) {
    $passwordField?.focus();
    throw new Error('Please enter a password');
  }

  // Show loading state
  showLoading(true);

  try {
    // Sign in with email and password
    const userCredential = await attemptEmailSignIn(email, password);

    // Handle successful signin
    await handleAuthSuccess(userCredential.user);
  } catch (error) {
    showLoading(false);

    // Handle Firebase-specific errors and focus appropriate fields
    if (error.code === 'auth/invalid-email') {
      $emailField?.focus();
      throw new Error('Please enter a valid email address');
    } else if (error.code === 'auth/user-not-found') {
      $emailField?.focus();
      throw new Error('No account found with this email address');
    } else if (error.code === 'auth/wrong-password') {
      $passwordField?.focus();
      throw new Error('Incorrect password. Please try again');
    } else if (error.code === 'auth/invalid-credential') {
      $emailField?.focus();
      throw new Error('Invalid email or password. Please check your credentials and try again');
    } else if (error.code === 'auth/too-many-requests') {
      throw new Error('Too many failed attempts. Please try again later');
    }

    throw error;
  }
}

async function handleProviderSignup(providerName) {
  await signInWithProvider(providerName);
}

async function handleProviderSignin(providerName) {
  await signInWithProvider(providerName);
}

async function signInWithProvider(providerName) {
  // Show loading state
  showLoading(true);

  try {
    // Import Firebase auth functions and providers
    const {
      getAuth,
      signInWithRedirect,
      GoogleAuthProvider,
      FacebookAuthProvider,
      TwitterAuthProvider,
      GithubAuthProvider
    } = await import('web-manager/node_modules/firebase/auth');

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

    // Sign in with redirect
    await signInWithRedirect(auth, provider);
    // Note: This will redirect the user away from the page
    // The auth state listener in core/auth.js will handle the result when they return
  } catch (error) {
    showLoading(false);
    throw error;
  }
}

async function handleAuthSuccess(user) {
  // Get return URL from query params
  const url = new URL(window.location.href);
  const authReturnUrl = url.searchParams.get('authReturnUrl');

  // Redirect to return URL or default dashboard
  if (authReturnUrl) {
    window.location.href = authReturnUrl;
  } else {
    window.location.href = '/dashboard';
  }
}

let errorTimeout;

function showError(message) {
  // Clear existing timeout
  if (errorTimeout) {
    clearTimeout(errorTimeout);
  }

  // Create or update error alert
  let $errorAlert = document.querySelector('.auth-error-alert');

  if (!$errorAlert) {
    $errorAlert = document.createElement('div');
    $errorAlert.className = 'alert alert-danger auth-error-alert mb-3';
    $errorAlert.setAttribute('role', 'alert');

    // Insert after header or at top of form
    const $header = document.querySelector('.text-center.mb-4');
    if ($header && $header.nextSibling) {
      $header.parentNode.insertBefore($errorAlert, $header.nextSibling);
    } else {
      const $form = document.querySelector('form');
      if ($form) {
        $form.parentNode.insertBefore($errorAlert, $form);
      }
    }
  }

  $errorAlert.textContent = message;
  $errorAlert.style.display = 'block';

  // Auto-hide after 5 seconds
  errorTimeout = setTimeout(() => {
    if ($errorAlert) {
      $errorAlert.style.display = 'none';
    }
  }, 5000);
}

function showLoading(show) {
  // Disable/enable all buttons
  const $buttons = document.querySelectorAll('.uj-signup-btn, .uj-signin-btn');

  $buttons.forEach($button => {
    if (show) {
      $button.disabled = true;
      // Store original text
      $button.setAttribute('data-original-text', $button.innerHTML);
      $button.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Loading...';
    } else {
      $button.disabled = false;
      // Restore original text
      const originalText = $button.getAttribute('data-original-text');
      if (originalText) {
        $button.innerHTML = originalText;
      }
    }
  });

  // Disable/enable form inputs
  const $inputs = document.querySelectorAll('input');
  $inputs.forEach($input => {
    $input.disabled = show;
  });
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
