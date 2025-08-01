/**
 * Development-only utilities and features
 * This file contains code that should only run in development mode
 */
module.exports = function (Manager, options) {
  const { webManager } = Manager;

  // Main log
  console.log('⚠️ Enabling development mode features!');

  // Setup handlers
  setupHandlers(webManager);

  // Setup helpers
  setupHelpers(webManager);

  // Setup breakpoint logger
  setupBreakpointLogger();
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
  window.webManager = webManager;

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
