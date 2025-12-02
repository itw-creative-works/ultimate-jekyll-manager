/**
 * FormManager Test Page JavaScript
 */

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

    // Initialize test forms
    initTestFormMain();
    initTestFormValidation();
    initTestFormContact();
    initTestFormManual();

    // Resolve after initialization
    return resolve();
  });
};

// Helper: simulate async API call
function simulateApi(ms = 1000) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test 1: Full Test (success/fail, nested, change events)
function initTestFormMain() {
  const formManager = new FormManager('#test-form-main');
  const $status = document.getElementById('main-status');
  const $action = document.getElementById('main-action');
  const $output = document.getElementById('main-output');

  formManager.on('statechange', ({ state }) => {
    $status.textContent = `Status: ${state}`;
  });

  formManager.on('change', ({ name, value, data }) => {
    console.log('[Test 1] Change:', name, '=', value);
    console.log('[Test 1] Full data:', data);
  });

  formManager.on('submit', async ({ data, $submitButton }) => {
    console.log('[Test 1] Submitting:', data);
    console.log('[Test 1] Submit button:', $submitButton?.dataset?.action);

    // Show action separately
    const action = $submitButton?.dataset?.action || 'unknown';
    $action.textContent = `Action: ${action}`;

    // Show data
    $output.textContent = JSON.stringify(data, null, 2);

    await simulateApi(1000);

    if (data.settings.outcome === 'error') {
      throw new Error('Simulated server error - please try again');
    }

    formManager.showSuccess(`Form ${action === 'draft' ? 'saved as draft' : 'submitted'} successfully!`);
  });

  // Set Data button - test setData() API
  const $setDataBtn = document.getElementById('main-set-data');
  $setDataBtn.addEventListener('click', () => {
    const testData = {
      user: {
        name: 'John Doe',
        email: 'john@example.com',
        address: {
          city: 'Los Angeles',
        },
      },
      settings: {
        outcome: 'error',
        subscribe: true,
      },
      preferences: {
        notifications: 'important',
        features: {
          darkmode: true,
          analytics: true,
          beta: false,
        },
      },
    };

    formManager.setData(testData);
    $output.textContent = 'Data set via setData() API - submit to verify';
  });
}

// Test 2: Validation
function initTestFormValidation() {
  const formManager = new FormManager('#test-form-validation');
  const $status = document.getElementById('validation-status');
  const $setCorrectBtn = document.getElementById('validation-set-correct');

  formManager.on('statechange', ({ state }) => {
    $status.textContent = `Status: ${state}`;
  });

  // Validation event - runs BEFORE submit, use setError to accumulate errors
  formManager.on('validation', ({ data, setError }) => {
    console.log('[Test 2] Validating:', data);

    // Custom validation (HTML5 validation handles required, email format, etc.)
    // Here we add business logic validation

    if (data.age && parseInt(data.age) < 18) {
      setError('age', 'You must be 18 or older');
    }

    // Note: 'required' validation is handled automatically by HTML5 validation
    // We just need to add the 'required' attribute to the HTML inputs
  });

  formManager.on('submit', async ({ data }) => {
    console.log('[Test 2] Submitting (validation passed):', data);

    // If we reach here, validation passed
    await simulateApi(500);
    formManager.showSuccess('Validation passed! Form submitted.');
  });

  // Set Correct button - fills in valid values
  $setCorrectBtn.addEventListener('click', () => {
    formManager.setData({
      name: 'John Doe',
      email: 'john@example.com',
      age: 25,
      terms: true,
    });
  });
}

// Test 3: Contact Form (one-time submit)
function initTestFormContact() {
  const formManager = new FormManager('#test-form-contact', {
    allowResubmit: false,
    resetOnSuccess: true,
  });
  const $status = document.getElementById('contact-status');

  formManager.on('statechange', ({ state }) => {
    $status.textContent = `Status: ${state}`;
  });

  formManager.on('change', ({ name, value, data }) => {
    console.log('[Test 3] Change:', name, '=', value);
    console.log('[Test 3] Full data:', data);
  });

  formManager.on('submit', async ({ data }) => {
    console.log('[Test 3] Submitting:', data);
    await simulateApi(1000);
    formManager.showSuccess('Message sent! Form is now locked.');
  });
}

// Test 4: Manual Ready
function initTestFormManual() {
  const formManager = new FormManager('#test-form-manual', { autoReady: false });
  const $status = document.getElementById('manual-status');

  formManager.on('statechange', ({ state }) => {
    $status.textContent = `Status: ${state}`;
  });

  formManager.on('change', ({ name, value, data }) => {
    console.log('[Test 4] Change:', name, '=', value);
    console.log('[Test 4] Full data:', data);
  });

  formManager.on('submit', async ({ data }) => {
    console.log('[Test 4] Submitting:', data);
    await simulateApi(1000);
    formManager.showSuccess('Done!');
  });

  // Simulate async initialization (e.g., loading user data)
  setTimeout(() => {
    console.log('[Test 4] Now ready');
    formManager.ready();
  }, 2000);
}
