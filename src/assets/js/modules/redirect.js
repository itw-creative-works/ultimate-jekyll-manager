/**
 * Redirect Module
 * Handles intelligent redirects with querystring forwarding, custom modifiers, and development mode delays.
 * Configuration is passed via data attributes on a #redirect-config element.
 */

const performRedirect = () => {
  // Get redirect configuration element
  const $redirectConfig = document.getElementById('redirect-config');
  if (!$redirectConfig) {
    console.error('[Redirect] Configuration element #redirect-config not found');
    return;
  }

  // Extract configuration from data attributes
  const config = {
    url: $redirectConfig.getAttribute('data-url'),
    querystring: $redirectConfig.getAttribute('data-querystring'),
    modifier: $redirectConfig.getAttribute('data-modifier'),
    siteUrl: $redirectConfig.getAttribute('data-site-url'),
    environment: $redirectConfig.getAttribute('data-environment')
  };

  // Log configuration
  console.log('[Redirect] Configuration:', config);

  // Validate required configuration
  if (!config.siteUrl) {
    console.error('[Redirect] Site URL is required but not provided');
    return;
  }

  // Parse URLs
  const currentUrl = new URL(window.location.href);
  const siteUrl = new URL(config.siteUrl);

  // Parse modifier function
  let modifierFunction = (url) => url;
  if (config.modifier && config.modifier !== '""' && config.modifier !== '') {
    try {
      // Safely evaluate modifier function
      modifierFunction = new Function('url', `return (${config.modifier})(url)`);
    } catch (error) {
      console.warn('[Redirect] Failed to parse modifier function:', error);
      console.warn('[Redirect] Modifier string:', config.modifier);
    }
  }

  // Determine redirect delay
  const isDevelopment = config.environment === 'development';
  const timeout = isDevelopment ? 3000 : 1;

  // Build redirect URL
  let redirectUrl;
  try {
    if (config.url) {
      // Handle both relative and absolute URLs
      const isAbsoluteUrl = /^https?:\/\//i.test(config.url);
      if (isAbsoluteUrl) {
        redirectUrl = new URL(config.url);
      } else {
        // Construct URL from site base
        const path = config.url.startsWith('/') ? config.url : `/${config.url}`;
        redirectUrl = new URL(`${siteUrl.origin}${path}`);
      }
    } else {
      // Default to site home page
      redirectUrl = new URL(siteUrl);
    }
  } catch (error) {
    console.error('[Redirect] Invalid redirect URL:', config.url, error);
    redirectUrl = new URL(siteUrl);
  }

  // Handle querystring forwarding
  const shouldForwardQuerystring = config.querystring !== 'false' && config.querystring !== false;
  if (shouldForwardQuerystring && currentUrl.search) {
    // Merge current URL params into redirect URL
    for (const [key, value] of currentUrl.searchParams.entries()) {
      redirectUrl.searchParams.set(key, value);
    }
    console.log(`[Redirect] Forwarded ${currentUrl.searchParams.size} query parameters`);
  }

  // Apply modifier function
  let finalUrl;
  try {
    const modifiedUrl = modifierFunction(redirectUrl);
    finalUrl = modifiedUrl instanceof URL ? modifiedUrl.toString() : modifiedUrl;
  } catch (error) {
    console.error('[Redirect] Modifier function threw an error:', error);
    finalUrl = redirectUrl.toString();
  }

  // Log redirect details
  console.group('[Redirect] Configuration');
  console.log('Original URL:', config.url);
  console.log('Querystring forwarding:', shouldForwardQuerystring);
  console.log('Modifier:', config.modifier);
  console.log('Environment:', config.environment);
  console.log('Delay:', `${timeout}ms`);
  console.log('Final URL:', finalUrl);
  console.groupEnd();

  // Show user-friendly message in development
  if (isDevelopment) {
    console.log(`[Redirect] Delaying redirect by ${timeout}ms for development mode`);
  }

  return

  // Perform the redirect
  setTimeout(() => {
    window.location.href = finalUrl;
  }, timeout);
};

// Initialize based on Manager availability and DOM state
if (document.readyState === 'loading') {
  // Wait for DOM if still loading
  document.addEventListener('DOMContentLoaded', performRedirect);
} else {
  // DOM is already ready
  performRedirect();
}

