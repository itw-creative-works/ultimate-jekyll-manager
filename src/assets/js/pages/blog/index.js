// Libraries
import { FormManager } from '__main_assets__/js/libs/form-manager.js';
let webManager = null;

// Module
export default (Manager) => {
  return new Promise(async function (resolve) {
    // Shortcuts
    webManager = Manager.webManager;

    // Initialize when DOM is ready
    await webManager.dom().ready();

    setupNewsletterForm();
    setupSearch();

    // Resolve after initialization
    return resolve();
  });
};

// Global variables
let newsletterForm = null;

// Setup newsletter form
function setupNewsletterForm() {
  const $form = document.getElementById('newsletter-form');

  if (!$form) {
    return;
  }

  // Initialize FormManager
  newsletterForm = new FormManager('#newsletter-form', {
    autoDisable: true,
    showSpinner: true,
    validateOnSubmit: true,
    allowMultipleSubmissions: false,
    resetOnSuccess: true,
    submitButtonLoadingText: 'Subscribing...',
    submitButtonSuccessText: 'Subscribed!',
    fieldErrorClass: 'is-invalid',
    fieldSuccessClass: 'is-valid'
  });

  // Listen to FormManager events
  newsletterForm.addEventListener('submit', handleNewsletterSubmit);
}

// Setup blog search functionality
function setupSearch() {
  const $searchInput = document.getElementById('blog-search');
  const $searchResults = document.getElementById('search-results');
  const $blogPosts = document.querySelectorAll('.blog-post');

  if (!$searchInput || !$searchResults || !$blogPosts.length) {
    return;
  }

  let searchTimeout;

  // Handle search input
  $searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim().toLowerCase();

    if (query.length === 0) {
      // Reset if empty
      $searchResults.classList.add('d-none');
      $blogPosts.forEach(post => {
        post.classList.remove('d-none');
      });
      return;
    }

    // Debounce search
    searchTimeout = setTimeout(() => {
      performSearch(query, $blogPosts, $searchResults);
    }, 300);
  });

  // Add keyboard shortcut (Ctrl/Cmd + K)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      $searchInput.focus();
      $searchInput.select();
    }
  });
}

// Perform search on blog posts
function performSearch(query, $blogPosts, $searchResults) {
  let matchCount = 0;
  const results = [];

  $blogPosts.forEach(post => {
    const title = post.dataset.title?.toLowerCase() || '';
    const excerpt = post.dataset.excerpt?.toLowerCase() || '';
    const tags = post.dataset.tags?.toLowerCase() || '';

    if (title.includes(query) || excerpt.includes(query) || tags.includes(query)) {
      post.classList.remove('d-none');
      matchCount++;
      results.push({
        title: post.dataset.title,
        url: post.querySelector('a')?.href
      });
    } else {
      post.classList.add('d-none');
    }
  });

  // Update results message
  if (matchCount === 0) {
    $searchResults.innerHTML = '<p class="text-muted">No posts found matching your search.</p>';
  } else {
    $searchResults.innerHTML = `<p class="text-muted">Found ${matchCount} post${matchCount !== 1 ? 's' : ''} matching "${query}"</p>`;
  }

  $searchResults.classList.remove('d-none');

  // Track search
  trackBlogSearch(query);
}

// Handle newsletter form submission
async function handleNewsletterSubmit(event) {
  // Prevent default FormManager submission
  event.preventDefault();

  const formData = event.detail.data;

  console.log('Newsletter subscription:', formData.email);

  try {
    // Here you would integrate with your newsletter service
    // For example: Mailchimp, SendGrid, ConvertKit, etc.

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    // For demo purposes, just show success
    trackNewsletterSignup();
    newsletterForm.showSuccess('Thank you for subscribing! Check your email to confirm.');
    newsletterForm.setFormState('submitted');
  } catch (error) {
    webManager.sentry().captureException(new Error('Newsletter subscription failed', { cause: error }));
    newsletterForm.showError('An error occurred. Please try again.');
    newsletterForm.setFormState('ready');
  }
}

// Tracking functions
function trackNewsletterSignup() {
  gtag('event', 'newsletter_signup', {
    event_category: 'engagement',
    event_label: 'blog_page',
    value: 1
  });
  fbq('track', 'CompleteRegistration', {
    content_name: 'Newsletter',
    status: 'success'
  });
  ttq.track('Subscribe', {
    content_name: 'Newsletter',
    status: 'success'
  });
}

function trackBlogSearch(query) {
  gtag('event', 'search', {
    search_term: query,
    event_category: 'engagement',
    event_label: 'blog_page'
  });
  fbq('track', 'Search', {
    search_string: query,
    content_category: 'blog'
  });
  ttq.track('Search', {
    query: query,
    content_type: 'blog'
  });
}
