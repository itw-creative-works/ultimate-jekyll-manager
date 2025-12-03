// Import the theme entry point
import bootstrap from '../bootstrap/js/index.umd.js';
import { ready as domReady } from 'web-manager/modules/dom.js';

// Make Bootstrap available globally
window.bootstrap = bootstrap;

// Log that we've MADE IT
/* @dev-only:start */
{
  console.log('Classy theme loaded successfully (assets/themes/classy/_theme.js)');
}
/* @dev-only:end */

// Import navbar scroll functionality
import setupNavbarScroll from './js/navbar-scroll.js';
// Import logo scroll functionality
import setupLogoScroll from './js/logo-scroll.js';
// Import tooltip initialization
import initializeTooltips from './js/initialize-tooltips.js';

// Initialize theme components when DOM is ready
domReady().then(() => {
  // Classy Theme Initializations
  setupNavbarScroll();
  setupLogoScroll();

  // Generic Bootstrap initializations
  initializeTooltips();
});
