// reCAPTCHA management for checkout
let recaptchaReady = false;
let recaptchaSiteKey = null;

// Initialize reCAPTCHA
export async function initializeRecaptcha(siteKey, webManager) {
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

  try {
    // Use webManager.dom().loadScript()
    const scriptUrl = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;

    await webManager.dom().loadScript({
      src: scriptUrl,
      async: true,
      defer: true,
      timeout: 30000, // 30 second timeout
      retries: 2 // Retry twice on failure
    });

    // Wait for grecaptcha to be ready
    await new Promise((resolve) => {
      if (window.grecaptcha && window.grecaptcha.ready) {
        window.grecaptcha.ready(() => {
          recaptchaReady = true;
          console.log('🔐 reCAPTCHA initialized successfully');
          resolve();
        });
      } else {
        // Fallback timeout if grecaptcha.ready is not available
        console.warn('grecaptcha.ready not available, using timeout fallback');
        setTimeout(() => {
          recaptchaReady = true;
          resolve();
        }, 1000);
      }
    });

    return true;
  } catch (error) {
    console.error('Failed to load reCAPTCHA:', error);
    return false;
  }
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
