// Form validation for checkout
import { state } from './state.js';

// Validate form
export function validateForm(webManager) {
  const paymentForm = document.querySelector(`#payment-form-${state.paymentMethod} form`);
  
  // Validate email - get from authenticated user
  const user = webManager.auth().getUser();
  if (!user || !user.email) {
    console.error('User email not available');
    return false;
  }

  // Validate payment form if it exists
  if (paymentForm && !paymentForm.checkValidity()) {
    paymentForm.reportValidity();
    return false;
  }

  return true;
}

// Format card number
export function formatCardNumber(input) {
  let value = input.value.replace(/\s/g, '');
  let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
  input.value = formattedValue;
}

// Format expiry date
export function formatExpiryDate(input) {
  let value = input.value.replace(/\D/g, '');
  if (value.length >= 2) {
    value = value.slice(0, 2) + ' / ' + value.slice(2, 4);
  }
  input.value = value;
}