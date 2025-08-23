// Libraries
let webManager = null;
import fetch from 'wonderful-fetch';

// Import section modules
import * as profileSection from './sections/profile.js';
import * as notificationsSection from './sections/notifications.js';
import * as securitySection from './sections/security.js';
import * as billingSection from './sections/billing.js';
import * as teamSection from './sections/team.js';
import * as referralsSection from './sections/referrals.js';
import * as apiKeysSection from './sections/api-keys.js';
import * as deleteSection from './sections/delete.js';
import * as connectionsSection from './sections/connections.js';

// DOM Elements
let $navLinks = null;
let $sections = null;

// Shared app data
let appData = null;

// Section modules map
const sectionModules = {
  profile: profileSection,
  notifications: notificationsSection,
  security: securitySection,
  billing: billingSection,
  team: teamSection,
  referrals: referralsSection,
  'api-keys': apiKeysSection,
  delete: deleteSection,
  connections: connectionsSection
};

// Initialize account page
async function initializeAccount() {
  try {
    // Get DOM elements
    $navLinks = document.querySelectorAll('#account-nav .nav-link');
    $sections = document.querySelectorAll('.account-section');

    // Initially hide all sections except loading
    hideAllSectionsExceptLoading();

    // Setup navigation
    setupNavigation();

    // Check if delete hash is present on initial load
    if (window.location.hash === '#delete') {
      showDeleteOption();
    }

    // Initialize all section modules
    Object.values(sectionModules).forEach(module => {
      if (module.init) {
        module.init(webManager);
      }
    });

    // Fetch app data early for all sections to use
    fetchAppData();

    // Setup auth listener with account data
    webManager.auth().listen({ account: true }, async (state) => {
      console.log('Auth state with account data:', state);

      /* @dev-only:start */
      {
        // Check for test subscription parameter
        const urlParams = new URLSearchParams(window.location.search);
        const testSubscription = urlParams.get('_test_subscription');

        if (testSubscription && webManager.isDevelopment()) {
          try {
            console.log(`Loading test subscription: ${testSubscription}`);
            const testModule = await import(`./test-subscriptions/${testSubscription}.js`);

            // Override the account subscription with test data
            if (state.account) {
              state.account.subscription = testModule.default;
              console.log('Test subscription loaded:', testModule.default);
            }
          } catch (error) {
            console.error(`Failed to load test subscription '${testSubscription}':`, error);
          }
        }
      }
      /* @dev-only:end */

      // Load user data with the account information
      if (state.user && state.account) {
        // Wait for app data to be fetched before loading section data
        await ensureAppDataFetched();

        loadAllSectionData(state);

        // Hide loading section and show the appropriate section
        hideLoadingSection();

        // Handle initial hash or show default section
        handleHashChange();
      }
    });

  } catch (error) {
    console.error('Failed to initialize account page:', error);
  }
}

// Fetch app data to get configuration and OAuth settings
let fetchAppDataPromise = null;
async function fetchAppData() {
  if (fetchAppDataPromise) return fetchAppDataPromise;

  fetchAppDataPromise = (async () => {
    try {
      // Get app ID from site configuration
      const appId = webManager.config.brand.id;

      // Get API base URL
      // const apiBaseUrl = webManager.isDevelopment()
      //   ? 'http://localhost:5002'
      //   : 'https://api.itwcreativeworks.com';
      const apiBaseUrl = 'https://api.itwcreativeworks.com';

      // Fetch app data
      const response = await fetch(`${apiBaseUrl}/get-app`, {
        response: 'json',
        query: {
          id: appId,
        }
      });

      console.log('Fetched app data:', response);
      appData = response;

      return response;
    } catch (error) {
      console.error('Failed to fetch app data:', error);
      return null;
    }
  })();

  return fetchAppDataPromise;
}

// Ensure app data is fetched
async function ensureAppDataFetched() {
  if (!appData) {
    await fetchAppData();
  }
  return appData;
}

// Load data for all sections
function loadAllSectionData(authState) {
  const { user, account } = authState;

  // Load data for each section (passing app data where needed)
  if (sectionModules.profile.loadData) {
    sectionModules.profile.loadData(account, user);
  }

  if (sectionModules.notifications.loadData) {
    sectionModules.notifications.loadData(account);
  }

  if (sectionModules.security.loadData) {
    sectionModules.security.loadData(account);
  }

  if (sectionModules.billing.loadData) {
    sectionModules.billing.loadData(account, appData);
  }

  if (sectionModules.team && sectionModules.team.loadData) {
    sectionModules.team.loadData(account);
  }

  if (sectionModules.referrals && sectionModules.referrals.loadData) {
    sectionModules.referrals.loadData(account);
  }

  if (sectionModules['api-keys'] && sectionModules['api-keys'].loadData) {
    sectionModules['api-keys'].loadData(account);
  }

  if (sectionModules.delete.loadData) {
    sectionModules.delete.loadData(account);
  }

  if (sectionModules.connections.loadData) {
    sectionModules.connections.loadData(account, appData);
  }
}

// Setup navigation between sections
function setupNavigation() {
  // Add click listeners to nav links
  $navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const sectionId = link.dataset.section;
      showSection(sectionId);

      // Update URL hash
      window.location.hash = sectionId;
    });
  });

  // Setup mobile dropdown navigation
  const $mobileNavSelect = document.getElementById('mobile-nav-select');
  if ($mobileNavSelect) {
    $mobileNavSelect.addEventListener('change', (e) => {
      const sectionId = e.target.value;
      showSection(sectionId);
      window.location.hash = sectionId;
    });
  }

  // Listen for hash changes
  window.addEventListener('hashchange', handleHashChange);
}

// Handle hash changes
function handleHashChange() {
  const hash = window.location.hash.slice(1);

  // Show delete nav item and mobile option if hash is delete
  if (hash === 'delete') {
    showDeleteOption();
  }

  if (hash) {
    // Check if the section exists
    const $targetSection = document.getElementById(`${hash}-section`);
    if ($targetSection) {
      showSection(hash);
    } else {
      // Section doesn't exist, default to profile
      console.warn(`Section "${hash}" not found, defaulting to profile`);
      window.location.hash = '#profile';
      showSection('profile');
    }
  } else {
    // No hash, show profile by default
    showSection('profile');
  }
}

// Show delete option in navigation
function showDeleteOption() {
  // Show desktop nav item
  const $deleteNavItem = document.getElementById('delete-nav-item');
  if ($deleteNavItem) {
    $deleteNavItem.classList.remove('d-none');
  }

  // Add mobile dropdown option if not exists
  const $mobileNavSelect = document.getElementById('mobile-nav-select');
  if ($mobileNavSelect) {
    const deleteOption = $mobileNavSelect.querySelector('option[value="delete"]');
    if (!deleteOption) {
      const option = document.createElement('option');
      option.value = 'delete';
      option.textContent = 'Delete Account';
      option.className = 'text-danger';
      $mobileNavSelect.appendChild(option);
    }
  }
}


// Hide all sections except loading
function hideAllSectionsExceptLoading() {
  $sections.forEach(section => {
    if (section.id !== 'loading-section') {
      section.classList.add('d-none');
    }
  });
}

// Hide loading section
function hideLoadingSection() {
  const $loadingSection = document.getElementById('loading-section');
  if ($loadingSection) {
    $loadingSection.classList.add('d-none');
  }
}

// Show specific section
function showSection(sectionId) {
  // Don't show sections while loading
  const $loadingSection = document.getElementById('loading-section');
  if ($loadingSection && !$loadingSection.classList.contains('d-none')) {
    // Still loading, don't switch sections yet
    return;
  }

  // Hide all sections
  $sections.forEach(section => {
    section.classList.add('d-none');
  });

  // Show selected section
  const $targetSection = document.getElementById(`${sectionId}-section`);
  if ($targetSection) {
    $targetSection.classList.remove('d-none');
  }

  // Update nav active state
  $navLinks.forEach(link => {
    if (link.dataset.section === sectionId) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Update mobile dropdown to match
  const $mobileNavSelect = document.getElementById('mobile-nav-select');
  if ($mobileNavSelect) {
    $mobileNavSelect.value = sectionId;
  }

  // Call section's onShow method if it exists
  const sectionModule = sectionModules[sectionId];
  if (sectionModule && sectionModule.onShow) {
    sectionModule.onShow();
  }
}

// Module export
export default (Manager) => {
  return new Promise(async function (resolve) {
    // Shortcuts
    webManager = Manager.webManager;

    // Initialize when DOM is ready
    webManager.dom().ready()
    .then(() => {
      // Initialize account page
      initializeAccount();
    });

    // Resolve
    return resolve();
  });
};
