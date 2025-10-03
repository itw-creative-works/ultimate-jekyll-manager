/**
 * Form Manager Library
 * A comprehensive form management system that handles state, validation, submission, and UI updates
 */

export class FormManager extends EventTarget {
  constructor(selector, options = {}) {
    super();

    // Store whether initialState was explicitly provided
    this.hasCustomInitialState = options.hasOwnProperty('initialState');

    // Configuration with defaults
    this.config = {
      autoDisable: true, // Auto disable/enable form controls
      showSpinner: true, // Show spinner on submit buttons
      validateOnSubmit: true, // Validate before submission
      allowMultipleSubmissions: true, // Allow multiple submissions
      resetOnSuccess: false, // Reset form after successful submission
      spinnerHTML: '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>', // Spinner HTML
      submitButtonLoadingText: 'Processing...',
      submitButtonSuccessText: null, // Text to show on button after successful submission (when allowMultipleSubmissions: false)
      fieldErrorClass: 'is-invalid',
      fieldSuccessClass: 'is-valid',
      initialState: 'loading', // Initial state: loading, ready, submitting, submitted
      toastPosition: 'top-center', // Toast position: top-center, top-end, bottom-center, bottom-end, middle-center
      toastDuration: 5000, // Toast duration in milliseconds
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
      const state = {
        innerHTML: button.innerHTML,
        disabled: button.disabled
      };
      this.originalButtonStates.set(button, state);

      /* @dev-only:start */
      {
        console.log(`[FormManager] Storing button "${button.textContent.trim()}": disabled=${state.disabled}`);
      }
      /* @dev-only:end */
    });

    // Track which submit button was clicked
    this.clickedSubmitButton = null;

    // Store if this is the first initialization
    this.isInitializing = true;

    // Set initial state
    this.setFormState(this.config.initialState);

    // Attach event listeners
    this.attachEventListeners();

    // Only auto-transition to ready if initialState wasn't explicitly set
    // (meaning it's using the default 'loading' value)
    if (!this.hasCustomInitialState) {
      // Set ready state when DOM is ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          this.isInitializing = false;
          this.setFormState('ready');
        });
      } else {
        // Use setTimeout to ensure any parent initialization completes
        setTimeout(() => {
          this.isInitializing = false;
          this.setFormState('ready');
        }, 0);
      }
    } else {
      // If custom initial state was provided, we're done initializing
      this.isInitializing = false;
    }
  }

  /**
   * Attach all event listeners
   */
  attachEventListeners() {
    // Form submit
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));

    // Unified input changes - capture all user interactions
    const inputEvents = ['keyup', 'change', 'paste', 'cut'];
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
    if (this.state.status === 'submitting' && !this.config.allowMultipleSubmissions) {
      return;
    }

    // Clear any existing errors
    this.clearErrors();

    // Collect form data
    const formData = this.collectFormData();

    /* @dev-only:start */
    {
      console.log(`[FormManager] Submit event triggered on ${this.form.id || 'form'}`, formData);
    }
    /* @dev-only:end */

    // Validate if enabled
    if (this.config.validateOnSubmit) {
      const validation = this.validate(formData);
      if (!validation.isValid) {
        this.showErrors(validation.errors);
        // Show a summary notification for validation errors
        const errorCount = Object.keys(validation.errors).length;
        const message = errorCount === 1
          ? 'Please correct the error below'
          : `Please correct the ${errorCount} errors below`;
        this.showNotification(message, 'danger');
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

        // Success - set state based on allowMultipleSubmissions
        if (this.config.allowMultipleSubmissions) {
          this.setFormState('ready');
        } else {
          this.setFormState('submitted');
        }

        this.dispatchEvent(new CustomEvent('success', {
          detail: { data: formData }
        }));

        // Reset form if configured
        if (this.config.resetOnSuccess) {
          this.reset();
        }
      } catch (error) {
        // Error - always go back to ready state
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

    // Clear field error immediately when user starts typing
    if (field.classList.contains(this.config.fieldErrorClass)) {
      this.clearFieldError(field);
    }

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
    }, 100)); // 100ms delay to ensure we capture the final value
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

    /* @dev-only:start */
    {
      console.log(`[FormManager] ${this.form.id || 'form'}: ${previousStatus} --> ${status}`);
    }
    /* @dev-only:end */

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
        // Update button text if submitButtonSuccessText is configured
        if (this.config.submitButtonSuccessText && !this.config.allowMultipleSubmissions) {
          this.showSuccessButtonText();
        }
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

    /* @dev-only:start */
    {
      const count = this.form.querySelectorAll('input, select, textarea, button').length;
      console.log(`[FormManager] Enabling ${count} controls in ${this.form.id || 'form'}`);
    }
    /* @dev-only:end */

    // Enable all inputs, selects, textareas, and buttons
    this.form.querySelectorAll('input, select, textarea, button').forEach(element => {
      // Only enable if it wasn't originally disabled
      const originalState = this.originalButtonStates.get(element);

      // Always enable submit buttons regardless of original state
      const isSubmitButton = element.type === 'submit';

      /* @dev-only:start */
      {
        if (element.tagName === 'BUTTON') {
          const willEnable = isSubmitButton || !originalState || !originalState.disabled;
          console.log(`[FormManager] Button "${element.textContent.trim()}": originally ${originalState?.disabled ? 'disabled' : 'enabled'} --> ${willEnable ? 'enabling' : 'keeping disabled'}`);
        }
      }
      /* @dev-only:end */

      if (isSubmitButton || !originalState || !originalState.disabled) {
        element.disabled = false;
      }
    });

    // Focus the field with autofocus attribute if it exists
    const autofocusField = this.form.querySelector('[autofocus]');
    if (autofocusField && !autofocusField.disabled) {
      autofocusField.focus();
    }
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
   * Show success button text after successful submission
   */
  showSuccessButtonText() {
    if (!this.config.submitButtonSuccessText) return;

    // Update submit buttons with success text
    this.form.querySelectorAll('button[type="submit"]').forEach(button => {
      // Find the button-text span if it exists
      const buttonTextSpan = button.querySelector('.button-text');
      if (buttonTextSpan) {
        buttonTextSpan.textContent = this.config.submitButtonSuccessText;
      } else {
        // If no button-text span, update the entire button content
        button.textContent = this.config.submitButtonSuccessText;
      }
    });
  }

  /**
   * Set nested property value using dot notation
   */
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();

    // Create nested structure if it doesn't exist
    let current = obj;
    for (const key of keys) {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    // Set the value
    current[lastKey] = value;
  }

  /**
   * Get nested property value using dot notation
   */
  getNestedValue(obj, path) {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current == null || typeof current !== 'object') {
        return undefined;
      }
      current = current[key];
    }

    return current;
  }

  /**
   * Collect all form data
   */
  collectFormData() {
    const formData = new FormData(this.form);
    const data = {};

    // Convert FormData to plain object with support for dot notation
    for (const [key, value] of formData.entries()) {
      // Check if key contains dots for nested structure
      if (key.includes('.')) {
        // Handle nested structure
        const existingValue = this.getNestedValue(data, key);
        if (existingValue !== undefined) {
          // Handle multiple values
          if (Array.isArray(existingValue)) {
            existingValue.push(value);
          } else {
            this.setNestedValue(data, key, [existingValue, value]);
          }
        } else {
          this.setNestedValue(data, key, value);
        }
      } else {
        // Handle flat structure (original behavior)
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
    }

    // Handle checkboxes that might not be in FormData when unchecked
    this.form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      const name = checkbox.name;
      if (!checkbox.checked) {
        // Check if value exists (for nested or flat)
        const value = name.includes('.') ? this.getNestedValue(data, name) : data[name];
        if (value === undefined) {
          // For single checkboxes, set to false
          if (!this.form.querySelectorAll(`input[type="checkbox"][name="${name}"]`)[1]) {
            if (name.includes('.')) {
              this.setNestedValue(data, name, false);
            } else {
              data[name] = false;
            }
          }
        }
      }
    });

    // Handle radio buttons
    this.form.querySelectorAll('input[type="radio"]:checked').forEach(radio => {
      const name = radio.name;
      if (name.includes('.')) {
        this.setNestedValue(data, name, radio.value);
      } else {
        data[name] = radio.value;
      }
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

    // Log
    /* @dev-only:start */
    {
      console.log(`[FormManager] Validating form ${this.form.id || 'form'}`, data);
    }
    /* @dev-only:end */

    // Check required fields
    this.form.querySelectorAll('[required]').forEach(field => {
      // Get value, handling nested fields with dot notation
      const value = field.name.includes('.')
        ? this.getNestedValue(data, field.name)
        : data[field.name];

      if (!value || (typeof value === 'string' && !value.trim())) {
        errors[field.name] = `${this.getFieldLabel(field)} is required`;
        isValid = false;
      }
    });

    // Check email fields
    this.form.querySelectorAll('input[type="email"]').forEach(field => {
      // Get value, handling nested fields with dot notation
      const value = field.name.includes('.')
        ? this.getNestedValue(data, field.name)
        : data[field.name];

      if (value && !this.isValidEmail(value)) {
        errors[field.name] = 'Please enter a valid email address';
        isValid = false;
      }
    });

    // Check pattern validation
    this.form.querySelectorAll('[pattern]').forEach(field => {
      // Get value, handling nested fields with dot notation
      const value = field.name.includes('.')
        ? this.getNestedValue(data, field.name)
        : data[field.name];

      const pattern = new RegExp(field.pattern);
      if (value && !pattern.test(value)) {
        errors[field.name] = field.title || 'Invalid format';
        isValid = false;
      }
    });

    // Check minlength validation
    this.form.querySelectorAll('[minlength]').forEach(field => {
      // Get value, handling nested fields with dot notation
      const value = field.name.includes('.')
        ? this.getNestedValue(data, field.name)
        : data[field.name];

      const minLength = parseInt(field.minLength);
      if (value && value.length < minLength) {
        errors[field.name] = `${this.getFieldLabel(field)} must be at least ${minLength} characters`;
        isValid = false;
      }
    });

    // Check maxlength validation
    this.form.querySelectorAll('[maxlength]').forEach(field => {
      // Get value, handling nested fields with dot notation
      const value = field.name.includes('.')
        ? this.getNestedValue(data, field.name)
        : data[field.name];

      const maxLength = parseInt(field.maxLength);
      if (value && value.length > maxLength) {
        errors[field.name] = `${this.getFieldLabel(field)} must be no more than ${maxLength} characters`;
        isValid = false;
      }
    });

    // Check min validation for number inputs
    this.form.querySelectorAll('input[type="number"][min]').forEach(field => {
      // Get value, handling nested fields with dot notation
      const value = field.name.includes('.')
        ? this.getNestedValue(data, field.name)
        : data[field.name];

      const min = parseFloat(field.min);
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && numValue < min) {
        errors[field.name] = `${this.getFieldLabel(field)} must be at least ${min}`;
        isValid = false;
      }
    });

    // Check max validation for number inputs
    this.form.querySelectorAll('input[type="number"][max]').forEach(field => {
      // Get value, handling nested fields with dot notation
      const value = field.name.includes('.')
        ? this.getNestedValue(data, field.name)
        : data[field.name];

      const max = parseFloat(field.max);
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && numValue > max) {
        errors[field.name] = `${this.getFieldLabel(field)} must be no more than ${max}`;
        isValid = false;
      }
    });

    // Custom validation
    const customValidation = new CustomEvent('validate', {
      detail: { data, errors },
      cancelable: true
    });
    this.dispatchEvent(customValidation);

    // Update isValid if custom validation added errors
    this.state.isValid = isValid;
    this.state.errors = errors;

    // Log
    /* @dev-only:start */
    {
      console.log(`[FormManager] Validation result for ${this.form.id || 'form'}`, { isValid, errors });
    }
    /* @dev-only:end */

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

    let firstErrorField = null;

    // Show field-specific errors
    Object.entries(errors).forEach(([fieldName, error]) => {
      const field = this.form.querySelector(`[name="${fieldName}"]`);
      if (field) {
        field.classList.add(this.config.fieldErrorClass);

        // Track first error field for focus
        if (!firstErrorField) {
          firstErrorField = field;
        }

        // Show error message
        const errorElement = document.createElement('div');
        errorElement.className = 'invalid-feedback';
        errorElement.textContent = error;

        // Insert after field or field group
        const insertAfter = field.closest('.input-group') || field;
        insertAfter.parentNode.insertBefore(errorElement, insertAfter.nextSibling);
      }
    });

    // Focus the first field with an error
    if (firstErrorField) {
      firstErrorField.focus();

      // Scroll into view if needed
      firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // If there are errors that couldn't be attached to fields, show them in a notification
    const unattachedErrors = Object.entries(errors).filter(([fieldName]) => {
      return !this.form.querySelector(`[name="${fieldName}"]`);
    });

    if (unattachedErrors.length > 0) {
      const errorMessage = unattachedErrors.map(([_, error]) => error).join(', ');
      this.showNotification(errorMessage, 'danger');
    }
  }

  /**
   * Show notification (toast-style)
   */
  showNotification(message, type = 'info') {
    const $notification = document.createElement('div');
    $notification.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-5 animation-slide-down`;
    $notification.style.zIndex = '9999';
    $notification.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    document.body.appendChild($notification);

    setTimeout(() => {
      $notification.remove();
    }, 5000);
  }

  /**
   * Show single error message
   */
  showError(messageOrError) {
    // Handle Error objects and strings
    let message;
    if (messageOrError instanceof Error) {
      message = messageOrError.message;
      console.error('FormManager Error:', messageOrError);
    } else {
      message = messageOrError;
      console.error('FormManager Error:', message);
    }

    // Always use notification system
    this.showNotification(message, 'danger');
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
  }

  /**
   * Clear error for a specific field
   */
  clearFieldError(field) {
    // Remove error class from field
    field.classList.remove(this.config.fieldErrorClass);

    // Remove error message for this field
    const errorElement = field.parentElement.querySelector('.invalid-feedback') ||
                        field.closest('.input-group')?.parentElement.querySelector('.invalid-feedback');
    if (errorElement) {
      errorElement.remove();
    }

    // Remove field from state errors
    if (this.state.errors && field.name) {
      delete this.state.errors[field.name];
    }
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    // Always use notification system
    this.showNotification(message, 'success');
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

      // Update internal state data with nested field support
      if (fieldName.includes('.')) {
        this.setNestedValue(this.state.data, fieldName, value);
      } else {
        this.state.data[fieldName] = value;
      }

      // Trigger change event
      field.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  /**
   * Get field value from state data
   */
  getValue(fieldName) {
    // Handle nested fields with dot notation
    return fieldName.includes('.')
      ? this.getNestedValue(this.state.data, fieldName)
      : this.state.data[fieldName];
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
   * Flatten nested object to dot notation
   */
  flattenObject(obj, prefix = '') {
    const flattened = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        // Recursively flatten nested objects
        Object.assign(flattened, this.flattenObject(value, newKey));
      } else {
        flattened[newKey] = value;
      }
    }

    return flattened;
  }

  /**
   * Set form values programmatically
   * @param {Object} values - Object with field names as keys and values to set (supports nested objects)
   */
  setValues(values) {
    if (!values || typeof values !== 'object') return;

    // Flatten nested objects to dot notation
    const flatValues = this.flattenObject(values);

    Object.entries(flatValues).forEach(([name, value]) => {
      // Find form elements by name or id
      const element = this.form.querySelector(`[name="${name}"]`) ||
                      this.form.querySelector(`#${name}`) ||
                      this.form.querySelector(`#${name}-input`) ||
                      this.form.querySelector(`#${name}-select`);

      if (!element) return;

      // Handle different element types
      if (element.type === 'checkbox') {
        element.checked = !!value;
      } else if (element.type === 'radio') {
        // For radio buttons, find the one with matching value
        const radioGroup = this.form.querySelectorAll(`[name="${name}"]`);
        radioGroup.forEach(radio => {
          radio.checked = radio.value === value;
        });
      } else if (element.tagName === 'SELECT') {
        // For select elements, set the value
        element.value = value;
        // If value doesn't exist in options, try to find by text
        if (!element.value && value) {
          const option = Array.from(element.options).find(opt =>
            opt.text.toLowerCase() === value.toLowerCase()
          );
          if (option) element.value = option.value;
        }
      } else {
        // For text inputs, textareas, etc.
        element.value = value || '';
      }

      // Trigger change event to update form state
      const event = new Event('change', { bubbles: true });
      element.dispatchEvent(event);
    });

    // Update form state
    this.state.data = this.collectFormData();
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
