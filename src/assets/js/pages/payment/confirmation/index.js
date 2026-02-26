// Payment Confirmation Page
import { state, buildBindingsState } from './modules/state.js';
import { trackPurchaseIfNeeded } from './modules/tracking.js';
import { triggerCelebration } from './modules/celebration.js';

let webManager = null;

/* Test URL
  https://localhost:3000/payment/confirmation?orderId=ORD-TRIAL-123&productId=pro&productName=Pro%20Plan&amount=0&currency=USD&frequency=annually&paymentMethod=stripe&trial=true&track=true
*/

// Module export
export default (Manager) => {
  return new Promise(async function (resolve) {
    webManager = Manager.webManager;
    await webManager.dom().ready();
    await initializeConfirmation();
    return resolve();
  });
};

// Update UI via bindings (single source of truth)
function updateUI() {
  webManager.bindings().update(buildBindingsState());
}

// Initialize confirmation page
async function initializeConfirmation() {
  // Parse URL params into state
  parseUrlParams();

  // Update UI with loaded data
  updateUI();

  // Track purchase (if track=true param present)
  // trackPurchaseIfNeeded(state, webManager);

  // Trigger celebration animation
  await triggerCelebration(webManager);
}

// Parse URL parameters into minimal state
function parseUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);

  state.orderId = urlParams.get('orderId') || '';
  state.productId = urlParams.get('productId') || '';
  state.productName = urlParams.get('productName') || '';
  state.amount = parseFloat(urlParams.get('amount') || 0);
  state.currency = urlParams.get('currency') || 'USD';
  state.frequency = urlParams.get('frequency') || '';
  state.paymentMethod = urlParams.get('paymentMethod') || '';
  state.hasFreeTrial = urlParams.get('trial') === 'true';
  state.loaded = true;
}
