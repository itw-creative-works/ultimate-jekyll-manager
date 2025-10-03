// Libraries
let webManager = null;

// Module
export default (Manager) => {
  return new Promise(async function (resolve) {
    // Shortcuts
    webManager = Manager.webManager;

    // Initialize when DOM is ready
    await webManager.dom().ready();

    try {
      // Initialize iframe resizing
      initializeIframeResize();

      // Initialize admin navigation
      await initializeAdminNavigation();
    } catch (error) {
      webManager.sentry().captureException(new Error('Failed to initialize admin panel', { cause: error }));
    }

    // Resolve after initialization
    return resolve();
  });
};

// Global variables
let $iframe = null;
let $sidebar = null;
let lastClickedExternalUrl = null;
let isNavigatingFromHash = false;

// Initialize iframe dynamic resizing
function initializeIframeResize() {
  function resizeIframe() {
    const $container = document.querySelector('.admin-iframe-container');
    const $pageHeader = document.querySelector('.page-header');
    const $mainContent = document.querySelector('#main-content');

    if (!$container) {
      return;
    }

    // Get the actual position of the iframe container
    const containerRect = $container.getBoundingClientRect();
    const topPosition = containerRect.top + window.scrollY;

    // Account for current position from top and main content padding
    const mainPadding = $mainContent ? parseInt(window.getComputedStyle($mainContent).paddingBottom) : 0;

    // Calculate available height
    const availableHeight = window.innerHeight - topPosition - mainPadding;

    // Set the iframe container height and as important to override any inline styles
    // $container.style.height = availableHeight + 'px';
    $container.style.setProperty('height', availableHeight + 'px', 'important');
  }

  // Initial resize after a small delay to ensure layout is complete
  setTimeout(resizeIframe, 50);

  // Resize on window resize
  window.addEventListener('resize', resizeIframe);
}

// Initialize admin navigation system
async function initializeAdminNavigation() {
  // Get DOM elements
  $iframe = document.getElementById('admin-content-frame');
  $sidebar = document.querySelector('.sidebar');

  if (!$iframe) {
    console.warn('[Admin] No iframe found');
    return;
  }

  // Set up iframe load listener
  $iframe.addEventListener('load', handleIframeLoad);

  // Set up sidebar link handlers
  setupSidebarLinkHandlers();

  // Check for hash on page load and navigate if present
  navigateToHash();

  // Listen for hash changes
  window.addEventListener('hashchange', function() {
    console.log('[Admin] Hash changed to:', window.location.hash);
    navigateToHash();
  });

  // Listen for messages from iframe
  window.addEventListener('message', handleIframeMessage);

  // Initial active state
  updateSidebarActive($iframe.src);
}

// Handle iframe load events
function handleIframeLoad() {
  console.log('[Admin] Iframe loaded, checking URL...');

  try {
    // Try to get the actual URL (will fail for cross-origin)
    const iframeUrl = $iframe.contentWindow.location.href;
    updateSidebarActive(iframeUrl);
  } catch (e) {
    // Cross-origin restriction - external site or different domain
    handleCrossOriginIframe();
  }
}

// Handle cross-origin iframe scenarios
function handleCrossOriginIframe() {
  // Update header for external site
  const $breadcrumbEl = document.getElementById('admin-page-breadcrumb');
  const $titleEl = document.getElementById('admin-page-title');

  if (lastClickedExternalUrl) {
    // Try to extract a reasonable name from the URL
    try {
      const url = new URL(lastClickedExternalUrl);
      const siteName = url.hostname.replace('www.', '').split('.')[0];
      const formattedName = siteName.charAt(0).toUpperCase() + siteName.slice(1);

      if ($breadcrumbEl) $breadcrumbEl.textContent = formattedName;
      if ($titleEl) $titleEl.textContent = formattedName;
    } catch (e) {
      if ($breadcrumbEl) $breadcrumbEl.textContent = 'External';
      if ($titleEl) $titleEl.textContent = 'External';
    }
  }

  // Update sidebar active state for external URL
  const urlToMatch = lastClickedExternalUrl || $iframe.src;

  if (!$sidebar) return;

  // Clear all active states first
  const $allLinks = $sidebar.querySelectorAll('a[href]');
  $allLinks.forEach(link => {
    link.classList.remove('active');
  });

  // Find and activate the matching external link
  if (urlToMatch) {
    $allLinks.forEach(link => {
      const linkHref = link.getAttribute('href');

      // Match against the tracked external URL
      if (linkHref && linkHref === urlToMatch) {
        link.classList.add('active');

        // Also activate parent elements if nested
        const $parentNavItem = link.closest('.nav-item');
        if ($parentNavItem) {
          $parentNavItem.classList.add('active');
        }

        // If it's in a dropdown, activate the parent toggle
        const $parentDropdown = link.closest('.dropdown');
        if ($parentDropdown) {
          const $dropdownToggle = $parentDropdown.querySelector('.nav-link');
          if ($dropdownToggle) {
            $dropdownToggle.classList.add('active');
          }
        }
      }
    });
  }
}

// Update sidebar active state based on iframe URL
function updateSidebarActive(iframeUrl) {
  if (!$sidebar) {
    return;
  }

  // Parse the URL to get the path
  let iframePath;
  try {
    const url = new URL(iframeUrl);
    iframePath = url.pathname;
  } catch (e) {
    return;
  }

  // Find ALL links in the sidebar
  const $allLinks = $sidebar.querySelectorAll('a[href]');

  // Remove active from all links
  $allLinks.forEach(link => {
    link.classList.remove('active');
  });

  // Also remove active from all nav-items
  const $allNavItems = $sidebar.querySelectorAll('.nav-item');
  $allNavItems.forEach(item => {
    item.classList.remove('active');
  });

  // Find and activate matching link
  $allLinks.forEach(link => {
    const linkHref = link.getAttribute('href');

    if (!linkHref) {
      return;
    }

    // Normalize paths for comparison (remove trailing slashes)
    const normalizedLinkPath = linkHref.replace(/\/$/, '');
    const normalizedIframePath = iframePath.replace(/\/$/, '');

    // Check for exact match
    if (normalizedIframePath === normalizedLinkPath) {
      link.classList.add('active');

      // Also activate parent nav-item if it's a nested link
      const $parentNavItem = link.closest('.nav-item');
      if ($parentNavItem) {
        $parentNavItem.classList.add('active');
      }

      // If link is inside a collapsible section, expand it
      const $parentCollapse = link.closest('.collapse');
      if ($parentCollapse) {
        // Add show class to expand the collapse
        $parentCollapse.classList.add('show');

        // Find and update the toggle button
        const collapseId = $parentCollapse.id;
        const $collapseToggle = $sidebar ? $sidebar.querySelector(`[data-bs-target="#${collapseId}"]`) : null;
        if ($collapseToggle) {
          $collapseToggle.classList.remove('collapsed');
          $collapseToggle.setAttribute('aria-expanded', 'true');
        }
      }

      // If link is inside a dropdown menu, activate and expand parent dropdown
      const $parentDropdownMenu = link.closest('.dropdown-menu');
      if ($parentDropdownMenu) {
        // Show the dropdown menu
        $parentDropdownMenu.classList.add('show');

        // Find the parent dropdown container
        const $parentDropdown = $parentDropdownMenu.closest('.dropdown');
        if ($parentDropdown) {
          // Find and activate the dropdown toggle (direct child only)
          const $dropdownToggle = $parentDropdown.querySelector(':scope > .nav-link[data-bs-toggle="dropdown"]');
          if ($dropdownToggle) {
            $dropdownToggle.classList.add('active');
            $dropdownToggle.setAttribute('aria-expanded', 'true');
          }
        }
      }
    }
  });
}

// Handle sidebar link clicks
function handleSidebarLink(e) {
  const $link = e.currentTarget;
  const href = $link.getAttribute('href');
  const target = $link.getAttribute('target');

  if (!href) return;

  // Analyze link type
  const isExternalLink = href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//');
  const isAdminLink = !isExternalLink && (href.includes('/admin') || href.includes('admin'));

  console.log('[Admin] Link clicked:', {
    href: href,
    isExternal: isExternalLink,
    isAdmin: isAdminLink,
    target: target
  });

  // Determine action based on link type and target
  let action = 'parent'; // default

  if (isAdminLink) {
    action = 'iframe';
  } else if (isExternalLink) {
    if (target === '_self') {
      action = 'iframe';
    } else if (target === '_blank') {
      action = 'new-tab';
    } else if (target === '_parent' || !target) {
      action = 'parent';
    }
  } else {
    // Internal non-admin links
    action = 'parent';
  }

  // Execute action
  switch (action) {
    case 'iframe':
      e.preventDefault();
      e.stopPropagation();

      console.log('[Admin] Loading in iframe:', href);

      // Track if this is an external URL
      if (isExternalLink) {
        lastClickedExternalUrl = href;
      } else {
        lastClickedExternalUrl = null;
      }

      $iframe.src = href;

      // Update URL hash for admin links (but not if we're navigating from hash)
      if (isAdminLink && !isNavigatingFromHash) {
        // Extract the path after /admin/
        const adminPath = href.replace(/^.*\/admin\//, '').replace(/\/$/, '');
        if (adminPath && adminPath !== 'admin') {
          window.location.hash = adminPath;
          console.log('[Admin] Updated URL hash to:', adminPath);
        } else {
          window.location.hash = '';
        }
      }

      // Update active state
      updateSidebarActive(href);

      // Don't close dropdowns/collapses if the clicked link is inside one
      // This keeps them open for nested navigation
      const $clickedDropdownMenu = $link.closest('.dropdown-menu');
      const $clickedCollapse = $link.closest('.collapse');

      if (!$clickedDropdownMenu) {
        // Close any open dropdowns only if we're not clicking inside one
        const $openDropdowns = $sidebar.querySelectorAll('.dropdown-menu.show');
        $openDropdowns.forEach(dropdown => {
          dropdown.classList.remove('show');
          const $toggle = dropdown.previousElementSibling;
          if ($toggle) $toggle.setAttribute('aria-expanded', 'false');
        });
      }

      // Note: We intentionally don't close collapse sections automatically
      // as they typically stay open for navigation purposes

      // Collapse mobile sidebar if open (but only if it's the mobile menu, not a regular collapse)
      if (window.innerWidth < 768) {
        const $mobileSidebar = $sidebar ? $sidebar.querySelector('.navbar-collapse.show') : null;
        if ($mobileSidebar) {
          $mobileSidebar.classList.remove('show');
        }
      }

      break;

    case 'new-tab':
      // Let default behavior handle it
      console.log('[Admin] Opening in new tab:', href);
      break;

    case 'parent':
      // Let default behavior handle it
      console.log('[Admin] Navigating parent window to:', href);
      break;
  }
}

// Set up sidebar link handlers
function setupSidebarLinkHandlers() {
  if (!$sidebar) return;

  const $sidebarLinks = $sidebar.querySelectorAll('a[href]');

  $sidebarLinks.forEach(link => {
    // Remove any existing click handlers by cloning
    const $newLink = link.cloneNode(true);
    link.parentNode.replaceChild($newLink, link);

    // Add our handler
    $newLink.addEventListener('click', handleSidebarLink, true);
  });
}

// Navigate to hash location
function navigateToHash() {
  const hash = window.location.hash.slice(1); // Remove the #
  if (hash) {
    console.log('[Admin] Hash detected:', hash);

    // Build the full admin URL
    const adminPath = '/admin/' + hash;
    // Get base URL from current page
    const baseUrl = window.location.pathname.replace(/\/admin.*$/, '');
    const fullPath = baseUrl + adminPath;

    // Find the matching sidebar link
    const $sidebarLinks = $sidebar ? $sidebar.querySelectorAll('a[href]') : [];
    let $targetLink = null;

    $sidebarLinks.forEach(link => {
      const linkHref = link.getAttribute('href');
      if (linkHref && linkHref.replace(/\/$/, '') === fullPath.replace(/\/$/, '')) {
        $targetLink = link;
      }
    });

    if ($targetLink) {
      console.log('[Admin] Found matching link for hash, triggering click:', fullPath);

      // Check if the link is inside a collapsible section
      const $parentCollapse = $targetLink.closest('.collapse');
      if ($parentCollapse) {
        // Find the toggle button for this collapse
        const collapseId = $parentCollapse.id;
        const $collapseToggle = $sidebar ? $sidebar.querySelector(`[data-bs-target="#${collapseId}"]`) : null;

        if ($collapseToggle && !$parentCollapse.classList.contains('show')) {
          console.log('[Admin] Opening collapse section before clicking nested link');
          // Click the toggle to expand the collapse
          $collapseToggle.click();
        }
      }

      // Click the link immediately
      isNavigatingFromHash = true;
      $targetLink.click();
      isNavigatingFromHash = false;
    } else {
      // No matching link found, just load the URL directly
      console.log('[Admin] No matching sidebar link found, loading URL directly:', fullPath);
      $iframe.src = fullPath;
      updateSidebarActive(fullPath);
    }
  } else {
    // No hash, default to dashboard
    updateSidebarActive($iframe.src);
  }
}

// Handle messages from iframe
function handleIframeMessage(event) {
  console.log('[Admin] Received message:', event?.data?.command, event.data);

  // Ignore messages without our prefix
  if (!event.data || typeof event.data.command !== 'string' || !event.data.command.startsWith('uj:admin:')) {
    return;
  }

  // Handle iframe navigation messages
  if (event.data.command === 'uj:admin:iframe-navigation' && event.data.payload) {
    // Update sidebar active state
    updateSidebarActive(event.data.payload.url);

    // Update URL hash based on iframe navigation
    try {
      const iframeUrl = new URL(event.data.payload.url);
      const iframePath = iframeUrl.pathname;

      // If it's an admin path, update the hash
      if (iframePath.includes('/admin/')) {
        const adminPath = iframePath.replace(/^.*\/admin\//, '').replace(/\/$/, '');
        if (adminPath && adminPath !== 'admin') {
          window.location.hash = adminPath;
          console.log('[Admin] Updated URL hash from iframe navigation to:', adminPath);
        } else if (iframePath.endsWith('/admin') || iframePath.endsWith('/admin/')) {
          window.location.hash = '';
        }
      }
    } catch (e) {
      console.error('[Admin] Error parsing iframe navigation URL:', e);
    }

    // Update page title and breadcrumb if meta info is provided
    if (event.data.payload.meta) {
      const meta = event.data.payload.meta;

      // Update the breadcrumb text
      const $breadcrumbEl = document.getElementById('admin-page-breadcrumb');
      if ($breadcrumbEl && meta.breadcrumb) {
        $breadcrumbEl.textContent = meta.breadcrumb;
      }

      // Optionally also update the title
      const $titleEl = document.getElementById('admin-page-title');
      if ($titleEl && meta.breadcrumb) {
        $titleEl.textContent = meta.breadcrumb;
      }
    }
  }
}
