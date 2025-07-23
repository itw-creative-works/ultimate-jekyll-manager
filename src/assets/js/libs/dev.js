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
}

function setupHandlers(webManager) {
  // Add development click handler
  document.addEventListener('click', function (event) {
    console.log('Click', event.target);
  });
}

function setupHelpers(webManager) {
  // Add development helper functions

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
}

function getOpeningTag(tagName) {
  const el = document.querySelector(tagName);
  if (!el) return '';
  const attrs = Array.from(el.attributes)
    .map(attr => ` ${attr.name}="${attr.value}"`)
    .join('');
  return `<${el.tagName.toLowerCase()}${attrs}>`;
}
