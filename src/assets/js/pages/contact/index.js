// Libraries
import { FormManager } from '__main_assets__/js/libs/form-manager.js';
import fetch from 'wonderful-fetch';
let webManager = null;

// Module
export default (Manager) => {
  return new Promise(async function (resolve) {
    // Shortcuts
    webManager = Manager.webManager;

    // Initialize when DOM is ready
    await webManager.dom().ready();
    
    setupForm();
    
    // Resolve after initialization
    return resolve();
  });
};

// Global variables
let formManager = null;

// Setup form handling
function setupForm() {
  // Initialize FormManager with proper configuration
  formManager = new FormManager('#contact-form', {
    autoDisable: true,
    showSpinner: true,
    validateOnSubmit: true,
    allowMultipleSubmit: false,
    resetOnSuccess: true,
    errorContainer: '.contact-error-alert',
    successContainer: '.contact-success-alert',
    submitButtonLoadingText: 'Sending...',
    submitButtonSuccessText: 'Message Sent!',
    fieldErrorClass: 'is-invalid',
    fieldSuccessClass: 'is-valid'
  });

  // Listen to FormManager events
  formManager.addEventListener('submit', handleFormSubmit);
  formManager.addEventListener('validate', handleValidation);
  formManager.addEventListener('change', handleFieldChange);

  // Setup smooth scroll to form
  setupFormScrolling();
}

// Setup smooth scrolling to form and chat handler
function setupFormScrolling() {
  // Find all contact method links
  const $contactLinks = document.querySelectorAll('a[href="#form"], a[href="#chat"]');

  $contactLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();

      const href = link.getAttribute('href');

      if (href === '#chat') {
        trackChatClick();

        // Open chat window
        try {
          window.chatsy.open();
        } catch (error) {
          webManager.sentry().captureException(new Error('Error opening chat', { cause: error }));
          webManager.utilities().showNotification('Chat is currently unavailable. Please try again later.', 'danger');
        }
      } else if (href === '#form') {
        trackFormClick();
        
        // Find the form section by ID
        const $formSection = document.getElementById('form');

        if ($formSection) {
          // Smooth scroll to the form section
          $formSection.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });

          // After scrolling, focus the first visible input field
          setTimeout(() => {
            // Find the first visible, enabled input field (first_name)
            const firstInput = document.querySelector('#contact-form input:not([type="hidden"]):not([readonly]):not([disabled])');
            if (firstInput) {
              firstInput.focus();
              // Also select the text for better UX
              if (firstInput.select) {
                firstInput.select();
              }
            }
          }, 600); // Slightly longer delay to ensure scroll completes
        }
      }
    });
  });
}

// Handle form submission event from FormManager
async function handleFormSubmit(event) {
  // Prevent default FormManager submission
  event.preventDefault();

  const formData = event.detail.data;
  const slapformId = webManager.config.brand.contact['slapform-form-id'];

  console.log('Contact form submission:', formData);

  // Check honeypot field (anti-spam)
  if (formData.url_check) {
    console.warn('Honeypot field filled - potential spam');
    trackContactSpam();
    formManager.setFormState('ready');
    return;
  }

  // Check if slapformId is missing
  if (!slapformId) {
    webManager.sentry().captureException(new Error('Contact form is not configured - missing slapform ID'));
    formManager.showError('Contact form is not configured properly. Please try again later.');
    formManager.setFormState('ready');
    return;
  }

  trackContactFormSubmit(formData.subject || 'general');

  try {
    // Prepare data for API
    const requestData = {
      first_name: formData.first_name,
      last_name: formData.last_name,
      email: formData.email,
      company: formData.company || '',
      subject: formData.subject,
      message: formData.message,
    };

    // Get API endpoint from site config or use default
    const apiEndpoint = `https://api.slapform.com/${slapformId}`;

    // Send request using wonderful-fetch
    await fetch(apiEndpoint, {
      method: 'POST',
      body: requestData,
      response: 'json',
      timeout: 30000 // 30 second timeout
    });

    // Handle successful response
    formManager.showSuccess('Thank you for your message! We\'ll get back to you within 24 hours.');
    formManager.setFormState('submitted');
  } catch (error) {
    // Only capture technical errors to Sentry (network, timeout, API errors)
    if (error.message?.includes('network') || error.message?.includes('timeout') || !error.message?.includes('Failed')) {
      webManager.sentry().captureException(new Error('Contact form submission error', { cause: error }));
    }

    // Show user-friendly error message
    let errorMessage = 'An error occurred while sending your message. ';

    if (error.message?.includes('network')) {
      errorMessage += 'Please check your internet connection and try again.';
    } else if (error.message?.includes('timeout')) {
      errorMessage += 'The request timed out. Please try again.';
    } else if (error.message?.includes('Failed')) {
      errorMessage = error.message;
    } else {
      errorMessage += 'Please try again or contact us directly.';
    }

    formManager.showError(errorMessage);
    formManager.setFormState('ready');
  }
}

// Handle custom validation
function handleValidation(event) {
  const { data, errors } = event.detail;

  // Validate email format
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'Please enter a valid email address';
  }

  // Validate message length
  if (data.message && data.message.trim().length < 10) {
    errors.message = 'Message must be at least 10 characters long';
  }

  // Validate first and last name length
  if (data.first_name && data.first_name.trim().length < 2) {
    errors.first_name = 'First name must be at least 2 characters';
  }

  if (data.last_name && data.last_name.trim().length < 2) {
    errors.last_name = 'Last name must be at least 2 characters';
  }

  // Check if subject is selected
  if (!data.subject || data.subject === '') {
    errors.subject = 'Please select a subject';
  }
}

// Handle field changes
function handleFieldChange(event) {
  const { field, fieldName } = event.detail;

  // Clear field-specific error message if it exists
  if (field.dataset.invalidField) {
    const $feedback = field.parentElement.querySelector('.invalid-feedback');
    if ($feedback) {
      $feedback.textContent = '';
    }
  }
}

// Tracking functions
function trackChatClick() {
  gtag('event', 'contact_method_click', {
    method: 'chat'
  });
  fbq('track', 'Contact', {
    content_name: 'Chat'
  });
  ttq.track('ClickButton', {
    content_name: 'Chat'
  });
}

function trackFormClick() {
  gtag('event', 'contact_method_click', {
    method: 'form'
  });
  fbq('track', 'Contact', {
    content_name: 'Form'
  });
  ttq.track('ClickButton', {
    content_name: 'Contact Form'
  });
}

function trackContactSpam() {
  gtag('event', 'contact_form_spam', {
    content_type: 'honeypot'
  });
}

function trackContactFormSubmit(subject) {
  gtag('event', 'contact_form_submit', {
    subject: subject
  });
  fbq('track', 'Lead', {
    content_name: 'Contact Form',
    content_category: subject
  });
  ttq.track('FormSubmit', {
    content_name: 'Contact Form',
    content_type: subject
  });
}