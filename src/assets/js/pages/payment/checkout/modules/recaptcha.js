// reCAPTCHA management for checkout
let recaptchaReady = false;
let recaptchaSiteKey = null;

// Initialize reCAPTCHA
export async function initializeRecaptcha(siteKey) {
  if (!siteKey) {
    console.warn('No reCAPTCHA site key provided');
    return false;
  }

  recaptchaSiteKey = siteKey;

  // Check if already loaded
  if (window.grecaptcha) {
    recaptchaReady = true;
    return true;
  }

  // Load reCAPTCHA script
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      // Wait for grecaptcha to be ready
      grecaptcha.ready(() => {
        recaptchaReady = true;
        console.log('🔐 reCAPTCHA initialized successfully');
        resolve(true);
      });
    };
    
    script.onerror = () => {
      console.error('Failed to load reCAPTCHA');
      resolve(false);
    };
    
    document.head.appendChild(script);
  });
}

// Get reCAPTCHA token
export async function getRecaptchaToken(action = 'checkout') {
  if (!recaptchaReady || !recaptchaSiteKey) {
    console.warn('reCAPTCHA not initialized');
    return null;
  }

  try {
    console.log('🔐 Getting reCAPTCHA token for action:', action);
    const token = await grecaptcha.execute(recaptchaSiteKey, { action });
    console.log('🔐 reCAPTCHA token obtained successfully');
    return token;
  } catch (error) {
    console.error('Failed to get reCAPTCHA token:', error);
    return null;
  }
}

// Check if reCAPTCHA is ready
export function isRecaptchaReady() {
  return recaptchaReady;
}