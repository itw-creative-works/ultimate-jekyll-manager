// Page Loader Module - Handles page loading state indicator
export default function (Manager, options) {
  // Shortcuts
  const { webManager } = Manager;

  // Remove page loading state indicator
  const removeLoadingState = () => {
    document.documentElement.removeAttribute('data-page-loading');
  };

  // Check if the window is already loaded
  if (document.readyState === 'complete') {
    // Already loaded, remove immediately
    removeLoadingState();
  } else {
    // Wait for window load event
    window.addEventListener('load', removeLoadingState, { once: true });
  }
}
