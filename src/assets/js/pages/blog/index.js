import { FormManager } from '__main_assets__/js/libs/form-manager.js';

let webManager = null;
let newsletterForm = null;

// Module export
export default (Manager) => {
  return new Promise(async function (resolve) {
    // Shortcuts
    webManager = Manager.webManager;

    // Initialize when DOM is ready
    webManager.dom().ready()
    .then(() => {
      setupNewsletterForm();
      setupSearch();
    });

    // Resolve
    return resolve();
  });
};

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
    allowMultipleSubmit: false,
    resetOnSuccess: true,
    errorContainer: '.newsletter-error-alert',
    successContainer: '.newsletter-success-alert',
    submitButtonLoadingText: 'Subscribing...',
    submitButtonSuccessText: 'Subscribed!',
    fieldErrorClass: 'is-invalid',
    fieldSuccessClass: 'is-valid'
  });

  // Listen to FormManager events
  newsletterForm.addEventListener('submit', handleNewsletterSubmit);
  newsletterForm.addEventListener('validate', handleNewsletterValidation);
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
    // In production, you'd make actual API call here
    newsletterForm.showSuccess('Thank you for subscribing! Check your email to confirm.');
    newsletterForm.setFormState('submitted');
    
    // Track event if analytics is available
    if (window.gtag) {
      window.gtag('event', 'newsletter_signup', {
        event_category: 'engagement',
        event_label: 'blog_page'
      });
    }
    
  } catch (error) {
    console.error('Newsletter subscription error:', error);
    
    let errorMessage = 'An error occurred. Please try again.';
    
    if (error.message?.includes('already')) {
      errorMessage = 'This email is already subscribed.';
    } else if (error.message?.includes('invalid')) {
      errorMessage = 'Please enter a valid email address.';
    }
    
    newsletterForm.showError(errorMessage);
    newsletterForm.setFormState('ready');
  }
}

// Handle newsletter validation
function handleNewsletterValidation(event) {
  const { data, errors } = event.detail;

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!data.email) {
    errors.email = 'Email is required';
  } else if (!emailRegex.test(data.email)) {
    errors.email = 'Please enter a valid email address';
  }
}

// Setup search functionality
function setupSearch() {
  const $searchForm = document.querySelector('form[action*="search"]');
  const $searchInput = $searchForm?.querySelector('input[type="search"]');
  
  if (!$searchForm || !$searchInput) {
    return;
  }

  // Add search tracking
  $searchForm.addEventListener('submit', (e) => {
    const query = $searchInput.value.trim();
    
    if (!query) {
      e.preventDefault();
      $searchInput.focus();
      return;
    }
    
    // Track search event
    if (window.gtag) {
      window.gtag('event', 'search', {
        search_term: query,
        event_category: 'engagement',
        event_label: 'blog_page'
      });
    }
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