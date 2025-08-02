/**
 * Form Manager Library
 * A comprehensive form management system that handles state, validation, submission, and UI updates
 */

export class FormManager extends EventTarget {
  constructor(selector, options = {}) {
    super();

    // Configuration with defaults
    this.config = {
      autoDisable: true, // Auto disable/enable form controls
      showSpinner: true, // Show spinner on submit buttons
      validateOnSubmit: true, // Validate before submission
      allowMultipleSubmit: false, // Allow multiple submissions
      resetOnSuccess: false, // Reset form after successful submission
      errorContainer: null, // Selector for error container
      successContainer: null, // Selector for success container
      spinnerHTML: '<span class="spinner-border spinner-border-sm me-2"></span>',
      submitButtonLoadingText: 'Processing...',
      fieldErrorClass: 'is-invalid',
      fieldSuccessClass: 'is-valid',
      ...options
    };

    // Get form element
    this.form = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!this.form) {
      throw new Error(`Form not found: ${selector}`);
    }

    // State management
    this.state = {
      status: 'loading', // loading, ready, submitting, submitted
      isValid: true,
      errors: {},
      data: {},
      isDirty: false
    };

    // Store original button states
    this.originalButtonStates = new Map();

    // Initialize
    this.init();
  }

  /**
   * Initialize the form manager
   */
  init() {
    // Store original button states BEFORE setting loading state
    this.form.querySelectorAll('button').forEach(button => {
      this.originalButtonStates.set(button, {
        innerHTML: button.innerHTML,
        disabled: button.disabled
      });
    });

    // Track which submit button was clicked
    this.clickedSubmitButton = null;

    // Set initial loading state
    this.setFormState('loading');

    // Attach event listeners
    this.attachEventListeners();

    // Set ready state when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setFormState('ready'));
    } else {
      // Use setTimeout to ensure any parent initialization completes
      setTimeout(() => this.setFormState('ready'), 0);
    }
  }

  /**
   * Attach all event listeners
   */
  attachEventListeners() {
    // Form submit
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));

    // Unified input changes - capture all user interactions
    const inputEvents = ['input', 'change', 'paste', 'cut', 'keyup'];
    const changeHandler = (e) => this.handleChange(e);

    // Attach to all form inputs
    this.form.querySelectorAll('input, select, textarea').forEach(element => {
      inputEvents.forEach(eventType => {
        element.addEventListener(eventType, changeHandler);
      });
    });

    // Button clicks (for non-submit buttons)
    this.form.querySelectorAll('button[type="button"]').forEach(button => {
      button.addEventListener('click', (e) => this.handleButtonClick(e));
    });

    // Track submit button clicks
    this.form.querySelectorAll('button[type="submit"]').forEach(button => {
      button.addEventListener('click', (e) => {
        this.clickedSubmitButton = e.currentTarget;
      });
    });
  }

  /**
   * Handle form submission
   */
  async handleSubmit(e) {
    e.preventDefault();

    // Check if already submitting
    if (this.state.status === 'submitting' && !this.config.allowMultipleSubmit) {
      return;
    }

    // Clear any existing errors
    this.clearErrors();

    // Collect form data
    const formData = this.collectFormData();

    // Validate if enabled
    if (this.config.validateOnSubmit) {
      const validation = this.validate(formData);
      if (!validation.isValid) {
        this.showErrors(validation.errors);
        return;
      }
    }

    // Set submitting state
    this.setFormState('submitting');

    // Emit submit event with the clicked submit button
    const submitEvent = new CustomEvent('submit', {
      detail: { 
        data: formData, 
        form: this.form,
        submitButton: this.clickedSubmitButton
      },
      cancelable: true
    });

    this.dispatchEvent(submitEvent);

    // Reset clicked button after dispatching event
    this.clickedSubmitButton = null;

    // If event was not cancelled, handle default submission
    if (!submitEvent.defaultPrevented) {
      try {
        // Default submission (can be overridden by listening to submit event)
        await this.defaultSubmitHandler(formData);

        // Success
        this.setFormState('submitted');
        this.dispatchEvent(new CustomEvent('success', {
          detail: { data: formData }
        }));

        // Reset form if configured
        if (this.config.resetOnSuccess) {
          this.reset();
        }
      } catch (error) {
        // Error
        this.setFormState('ready');
        this.showError(error.message);
        this.dispatchEvent(new CustomEvent('error', {
          detail: { error, data: formData }
        }));
      }
    }
  }

  /**
   * Default submit handler (can be overridden)
   */
  async defaultSubmitHandler(data) {
    // Default implementation - just log
    console.log('Form submitted with data:', data);
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * Handle input changes with debouncing
   */
  handleChange(e) {
    const field = e.target;

    // Clear any existing timeout for this field
    if (this.changeTimeouts) {
      clearTimeout(this.changeTimeouts.get(field));
    } else {
      this.changeTimeouts = new Map();
    }

    // Set a new timeout to capture the final value
    this.changeTimeouts.set(field, setTimeout(() => {
      this.state.isDirty = true;

      // Collect all form data after the change
      const data = this.collectFormData();

      // Get the specific field value
      const fieldValue = this.getFieldValue(field);

      // Emit the unified change event
      this.dispatchEvent(new CustomEvent('change', {
        detail: {
          field: field,
          fieldName: field.name,
          fieldValue: fieldValue,
          data: data,
          event: e
        }
      }));

      // Clean up the timeout reference
      this.changeTimeouts.delete(field);
    }, 1)); // 100ms delay to ensure we capture the final value
  }

  /**
   * Handle non-submit button clicks
   */
  handleButtonClick(e) {
    const button = e.currentTarget;
    const action = button.getAttribute('data-action') || button.id;

    this.dispatchEvent(new CustomEvent('button', {
      detail: {
        button,
        action,
        data: this.collectFormData()
      }
    }));
  }

  /**
   * Set form state and update UI accordingly
   */
  setFormState(status) {
    const previousStatus = this.state.status;
    this.state.status = status;
    
    // Update form data attribute
    this.form.setAttribute('data-form-state', status);

    switch (status) {
      case 'loading':
        this.disableForm();
        break;

      case 'ready':
        this.enableForm();
        this.hideSubmittingState();
        break;

      case 'submitting':
        this.disableForm();
        this.showSubmittingState();
        break;

      case 'submitted':
        // Keep form disabled after submission by default
        if (!this.config.resetOnSuccess) {
          this.disableForm();
        }
        this.hideSubmittingState();
        break;
    }

    // Emit state change event
    this.dispatchEvent(new CustomEvent('statechange', {
      detail: {
        status,
        previousStatus
      }
    }));
  }

  /**
   * Disable all form controls
   */
  disableForm() {
    if (!this.config.autoDisable) return;

    // Disable all inputs, selects, textareas, and buttons
    this.form.querySelectorAll('input, select, textarea, button').forEach(element => {
      element.disabled = true;
    });
  }

  /**
   * Enable all form controls
   */
  enableForm() {
    if (!this.config.autoDisable) return;

    // Enable all inputs, selects, textareas, and buttons
    this.form.querySelectorAll('input, select, textarea, button').forEach(element => {
      // Only enable if it wasn't originally disabled
      const originalState = this.originalButtonStates.get(element);
      if (!originalState || !originalState.disabled) {
        element.disabled = false;
      }
    });
  }

  /**
   * Show submitting state on buttons
   */
  showSubmittingState() {
    if (!this.config.showSpinner) return;

    // Update submit buttons
    this.form.querySelectorAll('button[type="submit"]').forEach(button => {
      const originalState = this.originalButtonStates.get(button);
      if (originalState) {
        button.innerHTML = this.config.spinnerHTML + this.config.submitButtonLoadingText;
      }
    });
  }

  /**
   * Hide submitting state on buttons
   */
  hideSubmittingState() {
    // Restore original button content
    this.form.querySelectorAll('button[type="submit"]').forEach(button => {
      const originalState = this.originalButtonStates.get(button);
      if (originalState) {
        button.innerHTML = originalState.innerHTML;
      }
    });
  }

  /**
   * Collect all form data
   */
  collectFormData() {
    const formData = new FormData(this.form);
    const data = {};

    // Convert FormData to plain object
    for (const [key, value] of formData.entries()) {
      // Handle multiple values (like checkboxes)
      if (data[key]) {
        if (Array.isArray(data[key])) {
          data[key].push(value);
        } else {
          data[key] = [data[key], value];
        }
      } else {
        data[key] = value;
      }
    }

    // Handle checkboxes that might not be in FormData when unchecked
    this.form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      if (!checkbox.checked && !data[checkbox.name]) {
        // For single checkboxes, set to false
        if (!this.form.querySelectorAll(`input[type="checkbox"][name="${checkbox.name}"]`)[1]) {
          data[checkbox.name] = false;
        }
      }
    });

    // Handle radio buttons
    this.form.querySelectorAll('input[type="radio"]:checked').forEach(radio => {
      data[radio.name] = radio.value;
    });

    this.state.data = data;
    return data;
  }

  /**
   * Get field value by element or name
   */
  getFieldValue(fieldOrName) {
    const field = typeof fieldOrName === 'string'
      ? this.form.querySelector(`[name="${fieldOrName}"]`)
      : fieldOrName;

    if (!field) return undefined;

    if (field.type === 'checkbox') {
      // For multiple checkboxes with same name, return array of checked values
      const checkboxes = this.form.querySelectorAll(`input[type="checkbox"][name="${field.name}"]`);
      if (checkboxes.length > 1) {
        return Array.from(checkboxes)
          .filter(cb => cb.checked)
          .map(cb => cb.value);
      }
      return field.checked;
    } else if (field.type === 'radio') {
      return this.form.querySelector(`input[name="${field.name}"]:checked`)?.value;
    } else {
      return field.value;
    }
  }

  /**
   * Validate form data
   */
  validate(data) {
    const errors = {};
    let isValid = true;

    // Check required fields
    this.form.querySelectorAll('[required]').forEach(field => {
      const value = data[field.name];
      if (!value || (typeof value === 'string' && !value.trim())) {
        errors[field.name] = `${this.getFieldLabel(field)} is required`;
        isValid = false;
      }
    });

    // Check email fields
    this.form.querySelectorAll('input[type="email"]').forEach(field => {
      const value = data[field.name];
      if (value && !this.isValidEmail(value)) {
        errors[field.name] = 'Please enter a valid email address';
        isValid = false;
      }
    });

    // Check pattern validation
    this.form.querySelectorAll('[pattern]').forEach(field => {
      const value = data[field.name];
      const pattern = new RegExp(field.pattern);
      if (value && !pattern.test(value)) {
        errors[field.name] = field.title || 'Invalid format';
        isValid = false;
      }
    });

    // Custom validation
    const customValidation = new CustomEvent('validate', {
      detail: { data, errors },
      cancelable: true
    });
    this.dispatchEvent(customValidation);

    this.state.isValid = isValid;
    this.state.errors = errors;

    return { isValid, errors };
  }

  /**
   * Get field label
   */
  getFieldLabel(field) {
    // Try to find associated label
    const label = this.form.querySelector(`label[for="${field.id}"]`);
    if (label) {
      return label.textContent.replace('*', '').trim();
    }

    // Fallback to name attribute
    return field.name.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Email validation helper
   */
  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * Show errors
   */
  showErrors(errors) {
    // Clear previous errors
    this.clearErrors();

    // Show field-specific errors
    Object.entries(errors).forEach(([fieldName, error]) => {
      const field = this.form.querySelector(`[name="${fieldName}"]`);
      if (field) {
        field.classList.add(this.config.fieldErrorClass);

        // Show error message
        const errorElement = document.createElement('div');
        errorElement.className = 'invalid-feedback';
        errorElement.textContent = error;

        // Insert after field or field group
        const insertAfter = field.closest('.input-group') || field;
        insertAfter.parentNode.insertBefore(errorElement, insertAfter.nextSibling);
      }
    });

    // Show in error containers if configured
    if (this.config.errorContainer) {
      const containers = document.querySelectorAll(this.config.errorContainer);
      containers.forEach(container => {
        const errorList = Object.values(errors).map(e => `<li>${e}</li>`).join('');
        container.innerHTML = `<ul class="mb-0">${errorList}</ul>`;
        container.classList.remove('d-none');
      });
    }
  }

  /**
   * Show single error message
   */
  showError(message) {
    if (this.config.errorContainer) {
      // Support both single selector and class selector for multiple containers
      const containers = document.querySelectorAll(this.config.errorContainer);
      
      // Show error in all containers
      containers.forEach(container => {
        container.textContent = message;
        container.classList.remove('d-none');
      });
      
      // Check if any error container is currently in view
      let hasVisibleError = false;
      containers.forEach(container => {
        const rect = container.getBoundingClientRect();
        if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
          hasVisibleError = true;
        }
      });
      
      // If no error is visible, scroll to the nearest one
      if (!hasVisibleError && containers.length > 0) {
        let nearestContainer = null;
        let nearestDistance = Infinity;
        
        containers.forEach(container => {
          const rect = container.getBoundingClientRect();
          const distance = Math.abs(rect.top + rect.height / 2 - window.innerHeight / 2);
          
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestContainer = container;
          }
        });
        
        if (nearestContainer) {
          nearestContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }

  /**
   * Clear all errors
   */
  clearErrors() {
    // Remove field error classes
    this.form.querySelectorAll(`.${this.config.fieldErrorClass}`).forEach(field => {
      field.classList.remove(this.config.fieldErrorClass);
    });

    // Remove error messages
    this.form.querySelectorAll('.invalid-feedback').forEach(el => el.remove());

    // Hide error containers
    if (this.config.errorContainer) {
      const containers = document.querySelectorAll(this.config.errorContainer);
      containers.forEach(container => {
        container.classList.add('d-none');
        container.textContent = '';
      });
    }
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    if (this.config.successContainer) {
      const container = document.querySelector(this.config.successContainer);
      if (container) {
        container.textContent = message;
        container.classList.remove('d-none');
      }
    }
  }

  /**
   * Reset form
   */
  reset() {
    this.form.reset();
    this.state.isDirty = false;
    this.state.data = {};
    this.state.errors = {};
    this.clearErrors();
    this.setFormState('ready');
  }

  /**
   * Set field value programmatically
   */
  setFieldValue(fieldName, value) {
    const field = this.form.querySelector(`[name="${fieldName}"]`);
    if (field) {
      if (field.type === 'checkbox') {
        field.checked = !!value;
      } else if (field.type === 'radio') {
        const radio = this.form.querySelector(`[name="${fieldName}"][value="${value}"]`);
        if (radio) radio.checked = true;
      } else {
        field.value = value;
      }

      // Trigger change event
      field.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  /**
   * Get field value from state data
   */
  getValue(fieldName) {
    return this.state.data[fieldName];
  }

  /**
   * Disable specific field
   */
  disableField(fieldName) {
    const field = this.form.querySelector(`[name="${fieldName}"]`);
    if (field) field.disabled = true;
  }

  /**
   * Enable specific field
   */
  enableField(fieldName) {
    const field = this.form.querySelector(`[name="${fieldName}"]`);
    if (field) field.disabled = false;
  }

  /**
   * Get current form data
   */
  getData() {
    return this.collectFormData();
  }

  /**
   * Get form state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Check if form is dirty
   */
  isDirty() {
    return this.state.isDirty;
  }

  /**
   * Check if form is valid
   */
  isValid() {
    const validation = this.validate(this.collectFormData());
    return validation.isValid;
  }
}
