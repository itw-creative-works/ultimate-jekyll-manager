/**
 * FormManager - Lightweight form state management
 *
 * States: initializing → ready ⇄ submitting → ready (or submitted)
 *
 * Usage:
 *   const formManager = new FormManager('#my-form', { options });
 *   formManager.on('submit', async (data) => {
 *     const response = await fetch('/api', { body: JSON.stringify(data) });
 *     if (!response.ok) throw new Error('Failed');
 *   });
 */

// Libraries
import { ready as domReady } from 'web-manager/modules/dom.js';
import { showNotification, getDeviceType } from 'web-manager/modules/utilities.js';

// Constants
const HONEYPOT_SELECTOR = '[data-honey], [name="honey"]';

export class FormManager {
  constructor(selector, options = {}) {
    // Get form element
    this.$form = typeof selector === 'string'
      ? document.querySelector(selector)
      : selector;

    if (!this.$form) {
      throw new Error(`FormManager: Form not found: ${selector}`);
    }

    // Configuration
    this.config = {
      autoReady: true, // Auto-transition to initialState when DOM is ready
      initialState: 'ready', // State to transition to when autoReady fires
      allowResubmit: true, // Allow resubmission after success (false = go to 'submitted' state)
      resetOnSuccess: false, // Clear form fields after successful submission
      warnOnUnsavedChanges: false, // Warn user before leaving page with unsaved changes
      submittingText: 'Processing...', // Text shown on submit button during submission
      submittedText: 'Processed!', // Text shown on submit button after submission (when allowResubmit: false)
      inputGroup: null, // Filter getData() to only include fields with matching data-input-group (null = all fields)
      ...options,
    };

    // State
    this.state = 'initializing';
    this._isDirty = false;

    // Event listeners
    this._listeners = {
      change: [],
      validation: [],
      submit: [],
      statechange: [],
      honeypot: [],
    };

    // Field errors (populated during validation)
    this._fieldErrors = {};

    // Bind beforeunload handler so we can remove it later
    this._beforeUnloadHandler = (e) => this._handleBeforeUnload(e);

    /* @dev-only:start */
    {
      console.log('[Form-manager] Initialized', {
        selector: typeof selector === 'string' ? selector : this.$form.id || this.$form,
        config: this.config,
      });
    }
    /* @dev-only:end */

    // Initialize
    this._init();
  }

  /**
   * Initialize the form manager
   */
  _init() {
    // Disable form during initialization
    this._setDisabled(true);

    // Attach submit handler
    this.$form.addEventListener('submit', (e) => this._handleSubmit(e));

    // Attach change handlers
    this.$form.addEventListener('input', (e) => this._handleChange(e));
    this.$form.addEventListener('change', (e) => this._handleChange(e));

    // Attach beforeunload handler if configured
    if (this.config.warnOnUnsavedChanges) {
      window.addEventListener('beforeunload', this._beforeUnloadHandler);
    }

    // Handle page restored from bfcache (e.g., back button after OAuth redirect)
    window.addEventListener('pageshow', (e) => this._handlePageShow(e));

    // Auto-transition to initialState when DOM is ready
    if (this.config.autoReady) {
      domReady().then(() => this._setInitialState());
    }
  }

  /**
   * Register event listener
   */
  on(event, callback) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(callback);
    return this; // Allow chaining
  }

  /**
   * Emit event to all listeners
   */
  async _emit(event, data) {
    const listeners = this._listeners[event] || [];
    for (const callback of listeners) {
      await callback(data);
    }
  }

  /**
   * Set initial state based on config
   */
  _setInitialState() {
    const state = this.config.initialState;

    /* @dev-only:start */
    {
      console.log('[Form-manager] DOM ready, setting initial state:', state);
    }
    /* @dev-only:end */

    if (state === 'ready') {
      this.ready();
    } else {
      this._setState(state);
    }
  }

  /**
   * Transition to ready state
   */
  ready() {
    /* @dev-only:start */
    {
      console.log('[Form-manager] ready() called');
    }
    /* @dev-only:end */

    this._setState('ready');
    this._setDisabled(false);

    // Focus the field with autofocus attribute if it exists (desktop only)
    const $autofocusField = this.$form.querySelector('[autofocus]');
    if ($autofocusField && !$autofocusField.disabled && getDeviceType() === 'desktop') {
      $autofocusField.focus();

      // Move cursor to end of input if it has existing text
      // Disabled because throws errors on some inputs (eg email)
      // if (typeof $autofocusField.setSelectionRange === 'function') {
      //   const len = $autofocusField.value.length;
      //   $autofocusField.setSelectionRange(len, len);
      // }
    }
  }

  /**
   * Handle form submission
   */
  async _handleSubmit(e) {
    // Always prevent default - this is the whole point
    e.preventDefault();

    // Ignore if not ready
    if (this.state !== 'ready') {
      /* @dev-only:start */
      {
        console.log('[Form-manager] Submit ignored, not ready. Current state:', this.state);
      }
      /* @dev-only:end */
      return;
    }

    // Get the submit button that was clicked (native browser API)
    const $submitButton = e.submitter;

    // Collect form data BEFORE disabling (disabled elements aren't in FormData)
    const data = this.getData();

    // Clear previous field errors
    this.clearFieldErrors();

    // Run validation BEFORE transitioning to submitting state
    const validationPassed = await this._runValidation(data, $submitButton);
    if (!validationPassed) {
      return;
    }

    // Transition to submitting
    this._setState('submitting');
    this._setDisabled(true);
    this._showSpinner(true);

    /* @dev-only:start */
    {
      console.log('[Form-manager] Submitting', {
        data,
        submitButton: $submitButton?.name ? `${$submitButton.name}=${$submitButton.value}` : null,
      });
    }
    /* @dev-only:end */

    try {
      // Let consumers handle the submission
      await this._emit('submit', { data, $submitButton });

      /* @dev-only:start */
      {
        console.log('[Form-manager] Submit success', {
          resetOnSuccess: this.config.resetOnSuccess,
          allowResubmit: this.config.allowResubmit,
        });
      }
      /* @dev-only:end */

      // Success - clear dirty state
      this.setDirty(false);
      this._showSpinner(false);

      if (this.config.resetOnSuccess) {
        this.$form.reset();
      }

      if (this.config.allowResubmit) {
        this._setState('ready');
        this._setDisabled(false);
      } else {
        this._setState('submitted');
        this._showSubmittedText();
        // Stay disabled - no more submissions allowed
      }
    } catch (error) {
      /* @dev-only:start */
      {
        console.log('[Form-manager] Submit error:', error.message);
      }
      /* @dev-only:end */

      // Error - go back to ready and show error
      this._setState('ready');
      this._setDisabled(false);
      this._showSpinner(false);
      this.showError(error.message || 'An error occurred');
    }
  }

  /**
   * Handle input changes
   */
  _handleChange(e) {
    // Mark form as dirty
    this.setDirty(true);

    const data = this.getData();

    /* @dev-only:start */
    {
      console.log('[Form-manager] Change', {
        name: e.target.name,
        value: e.target.value,
        data,
      });
    }
    /* @dev-only:end */

    this._emit('change', {
      field: e.target,
      name: e.target.name,
      value: e.target.value,
      data,
    });

    // Clear field error when user types in that field
    if (this._fieldErrors[e.target.name]) {
      this._clearFieldError(e.target.name);
    }
  }

  /**
   * Run validation (HTML5 + custom validation event)
   * Returns true if validation passed, false if there are errors
   */
  async _runValidation(data, $submitButton) {
    /* @dev-only:start */
    {
      console.log('[Form-manager] Running validation');
    }
    /* @dev-only:end */

    // 0. Check honeypot fields first (bot detection)
    if (this._isHoneypotFilled()) {
      /* @dev-only:start */
      {
        console.log('[Form-manager] Honeypot triggered - rejecting submission');
      }
      /* @dev-only:end */

      // Emit honeypot event for tracking
      this._emit('honeypot', { data });

      this.showError('Something went wrong. Please try again.');
      return false;
    }

    // Create setError helper for custom validation
    const setError = (fieldName, message) => {
      this._fieldErrors[fieldName] = message;
    };

    // 1. Run automatic HTML5 validation
    this._runHTML5Validation(setError);

    // 2. Run custom validation listeners
    await this._emit('validation', { data, setError, $submitButton });

    // 3. Check if there are any errors
    const errorCount = Object.keys(this._fieldErrors).length;
    if (errorCount > 0) {
      /* @dev-only:start */
      {
        console.log('[Form-manager] Validation failed:', this._fieldErrors);
      }
      /* @dev-only:end */

      // Display all field errors
      this._displayFieldErrors();

      // Focus first error field
      this._focusFirstError();

      return false;
    }

    /* @dev-only:start */
    {
      console.log('[Form-manager] Validation passed');
    }
    /* @dev-only:end */

    return true;
  }

  /**
   * Run HTML5 constraint validation on all form fields
   */
  _runHTML5Validation(setError) {
    const $fields = this.$form.querySelectorAll('input, select, textarea');

    $fields.forEach(($field) => {
      const name = $field.name;
      if (!name) {
        return;
      }

      // Skip if already has an error (from previous validation)
      if (this._fieldErrors[name]) {
        return;
      }

      const value = $field.value;
      const type = $field.type;

      // Required validation
      if ($field.hasAttribute('required')) {
        if (type === 'checkbox' && !$field.checked) {
          setError(name, 'This field is required');
          return;
        }
        if (!value || !value.trim()) {
          setError(name, 'This field is required');
          return;
        }
      }

      // Skip further validation if empty and not required
      if (!value) {
        return;
      }

      // Email validation
      if (type === 'email') {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(value)) {
          setError(name, 'Please enter a valid email address');
          return;
        }
      }

      // URL validation
      if (type === 'url') {
        try {
          new URL(value);
        } catch {
          setError(name, 'Please enter a valid URL');
          return;
        }
      }

      // Min length validation
      if ($field.hasAttribute('minlength')) {
        const minLength = parseInt($field.getAttribute('minlength'), 10);
        if (value.length < minLength) {
          setError(name, `Must be at least ${minLength} characters`);
          return;
        }
      }

      // Max length validation
      if ($field.hasAttribute('maxlength')) {
        const maxLength = parseInt($field.getAttribute('maxlength'), 10);
        if (value.length > maxLength) {
          setError(name, `Must be no more than ${maxLength} characters`);
          return;
        }
      }

      // Min value validation (for number, range, date, etc.)
      if ($field.hasAttribute('min')) {
        const min = $field.getAttribute('min');
        if (type === 'number' || type === 'range') {
          if (parseFloat(value) < parseFloat(min)) {
            setError(name, `Must be at least ${min}`);
            return;
          }
        } else if (type === 'date' || type === 'datetime-local') {
          if (new Date(value) < new Date(min)) {
            setError(name, `Must be on or after ${min}`);
            return;
          }
        }
      }

      // Max value validation
      if ($field.hasAttribute('max')) {
        const max = $field.getAttribute('max');
        if (type === 'number' || type === 'range') {
          if (parseFloat(value) > parseFloat(max)) {
            setError(name, `Must be no more than ${max}`);
            return;
          }
        } else if (type === 'date' || type === 'datetime-local') {
          if (new Date(value) > new Date(max)) {
            setError(name, `Must be on or before ${max}`);
            return;
          }
        }
      }

      // Pattern validation
      if ($field.hasAttribute('pattern')) {
        const pattern = new RegExp(`^${$field.getAttribute('pattern')}$`);
        if (!pattern.test(value)) {
          const title = $field.getAttribute('title') || 'Please match the requested format';
          setError(name, title);
          return;
        }
      }
    });
  }

  /**
   * Display all field errors in the DOM
   */
  _displayFieldErrors() {
    for (const [fieldName, message] of Object.entries(this._fieldErrors)) {
      this._showFieldError(fieldName, message);
    }
  }

  /**
   * Show error on a specific field
   */
  _showFieldError(fieldName, message) {
    const $field = this.$form.querySelector(`[name="${fieldName}"]`);
    if (!$field) {
      return;
    }

    // Add invalid class to field
    $field.classList.add('is-invalid');

    // Find or create feedback element
    let $feedback = $field.parentElement.querySelector('.invalid-feedback');
    if (!$feedback) {
      $feedback = document.createElement('div');
      $feedback.className = 'invalid-feedback';

      // Insert after the field (or after the label for checkboxes)
      if ($field.type === 'checkbox' || $field.type === 'radio') {
        const $parent = $field.closest('.form-check') || $field.parentElement;
        $parent.appendChild($feedback);
      } else {
        $field.parentElement.appendChild($feedback);
      }
    }

    $feedback.textContent = message;
    $feedback.style.display = 'block';
  }

  /**
   * Clear error on a specific field
   */
  _clearFieldError(fieldName) {
    delete this._fieldErrors[fieldName];

    const $field = this.$form.querySelector(`[name="${fieldName}"]`);
    if (!$field) {
      return;
    }

    $field.classList.remove('is-invalid');

    const $feedback = $field.parentElement.querySelector('.invalid-feedback');
    if ($feedback) {
      $feedback.style.display = 'none';
    }
  }

  /**
   * Clear all field errors
   */
  clearFieldErrors() {
    for (const fieldName of Object.keys(this._fieldErrors)) {
      this._clearFieldError(fieldName);
    }
    this._fieldErrors = {};
  }

  /**
   * Focus the first field with an error
   */
  _focusFirstError() {
    const firstFieldName = Object.keys(this._fieldErrors)[0];
    if (!firstFieldName) {
      return;
    }

    const $field = this.$form.querySelector(`[name="${firstFieldName}"]`);
    if ($field) {
      $field.scrollIntoView({ behavior: 'smooth', block: 'center' });
      $field.focus();
    }
  }

  /**
   * Programmatically set field errors and display them (for use in submit handler)
   */
  throwFieldErrors(errors) {
    for (const [fieldName, message] of Object.entries(errors)) {
      this._fieldErrors[fieldName] = message;
    }
    this._displayFieldErrors();
    this._focusFirstError();
    throw new Error('Validation failed');
  }

  /**
   * Handle beforeunload event
   */
  _handleBeforeUnload(e) {
    if (!this._isDirty) {
      return;
    }

    // Standard way to trigger browser's "unsaved changes" dialog
    e.preventDefault();
    e.returnValue = '';
  }

  /**
   * Handle pageshow event (bfcache restoration)
   */
  _handlePageShow(e) {
    // Only handle if page was restored from bfcache
    if (!e.persisted) {
      return;
    }

    /* @dev-only:start */
    {
      console.log('[Form-manager] Page restored from bfcache, current state:', this.state);
    }
    /* @dev-only:end */

    // Reset form to ready if it was stuck in submitting state
    if (this.state === 'submitting') {
      this._showSpinner(false);
      this.ready();
    }
  }

  /**
   * Set dirty state
   */
  setDirty(dirty) {
    if (this._isDirty === dirty) {
      return;
    }

    this._isDirty = dirty;

    /* @dev-only:start */
    {
      console.log('[Form-manager] Dirty state:', dirty);
    }
    /* @dev-only:end */
  }

  /**
   * Set form state
   */
  _setState(newState) {
    const previousState = this.state;
    this.state = newState;
    this.$form.setAttribute('data-form-state', newState);

    /* @dev-only:start */
    {
      console.log('[Form-manager] State change', {
        from: previousState,
        to: newState,
      });
    }
    /* @dev-only:end */

    this._emit('statechange', { state: newState, previousState });
  }

  /**
   * Enable/disable form controls
   */
  _setDisabled(disabled) {
    /* @dev-only:start */
    {
      console.log('[Form-manager] Set disabled:', disabled);
    }
    /* @dev-only:end */

    this.$form.querySelectorAll('button, input, select, textarea').forEach(($el) => {
      $el.disabled = disabled;
    });
  }

  /**
   * Get all submit buttons in the form
   * Note: Uses button.type property instead of [type="submit"] selector
   * because HTML minifiers may strip the attribute (it's the default)
   */
  _getSubmitButtons() {
    return Array.from(this.$form.querySelectorAll('button')).filter($btn => $btn.type === 'submit');
  }

  /**
   * Show/hide spinner on submit buttons
   */
  _showSpinner(show) {
    this._getSubmitButtons().forEach(($btn) => {
      if (show) {
        // Store original content
        $btn._originalHTML = $btn.innerHTML;
        $btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${this.config.submittingText}`;
      } else if ($btn._originalHTML) {
        $btn.innerHTML = $btn._originalHTML;
      }
    });
  }

  /**
   * Show submitted text on submit buttons (when allowResubmit: false)
   */
  _showSubmittedText() {
    this._getSubmitButtons().forEach(($btn) => {
      const $buttonText = $btn.querySelector('.button-text');
      if ($buttonText) {
        $buttonText.textContent = this.config.submittedText;
      } else {
        $btn.textContent = this.config.submittedText;
      }
    });
  }

  /**
   * Set nested value using dot notation (e.g., "user.address.city")
   */
  _setNested(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let current = obj;

    for (const key of keys) {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    // Handle multiple values (e.g., checkboxes with same name)
    if (current[lastKey] !== undefined) {
      if (!Array.isArray(current[lastKey])) {
        current[lastKey] = [current[lastKey]];
      }
      current[lastKey].push(value);
    } else {
      current[lastKey] = value;
    }
  }

  /**
   * Get nested value using dot notation
   */
  _getNested(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Collect form data as plain object (supports dot notation for nested fields)
   * Respects inputGroup filter when set - only includes fields matching the group
   */
  getData() {
    const data = {};

    // Get all form fields
    const $fields = this.$form.querySelectorAll('input, select, textarea');

    // Count checkboxes per name to detect groups vs single (only for fields in group)
    const checkboxCounts = {};
    $fields.forEach(($field) => {
      if ($field.type === 'checkbox' && this._isFieldInGroup($field)) {
        checkboxCounts[$field.name] = (checkboxCounts[$field.name] || 0) + 1;
      }
    });

    // Process non-checkbox fields
    $fields.forEach(($field) => {
      const name = $field.name;

      // Skip fields without name
      if (!name) {
        return;
      }

      // Skip if field is not in current input group
      if (!this._isFieldInGroup($field)) {
        return;
      }

      // Skip honeypot fields (should never be in form data)
      if ($field.matches(HONEYPOT_SELECTOR)) {
        return;
      }

      // Skip checkboxes - we handle them separately
      if ($field.type === 'checkbox') {
        return;
      }

      // Skip radio buttons that aren't checked
      if ($field.type === 'radio' && !$field.checked) {
        return;
      }

      this._setNested(data, name, $field.value);
    });

    // Handle checkboxes
    const processedGroups = new Set();
    $fields.forEach(($cb) => {
      if ($cb.type !== 'checkbox') {
        return;
      }

      const name = $cb.name;

      // Skip if field is not in current input group
      if (!this._isFieldInGroup($cb)) {
        return;
      }

      // Single checkbox: true/false
      if (checkboxCounts[name] === 1) {
        this._setNested(data, name, $cb.checked);
        return;
      }

      // Checkbox group: object with value: true/false (only process once per group)
      if (processedGroups.has(name)) {
        return;
      }
      processedGroups.add(name);

      const values = {};
      this.$form.querySelectorAll(`input[type="checkbox"][name="${name}"]`).forEach(($groupCb) => {
        // Only include checkboxes that are in the group
        if (this._isFieldInGroup($groupCb)) {
          values[$groupCb.value] = $groupCb.checked;
        }
      });
      this._setNested(data, name, values);
    });

    return data;
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    /* @dev-only:start */
    {
      console.log('[Form-manager] Show success:', message);
    }
    /* @dev-only:end */

    showNotification(message, { type: 'success' });
  }

  /**
   * Show error message
   */
  showError(message) {
    /* @dev-only:start */
    {
      console.log('[Form-manager] Show error:', message);
    }
    /* @dev-only:end */

    showNotification(message, { type: 'danger' });
  }

  /**
   * Reset the form
   */
  reset() {
    /* @dev-only:start */
    {
      console.log('[Form-manager] reset() called');
    }
    /* @dev-only:end */

    this.setDirty(false);
    this.$form.reset();
    this._setState('ready');
  }

  /**
   * Check if form has unsaved changes
   */
  isDirty() {
    return this._isDirty;
  }

  /**
   * Set the input group filter for getData()
   * When set, getData() only returns fields matching the group (via data-input-group attribute)
   * Fields without data-input-group or with empty value are considered "global" and always included
   *
   * @param {string|string[]|null} group - Group name(s) to filter by (e.g., 'url', ['url', 'wifi']), or null to disable filtering
   * @returns {FormManager} - Returns this for chaining
   */
  setInputGroup(group) {
    // Normalize to array or null
    if (group === null || group === undefined || group === '') {
      this.config.inputGroup = null;
    } else if (Array.isArray(group)) {
      this.config.inputGroup = group.map((g) => g.toLowerCase());
    } else {
      this.config.inputGroup = [group.toLowerCase()];
    }

    /* @dev-only:start */
    {
      console.log('[Form-manager] setInputGroup:', this.config.inputGroup);
    }
    /* @dev-only:end */

    return this;
  }

  /**
   * Get the current input group filter
   * @returns {string[]|null}
   */
  getInputGroup() {
    return this.config.inputGroup;
  }

  /**
   * Check if any honeypot field has been filled (bot detection)
   * Honeypot fields are hidden from users but bots fill them automatically
   * @returns {boolean} - true if a honeypot field has a value (bot detected)
   */
  _isHoneypotFilled() {
    const $honeypots = this.$form.querySelectorAll(HONEYPOT_SELECTOR);

    for (const $field of $honeypots) {
      if ($field.value && $field.value.trim() !== '') {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a field should be included based on input group filter
   * @param {HTMLElement} $field - The field element to check
   * @returns {boolean}
   */
  _isFieldInGroup($field) {
    const allowedGroups = this.config.inputGroup;

    // No filter set - include all fields
    if (!allowedGroups) {
      return true;
    }

    // Get field's group attribute
    const fieldGroup = $field.getAttribute('data-input-group');

    // No group attribute or empty = global field, always include
    if (!fieldGroup || fieldGroup.trim() === '') {
      return true;
    }

    // Check if field's group is in allowed groups
    return allowedGroups.includes(fieldGroup.toLowerCase());
  }

  /**
   * Set form data from a nested object (supports dot notation field names)
   */
  setData(data) {
    /* @dev-only:start */
    {
      console.log('[Form-manager] setData() called', data);
    }
    /* @dev-only:end */

    // Flatten nested object to dot notation paths
    const flatData = this._flattenObject(data);

    // Set each field value
    for (const [path, value] of Object.entries(flatData)) {
      this._setFieldValue(path, value);
    }
  }

  /**
   * Flatten a nested object to dot notation paths
   */
  _flattenObject(obj, prefix = '') {
    const result = {};

    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;

      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // Check if this is a checkbox group (object with boolean values)
        const isCheckboxGroup = Object.values(value).every((v) => typeof v === 'boolean');

        if (isCheckboxGroup) {
          // Keep as object for checkbox group handling
          result[path] = value;
        } else {
          // Recurse into nested object
          Object.assign(result, this._flattenObject(value, path));
        }
      } else {
        result[path] = value;
      }
    }

    return result;
  }

  /**
   * Set a single field value by name (supports dot notation)
   */
  _setFieldValue(name, value) {
    const $fields = this.$form.querySelectorAll(`[name="${name}"]`);

    if ($fields.length === 0) {
      /* @dev-only:start */
      {
        console.log('[Form-manager] setData: field not found:', name);
      }
      /* @dev-only:end */
      return;
    }

    const $field = $fields[0];
    const type = $field.type;

    // Handle different input types
    if (type === 'checkbox') {
      if ($fields.length === 1) {
        // Single checkbox: boolean value
        $field.checked = !!value;
      } else if (typeof value === 'object') {
        // Checkbox group: object with value: boolean
        $fields.forEach(($cb) => {
          $cb.checked = !!value[$cb.value];
        });
      }
    } else if (type === 'radio') {
      // Radio group: set the one with matching value
      $fields.forEach(($radio) => {
        $radio.checked = $radio.value === value;
      });
    } else if ($field.tagName === 'SELECT') {
      // Select: set value
      $field.value = value;
    } else {
      // Text, email, textarea, etc.
      $field.value = value;
    }

    /* @dev-only:start */
    {
      console.log('[Form-manager] setData: set field', { name, value, type });
    }
    /* @dev-only:end */
  }
}
