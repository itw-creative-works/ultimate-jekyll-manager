// Form data collection module

/**
 * Collects all form data from the checkout form
 * @returns {Object} Form data object
 */
export function collectFormData() {
  const form = document.getElementById('checkout-form');
  if (!form) {
    console.warn('Checkout form not found');
    return {};
  }

  const formData = new FormData(form);
  const data = {};

  // Convert FormData to plain object
  for (const [key, value] of formData.entries()) {
    // Handle multiple values with same name (like checkboxes)
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

  // Add specific fields that might not be in form inputs
  
  // Billing cycle (radio button)
  const billingCycle = document.querySelector('input[name="billing-cycle"]:checked');
  if (billingCycle) {
    data.billing_cycle = billingCycle.value;
  }

  // Payment method (radio button)
  const paymentMethod = document.querySelector('input[name="payment-method"]:checked');
  if (paymentMethod) {
    data.payment_method = paymentMethod.value;
  }

  // Discount code
  const discountCode = document.getElementById('discount-code');
  if (discountCode && discountCode.value.trim()) {
    data.discount_code = discountCode.value.trim();
  }

  // Crypto selection (if crypto payment method is selected)
  if (data.payment_method === 'crypto') {
    const cryptoSelect = document.getElementById('cryptoSelect');
    if (cryptoSelect) {
      data.crypto_currency = cryptoSelect.value;
    }
  }

  // Add any custom fields from the customer-fields section
  const customerFields = document.getElementById('customer-fields');
  if (customerFields) {
    // Collect any input, select, or textarea within customer fields
    const inputs = customerFields.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      if (input.name && input.value) {
        if (input.type === 'checkbox') {
          if (input.checked) {
            data[input.name] = input.value;
          }
        } else if (input.type === 'radio') {
          if (input.checked) {
            data[input.name] = input.value;
          }
        } else {
          data[input.name] = input.value;
        }
      }
    });
  }

  return data;
}

/**
 * Validates form data
 * @param {Object} formData - The form data to validate
 * @returns {Object} Validation result { isValid: boolean, errors: Array }
 */
export function validateFormData(formData) {
  const errors = [];

  // Add validation rules here as needed
  // Example validations:

  // Check if payment method is selected
  if (!formData.payment_method) {
    errors.push('Please select a payment method');
  }

  // Check if billing cycle is selected for subscriptions
  if (formData.billing_cycle === undefined && window.state?.isSubscription) {
    errors.push('Please select a billing cycle');
  }

  // Validate email if present in customer fields
  if (formData.email && !isValidEmail(formData.email)) {
    errors.push('Please enter a valid email address');
  }

  // Validate phone if present
  if (formData.phone && !isValidPhone(formData.phone)) {
    errors.push('Please enter a valid phone number');
  }

  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

/**
 * Helper function to validate email
 * @param {string} email 
 * @returns {boolean}
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Helper function to validate phone
 * @param {string} phone 
 * @returns {boolean}
 */
function isValidPhone(phone) {
  // Basic phone validation - adjust as needed
  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
}

/**
 * Serializes form data for logging/debugging
 * @param {Object} formData 
 * @returns {string}
 */
export function serializeFormData(formData) {
  return JSON.stringify(formData, null, 2);
}