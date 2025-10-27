// Confirmation Bindings Module
import { state } from './state.js';

// Get the COMPLETE confirmation bindings object
// State IS the bindings - no transformation needed
export function getCompleteConfirmationBindings() {
  // Just return state directly - it's already structured correctly
  return state;
}

// Update all UI through bindings
// ALWAYS passes the COMPLETE confirmation object
export function updateAllUI(webManager) {
  const bindingsData = getCompleteConfirmationBindings();

  console.log('🔄 Updating confirmation bindings with data:', bindingsData);

  webManager.bindings().update(bindingsData);
}

// Initialize confirmation UI with loading states
export function initializeConfirmationUI() {
  console.log('🚀 Initializing confirmation UI');

  // State is already initialized with default values
  // We'll update bindings once after data is loaded
  state.confirmation.loaded = false;
}
