/**
 * Development-only utilities and features
 * This file contains code that should only run in development mode
 */
export default function (Manager, options) {
  const { webManager } = Manager;

  // Main log
  console.log('⚠️ Enabling development mode features!');

  // Setup handlers
  setupHandlers(webManager);

  // Setup helpers
  setupHelpers(webManager);

  // Setup breakpoint logger
  setupBreakpointLogger();

  // Setup tracking interceptors
  setupTrackingInterceptors();
}

function setupHandlers(webManager) {
  // Add development click handler
  document.addEventListener('click', function (event) {
    console.log('Click', event.target);
  });
}

function setupHelpers(webManager) {
  // Add development helper functions

  // Globalize the webManager
  // window.webManager = webManager;

  // Log opening tags of common HTML elements
  window.logOpeningTags = function (detail) {
    const tags = ['html', 'body', 'nav', 'main', 'footer'];

    // Convert detail to array if provided
    const detailTags = detail ? (Array.isArray(detail) ? detail : [detail]) : [];

    // Log opening tags and add innerHTML for matching detail tags
    const result = tags.map(tag => {
      const el = document.querySelector(tag);
      if (!el) return `<!-- ${tag} not found -->`;

      const openingTag = getOpeningTag(tag);

      // If this tag matches detail, include innerHTML
      if (detailTags.includes(tag)) {
        const innerHTML = el.innerHTML.trim();
        return `${openingTag}\n${innerHTML}\n</${el.tagName.toLowerCase()}>`;
      }

      return openingTag;
    }).join('\n\n');

    // Log the result
    console.log('Opening tags:\n', result);
  };

  // Change theme to the argument or flip it
  window.changeTheme = function (theme) {
    const currentTheme = document.documentElement.getAttribute('data-bs-theme');
    if (theme) {
      document.documentElement.setAttribute('data-bs-theme', theme);
    } else {
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-bs-theme', newTheme);
    }
    console.log(`Theme changed to: ${document.documentElement.getAttribute('data-bs-theme')}`);
  };
}

function getOpeningTag(tagName) {
  const el = document.querySelector(tagName);
  if (!el) return '';
  const attrs = Array.from(el.attributes)
    .map(attr => ` ${attr.name}="${attr.value}"`)
    .join('');
  return `<${el.tagName.toLowerCase()}${attrs}>`;
}

function setupBreakpointLogger() {
  let lastBreakpoint = null;

  function getCurrentBreakpoint() {
    const width = window.innerWidth;

    if (width >= 1400) return 'xxl';
    if (width >= 1200) return 'xl';
    if (width >= 992) return 'lg';
    if (width >= 768) return 'md';
    if (width >= 576) return 'sm';
    return 'xs';
  }

  function logBreakpoint() {
    const breakpoint = getCurrentBreakpoint();

    if (breakpoint !== lastBreakpoint) {
      const width = window.innerWidth;
      console.log(`📱 Current breakpoint: ${breakpoint} (${width}px)`);
      lastBreakpoint = breakpoint;
    }
  }

  // Log breakpoint on page load
  logBreakpoint();

  // Log breakpoint on resize
  let resizeTimeout;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(logBreakpoint, 100);
  });
}

function setupTrackingInterceptors() {
  console.log('🔍 Setting up tracking interceptors...');

  // Intercept Google Analytics (gtag)
  if (typeof window.gtag !== 'undefined') {
    const originalGtag = window.gtag;
    window.gtag = function() {
      const args = Array.from(arguments);
      const command = args[0];
      const eventNameOrParams = args[1];
      const params = args[2];

      // Log the gtag call
      console.log('📊 gtag:', {
        command: command,
        event: eventNameOrParams,
        params: params || eventNameOrParams,
        fullArgs: args
      });

      // Call the original gtag function
      return originalGtag.apply(this, arguments);
    };
    console.log('✅ gtag interceptor installed');
  }

  // Intercept Facebook Pixel (fbq)
  if (typeof window.fbq !== 'undefined') {
    const originalFbq = window.fbq;

    // Create wrapper function that preserves all properties
    const fbqWrapper = function() {
      const args = Array.from(arguments);
      const command = args[0];
      const event = args[1];
      const params = args[2];

      // Log the fbq call
      console.log('📘 fbq:', {
        command: command,
        event: event,
        params: params,
        fullArgs: args
      });

      // Call the original fbq function
      return originalFbq.apply(this, arguments);
    };

    // Copy all properties from original fbq to wrapper
    Object.keys(originalFbq).forEach(key => {
      fbqWrapper[key] = originalFbq[key];
    });

    // If callMethod exists, wrap it too
    if (originalFbq.callMethod) {
      const originalCallMethod = originalFbq.callMethod;
      fbqWrapper.callMethod = function() {
        const args = Array.from(arguments);
        console.log('📘 fbq.callMethod:', args);
        return originalCallMethod.apply(originalFbq, arguments);
      };
    }

    // Preserve queue if it exists (for stub implementation)
    if (originalFbq.queue) {
      fbqWrapper.queue = originalFbq.queue;
    }

    // Preserve push method if it exists (for stub implementation)
    if (originalFbq.push) {
      fbqWrapper.push = originalFbq.push;
    }

    window.fbq = fbqWrapper;
    console.log('✅ fbq interceptor installed');
  }

  // Intercept TikTok Pixel (ttq)
  if (typeof window.ttq !== 'undefined' && window.ttq.track) {
    const originalTtq = window.ttq;
    const originalTrack = window.ttq.track;
    const originalPage = window.ttq.page;
    const originalIdentify = window.ttq.identify;
    const originalLoad = window.ttq.load;

    // Intercept track method
    window.ttq.track = function() {
      const args = Array.from(arguments);
      const event = args[0];
      const params = args[1];

      // Log the ttq.track call
      console.log('🎵 ttq.track:', {
        event: event,
        params: params,
        fullArgs: args
      });

      // Call the original track function
      return originalTrack.apply(originalTtq, arguments);
    };

    // Intercept page method
    window.ttq.page = function() {
      const args = Array.from(arguments);

      // Log the ttq.page call
      console.log('🎵 ttq.page:', {
        fullArgs: args
      });

      // Call the original page function
      return originalPage.apply(originalTtq, arguments);
    };

    // Intercept identify method
    window.ttq.identify = function() {
      const args = Array.from(arguments);

      // Log the ttq.identify call
      console.log('🎵 ttq.identify:', {
        fullArgs: args
      });

      // Call the original identify function
      return originalIdentify.apply(originalTtq, arguments);
    };

    // Intercept load method
    window.ttq.load = function() {
      const args = Array.from(arguments);

      // Log the ttq.load call
      console.log('🎵 ttq.load:', {
        pixelId: args[0],
        fullArgs: args
      });

      // Call the original load function
      return originalLoad.apply(originalTtq, arguments);
    };

    console.log('✅ ttq interceptor installed');
  }

  // Check again after a delay in case tracking libraries load asynchronously
  setTimeout(() => {
    if (typeof window.gtag === 'undefined') {
      console.log('⚠️ gtag not found - may load later');
    }
    if (typeof window.fbq === 'undefined') {
      console.log('⚠️ fbq not found - may load later');
    }
    if (typeof window.ttq === 'undefined' || !window.ttq.track) {
      console.log('⚠️ ttq not found or is a stub - may load later');
    }
  }, 3000);
}
