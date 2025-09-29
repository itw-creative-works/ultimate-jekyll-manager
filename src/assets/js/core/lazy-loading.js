// Lazy Loading Module
export default function (Manager, options) {
  // Shortcuts
  const { webManager } = Manager;

  // Constants
  const TRANSPARENT_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

  // Configuration
  const config = webManager.config.lazyLoading.config;

  // Track loaded elements to avoid reprocessing
  const loadedElements = new WeakSet();

  // IntersectionObserver instance
  let observer = null;

  // Wait for DOM to be ready
  webManager.dom().ready().then(() => {
    initLazyLoading();
  });

  function initLazyLoading() {
    // Check if IntersectionObserver is supported
    if (!('IntersectionObserver' in window)) {
      // Load all images immediately
      loadAllImages();

      // Stop initialization
      return;
    }

    // Create the observer
    observer = new IntersectionObserver(handleIntersection, {
      rootMargin: config.rootMargin,
      threshold: config.threshold
    });

    // Start observing elements
    observeElements();

    // Re-observe on dynamic content changes
    setupMutationObserver();
  }

  function handleIntersection(entries, observer) {
    entries.forEach(entry => {
      if (!entry.isIntersecting) {
        return; // Element is not in view, skip
      }

      // Element is in view, process it
      const element = entry.target;

      // Stop observing this element
      observer.unobserve(element);

      // Load the element
      loadElement(element);
    });
  }

  function loadElement(element) {
    // Skip if already loaded
    if (loadedElements.has(element)) {
      return;
    }

    // Mark as loading
    element.classList.remove(config.errorClass);
    element.classList.add(config.loadingClass);

    // Get the lazy attribute value
    const lazyValue = element.getAttribute('data-lazy');
    if (!lazyValue) {
      markAsLoaded(element);
      return;
    }

    // Parse the lazy attribute (find first space)
    const spaceIndex = lazyValue.indexOf(' ');
    if (spaceIndex <= 0) {
      markAsError(`Invalid format: ${lazyValue}`, element);
      return;
    }

    const type = lazyValue.slice(0, spaceIndex).trim();
    const value = lazyValue.slice(spaceIndex + 1).trim();

    // Validate value exists
    if (!value) {
      markAsError(`Empty value in data-lazy: ${lazyValue}`, element);
      return;
    }

    // Log
    /* @dev-only:start */
    {
      // console.log('Lazy-loading:', type, value, 'for element:', element);
    }
    /* @dev-only:end */

    // Remove data-lazy immediately to prevent duplicate processing
    element.removeAttribute('data-lazy');

    // Load based on type
    switch(type) {
      case '@src':
        loadSrc(element, value);
        break;
      case '@srcset':
        loadSrcset(element, value);
        break;
      case '@bg':
        loadBackground(element, value);
        break;
      case '@class':
        loadClass(element, value);
        break;
      case '@html':
        loadHtml(element, value);
        break;
      case '@script':
        loadScript(element, value);
        break;
      default:
        markAsError(`Unknown lazy load type: ${type}`, element);
    }
  }

  function loadSrc(element, value) {
    const tagName = element.tagName.toLowerCase();

    // For images, test load first
    if (tagName === 'img') {
      // Set a transparent placeholder to prevent broken image icon
      element.src = TRANSPARENT_PLACEHOLDER;

      const tempImg = new Image();

      tempImg.onload = () => {
        element.src = value;
        markAsLoaded(element);
      };

      tempImg.onerror = () => {
        markAsError(`Failed to load image: ${value}`, element);
      };

      tempImg.src = value;

      // Handle already cached images
      if (tempImg.complete && tempImg.naturalHeight !== 0) {
        tempImg.onload();
      }
    }
    // For iframes and videos, just set src directly
    else if (tagName === 'iframe' || tagName === 'video') {
      element.src = value;

      // Listen for load/error events
      const loadEvent = tagName === 'video' ? 'loadeddata' : 'load';

      element.addEventListener(loadEvent, () => {
        markAsLoaded(element);
      }, { once: true });

      element.addEventListener('error', () => {
        markAsError(`Failed to load ${element.tagName.toLowerCase()}: ${value}`, element);
      }, { once: true });

      // For video, trigger load
      if (tagName === 'video') {
        element.load();
      }
    // For other elements, just set src
    } else {
      // Generic src setting
      element.src = value;
      markAsLoaded(element);
    }
  }

  function loadSrcset(element, value) {
    const tagName = element.tagName.toLowerCase();

    if (tagName === 'img') {
      // Test load with srcset
      const tempImg = new Image();

      tempImg.onload = () => {
        element.srcset = value;
        markAsLoaded(element);
      };

      tempImg.onerror = () => {
        markAsError(`Failed to load image: ${value}`, element);
      };

      tempImg.srcset = value;
    } else if (tagName === 'source') {
      // For source elements, just set srcset
      element.srcset = value;

      // Force parent picture to re-evaluate
      const picture = element.closest('picture');
      if (picture) {
        const img = picture.querySelector('img');
        if (img && img.src) {
          img.src = img.src;
        }
      }

      markAsLoaded(element);
    } else {
      // Generic srcset
      element.srcset = value;
      markAsLoaded(element);
    }
  }

  function loadBackground(element, value) {
    // Test load background image
    const tempImg = new Image();

    tempImg.onload = () => {
      element.style.backgroundImage = `url('${value}')`;
      markAsLoaded(element);
    };

    tempImg.onerror = () => {
      markAsError(`Failed to load background image: ${value}`, element);
    };

    tempImg.src = value;
  }

  function loadHtml(element, value) {
    element.innerHTML = value;
    markAsLoaded(element);
  }

  function loadScript(element, value) {
    try {
      const data = JSON.parse(value);
      const { src, attributes } = data;

      if (!src) {
        markAsError('No src provided in @script data', element);
        return;
      }

      const scriptOptions = {
        src,
        attributes,
        parent: element,
      };

      webManager.dom().loadScript(scriptOptions)
        .then(() => {
          markAsLoaded(element);
        })
        .catch((error) => {
          markAsError(`Failed to load script: ${src} - ${error.message}`, element);
        });

    } catch (error) {
      markAsError(`Failed to parse @script JSON: ${error.message}`, element);
    }
  }

  function loadClass(element, value) {
    // Check if this is an animation class
    const isAnimation = value.includes('animation-');

    // Handle animations specially
    if (isAnimation) {
      // First, add a no-fade class to prevent fade-in animation from the "lazy-loaded" CSS class
      element.classList.add('lazy-loaded-no-fade');

      // Check if page is still loading (set on page load, removed after initial render)
      const isPageLoading = document.documentElement.getAttribute('data-page-loading') === 'true';

      if (isPageLoading) {
        // Check if element is already in viewport
        const rect = element.getBoundingClientRect();
        const isInInitialViewport = rect.top < window.innerHeight && rect.bottom >= 0;

        // Skip animation if element is already visible on initial page load
        if (isInInitialViewport) {
          markAsLoaded(element);
          return;
        }
      }
    }

    // Split value by spaces to support multiple classes
    const classes = value.split(/\s+/).filter(c => c);

    // Normal processing: add the class(es)
    element.classList.add(...classes);
    markAsLoaded(element);
  }

  function markAsLoaded(element) {
    loadedElements.add(element);
    element.classList.remove(config.loadingClass);
    element.classList.add(config.loadedClass);
  }

  function markAsError(error, element) {
    loadedElements.add(element);
    element.classList.remove(config.loadingClass);
    element.classList.add(config.errorClass);

    console.error('Failed to lazy load element', error, element);
  }

  function observeElements() {
    // Find all elements matching our selector
    const elements = document.querySelectorAll(config.selector);

    elements.forEach(element => {
      // Skip if already loaded
      if (loadedElements.has(element)) {
        return;
      }

      // Start observing
      observer.observe(element);
    });
  }

  function setupMutationObserver() {
    // Quit if MutationObserver is not supported
    if (!('MutationObserver' in window)) {
      /* @dev-only:start */
      {
        console.warn('MutationObserver not supported, lazy loading will not update with dynamic content');
      }
      /* @dev-only:end */
      return;
    }

    // Watch for new elements added to the DOM
    const mutationObserver = new MutationObserver(() => {
      // Simply re-scan for new elements matching our selector
      observeElements();
    });

    // Start observing the document body for changes
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function loadAllImages() {
    // Fallback for browsers without IntersectionObserver
    const elements = document.querySelectorAll(config.selector);
    elements.forEach(element => {
      loadElement(element);
    });
  }

};
