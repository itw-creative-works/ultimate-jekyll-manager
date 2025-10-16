// Page Loader Module - Handles page loading state indicator
export default function (Manager, options) {
  // Shortcuts
  const { webManager } = Manager;

  // Remove page loading state indicator
  const removeLoadingState = () => {
    setTimeout(() => {
      document.documentElement.removeAttribute('data-page-loading');
    }, 16);
  };

  // Attach click listener to prevent clicks on disabled elements
  document.addEventListener('click', (e) => {
    const $target = e.target;
    if ($target.closest('*[disabled], *.disabled, :disabled')) {
      // Log disabled click attempt
      console.log('Click prevented (disabled):', $target);

      // Prevent all actions
      e.preventDefault();
      e.stopImmediatePropagation();
      e.stopPropagation();
      return false;
    }
  }, { capture: true });

  // Check if the window is already loaded
  if (document.readyState === 'complete') {
    // Already loaded, remove immediately
    removeLoadingState();
  } else {
    // Wait for window load event
    window.addEventListener('load', removeLoadingState, { once: true });
  }
}
