/**
 * Billing Section JavaScript
 */

// Libraries
import { FormManager } from '__main_assets__/js/libs/form-manager.js';
import authorizedFetch from '__main_assets__/js/libs/authorized-fetch.js';
import { getPrerenderedIcon } from '__main_assets__/js/libs/prerendered-icons.js';

let webManager = null;
let appData = null;
let cancelFormManager = null;
let currentAccount = null;

// Cancellation reasons (will be shuffled on each render)
const CANCEL_REASONS = [
  'Too expensive',
  'Not using it enough',
  'Missing features I need',
  'Found a better alternative',
  'Technical issues or bugs',
  'Just testing or temporary need',
  'Other',
];

// Initialize billing section
export async function init(wm) {
  webManager = wm;
  setupActionButtons();
  setupCancellationForm();
}

// Load billing data
export async function loadData(account, sharedAppData) {
  if (!account) {
    return;
  }

  appData = sharedAppData;
  currentAccount = account;

  updatePlanCard(account);
  updateAlerts(account);
  updateBillingDetails(account);
  updateActionButtons(account);
  updateUsageInfo(account);
}

// Called when section is shown
export function onShow() {
  // Nothing needed
}

// ─── Plan Card ───────────────────────────────────────────────

function updatePlanCard(account) {
  const subscription = account.subscription || {};
  const $planStatus = document.getElementById('plan-status');
  const $planDescription = document.getElementById('plan-description');

  if (!$planStatus || !$planDescription) {
    return;
  }

  const productId = getProductId(subscription);
  const isPaid = productId !== 'basic';
  const displayName = getDisplayName(subscription);
  const status = getEffectiveStatus(subscription, isPaid);

  switch (status) {
    case 'free': {
      $planStatus.className = 'badge bg-secondary';
      $planStatus.textContent = 'Free';
      $planDescription.innerHTML = `You are currently on the <strong>${displayName}</strong> plan. Upgrade to unlock premium features.`;
      break;
    }
    case 'trialing':
    case 'cancelling':
    case 'active': {
      $planStatus.className = 'badge bg-success';
      $planStatus.textContent = 'Active';
      $planDescription.innerHTML = `You are currently on the <strong>${displayName}</strong> plan.`;
      break;
    }
    case 'suspended': {
      $planStatus.className = 'badge bg-danger';
      $planStatus.textContent = 'Suspended';
      $planDescription.innerHTML = `Your <strong>${displayName}</strong> subscription has been suspended and access has been revoked due to a payment issue. Please update your payment method to restore access.`;
      break;
    }
    case 'cancelled': {
      $planStatus.className = 'badge bg-secondary';
      $planStatus.textContent = 'Cancelled';
      $planDescription.innerHTML = `Your <strong>${displayName}</strong> subscription has ended. Resubscribe to regain access to premium features.`;
      break;
    }
    default: {
      $planStatus.className = 'badge bg-secondary';
      $planStatus.textContent = 'Free';
      $planDescription.innerHTML = `You are currently on the <strong>Free</strong> plan.`;
      break;
    }
  }
}

// ─── Alerts ──────────────────────────────────────────────────

function updateAlerts(account) {
  const $alerts = document.getElementById('billing-alerts');
  if (!$alerts) {
    return;
  }

  $alerts.innerHTML = '';
  const subscription = account.subscription || {};
  const productId = getProductId(subscription);
  const isPaid = productId !== 'basic';
  const status = getEffectiveStatus(subscription, isPaid);

  // Suspended (payment issue) alert
  if (status === 'suspended') {
    $alerts.innerHTML += `
      <div class="alert alert-danger d-flex align-items-start">
        <span class="me-2 flex-shrink-0">${getPrerenderedIcon('triangle-exclamation', 'fa-md')}</span>
        <div>
          <strong>Payment failed</strong>
          <p class="mb-0 small">Your payment method was declined. Please update your payment method to keep your subscription active.</p>
        </div>
      </div>
    `;
  }

  // Cancellation pending alert
  if (status === 'cancelling') {
    const cancelTimestamp = subscription.cancellation?.date?.timestampUNIX;
    const dateStr = cancelTimestamp && cancelTimestamp > 0
      ? new Date(cancelTimestamp * 1000).toLocaleDateString()
      : 'the end of your billing period';

    $alerts.innerHTML += `
      <div class="alert alert-warning d-flex align-items-start">
        <span class="me-2 flex-shrink-0">${getPrerenderedIcon('clock', 'fa-md')}</span>
        <div>
          <strong>Cancellation scheduled</strong>
          <p class="mb-0 small">Your subscription will end on <strong>${dateStr}</strong>. You'll continue to have full access until then. If you change your mind, you can reactivate through billing management.</p>
        </div>
      </div>
    `;
  }

  // Free trial alert
  if (status === 'trialing') {
    const trialEndUnix = subscription.trial?.expires?.timestampUNIX;
    const endDate = trialEndUnix && trialEndUnix > 0
      ? new Date(trialEndUnix * 1000).toLocaleDateString()
      : null;

    $alerts.innerHTML += `
      <div class="alert alert-success d-flex align-items-start">
        <span class="me-2 flex-shrink-0">${getPrerenderedIcon('circle-check', 'fa-md')}</span>
        <div>
          <strong>Free trial</strong>
          <p class="mb-0 small">You're on a free trial${endDate ? ` that ends on <strong>${endDate}</strong>` : ''}. You won't be charged until your trial ends.</p>
        </div>
      </div>
    `;
  }
}

// ─── Billing Details ─────────────────────────────────────────

function updateBillingDetails(account) {
  const subscription = account.subscription || {};
  const $details = document.getElementById('billing-details');

  if (!$details) {
    return;
  }

  const productId = getProductId(subscription);
  const isPaid = productId !== 'basic';
  const status = getEffectiveStatus(subscription, isPaid);

  // Only show billing details for paid, non-suspended, non-cancelled subscriptions
  if (!isPaid || status === 'suspended' || status === 'cancelled') {
    $details.classList.add('d-none');
    return;
  }

  const nextBillingUnix = subscription.expires?.timestampUNIX;
  const amount = subscription.payment?.price;
  const currency = appData?.payment?.currency || 'USD';
  const frequency = subscription.payment?.frequency;

  if (!nextBillingUnix || nextBillingUnix <= 0 || !amount) {
    $details.classList.add('d-none');
    return;
  }

  const nextDate = new Date(nextBillingUnix * 1000).toLocaleDateString();
  const formattedAmount = formatCurrency(amount, currency);
  const frequencyLabel = frequency === 'annually' || frequency === 'yearly' ? 'year' : 'month';

  $details.innerHTML = `
    <div class="row small text-muted">
      <div class="col-sm-6 mb-1">
        <strong>Next billing:</strong> ${nextDate}
      </div>
      <div class="col-sm-6 mb-1">
        <strong>Amount:</strong> ${formattedAmount} / ${frequencyLabel}
      </div>
    </div>
  `;
  $details.classList.remove('d-none');
}

// ─── Action Buttons ──────────────────────────────────────────

function updateActionButtons(account) {
  // Bindings handle the primary show/hide based on product.id (basic vs paid).
  // JS only needs to refine for cancelled/suspended edge cases.
  const subscription = account.subscription || {};
  const productId = getProductId(subscription);
  const isPaid = productId !== 'basic';
  const status = getEffectiveStatus(subscription, isPaid);

  const $upgradeBtn = document.getElementById('upgrade-plan-btn');
  const $changeBtn = document.getElementById('change-plan-btn');
  const $manageBtn = document.getElementById('manage-billing-btn');
  const $cancelTrigger = document.getElementById('cancel-subscription-trigger');

  if (status === 'cancelled') {
    // Cancelled: show upgrade, hide change/manage/cancel
    if ($upgradeBtn) $upgradeBtn.removeAttribute('hidden');
    if ($changeBtn) $changeBtn.setAttribute('hidden', '');
    if ($manageBtn) $manageBtn.setAttribute('hidden', '');
    if ($cancelTrigger) $cancelTrigger.setAttribute('hidden', '');
  } else if (status === 'suspended') {
    // Suspended: hide change, keep manage + cancel visible (bindings handle)
    if ($changeBtn) $changeBtn.setAttribute('hidden', '');
  }
}

function setupActionButtons() {
  const $upgradeBtn = document.getElementById('upgrade-plan-btn');
  const $changeBtn = document.getElementById('change-plan-btn');
  const $manageBtn = document.getElementById('manage-billing-btn');

  if ($upgradeBtn) {
    $upgradeBtn.addEventListener('click', () => {
      trackBilling('upgrade_click');
      window.location.href = '/pricing';
    });
  }

  if ($changeBtn) {
    $changeBtn.addEventListener('click', () => {
      trackBilling('change_plan_click');
      window.location.href = '/pricing';
    });
  }

  if ($manageBtn) {
    $manageBtn.addEventListener('click', () => {
      trackBilling('manage_billing_click');
      openStripePortal();
    });
  }
}

// ─── Stripe Portal ───────────────────────────────────────────

async function openStripePortal() {
  const $manageBtn = document.getElementById('manage-billing-btn');
  const $btnText = $manageBtn?.querySelector('.button-text');
  const originalText = $btnText?.textContent;

  try {
    // Show loading state
    if ($manageBtn) $manageBtn.disabled = true;
    if ($btnText) $btnText.textContent = 'Opening...';

    const response = await authorizedFetch(`${webManager.getApiUrl()}/backend-manager/user/subscription/portal`, {
      method: 'POST',
      timeout: 15000,
      response: 'json',
      body: {
        returnUrl: window.location.href,
      },
    });

    if (response.url) {
      window.open(response.url, '_blank');
    } else {
      throw new Error('No portal URL returned');
    }
  } catch (error) {
    console.warn('Failed to open Stripe portal, falling back to pricing page:', error);
    window.location.href = '/pricing';
  } finally {
    if ($manageBtn) $manageBtn.disabled = false;
    if ($btnText) $btnText.textContent = originalText;
  }
}

// ─── Cancellation Form ──────────────────────────────────────

function setupCancellationForm() {
  const $form = document.getElementById('cancel-subscription-form');
  if (!$form) {
    return;
  }

  // Populate randomized reasons
  populateCancelReasons();

  cancelFormManager = new FormManager('#cancel-subscription-form', {
    allowResubmit: false,
    warnOnUnsavedChanges: false,
    submittingText: 'Cancelling...',
    submittedText: 'Subscription Cancelled',
  });

  cancelFormManager.on('submit', async ({ data }) => {
    // Get selected reason
    const $selectedReason = document.querySelector('input[name="cancel_reason"]:checked');
    const reason = $selectedReason?.value || '';

    trackBilling('cancel_submit');

    const response = await authorizedFetch(`${webManager.getApiUrl()}/backend-manager/user/subscription/cancel`, {
      method: 'POST',
      timeout: 30000,
      response: 'json',
      body: {
        reason: reason,
        feedback: data.feedback || '',
        confirmed: true,
      },
    });

    if (response.error) {
      throw new Error(response.message || 'Failed to cancel subscription. Please try again.');
    }

    cancelFormManager.showSuccess('Your subscription has been cancelled. You\'ll continue to have access until the end of your current billing period.');

    // Collapse the cancel form after a short delay
    setTimeout(() => {
      const $accordion = document.getElementById('cancel-subscription-accordion');
      if ($accordion) {
        const bsCollapse = bootstrap.Collapse.getInstance($accordion);
        if (bsCollapse) bsCollapse.hide();
      }
    }, 3000);

    // Update the UI to reflect cancellation (using backend structure)
    if (currentAccount?.subscription) {
      const expiresUnix = currentAccount.subscription.expires?.timestampUNIX || 0;
      currentAccount.subscription.cancellation = {
        pending: true,
        date: {
          timestamp: new Date(expiresUnix * 1000).toISOString(),
          timestampUNIX: expiresUnix,
        },
      };
      updatePlanCard(currentAccount);
      updateAlerts(currentAccount);
      updateBillingDetails(currentAccount);
      updateActionButtons(currentAccount);
    }
  });
}

function populateCancelReasons() {
  const $container = document.getElementById('cancel-reasons-container');
  if (!$container) {
    return;
  }

  const shuffled = shuffleArray([...CANCEL_REASONS]);

  $container.innerHTML = shuffled.map((reason, i) => `
    <div class="form-check mb-2">
      <input class="form-check-input" type="radio" name="cancel_reason" id="cancel-reason-${i}" value="${reason}">
      <label class="form-check-label" for="cancel-reason-${i}">${reason}</label>
    </div>
  `).join('');
}

// ─── Usage Metrics ───────────────────────────────────────────

function updateUsageInfo(account) {
  const subscription = account.subscription || {};
  const $container = document.getElementById('usage-metrics-container');

  if (!$container) {
    return;
  }

  // Determine effective product for usage limits
  // If subscription isn't actively paid, use basic plan limits
  const productId = getProductId(subscription);
  const isPaid = productId !== 'basic';
  const status = getEffectiveStatus(subscription, isPaid);
  const hasActiveAccess = status === 'active' || status === 'trialing' || status === 'cancelling';
  const effectiveProductId = (isPaid && hasActiveAccess) ? productId : 'basic';
  const product = appData?.payment?.products?.find(p => p.id === effectiveProductId);
  const limits = product?.limits || {};

  // Clear container
  $container.innerHTML = '';

  // Get product limits from app data
  if (!product || !limits || Object.keys(limits).length === 0) {
    $container.innerHTML = '<div class="text-muted">Usage tracking not available for this plan.</div>';
    return;
  }

  // Get actual usage from account
  const usage = account.usage || {};

  // Create a usage bar for each metric in limits
  Object.entries(limits).forEach(([metricId, limit]) => {
    const metricUsage = usage[metricId] || {};
    const used = metricUsage.period || 0;

    const usagePercent = Math.min(100, Math.round((used / limit) * 100));

    let progressClass = 'bg-success';
    if (usagePercent >= 80) {
      progressClass = 'bg-danger';
    } else if (usagePercent >= 50) {
      progressClass = 'bg-warning';
    }

    const metricName = formatMetricName(metricId);
    const formattedUsed = formatMetricValue(metricId, used);
    const formattedLimit = formatMetricValue(metricId, limit);

    $container.innerHTML += `
      <div class="mb-3">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <small class="text-muted fw-semibold">${metricName}</small>
          <small class="text-muted">${formattedUsed} / ${formattedLimit}</small>
        </div>
        <div class="progress" style="height: 20px;">
          <div class="progress-bar ${progressClass}" role="progressbar"
               style="width: ${usagePercent}%"
               aria-valuenow="${usagePercent}"
               aria-valuemin="0"
               aria-valuemax="100">
            ${usagePercent}%
          </div>
        </div>
      </div>
    `;
  });

  if ($container.innerHTML === '') {
    $container.innerHTML = '<div class="text-muted">No usage data available.</div>';
  }
}

// ─── Helpers ─────────────────────────────────────────────────

function getProductId(subscription) {
  return subscription.product?.id || 'basic';
}

function getDisplayName(subscription) {
  // Use backend-provided product name first
  if (subscription.product?.name && subscription.product.name !== 'Basic') {
    return subscription.product.name;
  }

  // Fall back to appData product name
  const productId = subscription.product?.id || 'basic';
  const product = appData?.payment?.products?.find(p => p.id === productId);
  return product?.name || 'Free';
}

function getEffectiveStatus(subscription, isPaid) {
  if (!isPaid) {
    return 'free';
  }

  if (subscription.status === 'suspended') {
    return 'suspended';
  }

  if (subscription.cancellation?.pending && subscription.status === 'active') {
    return 'cancelling';
  }

  if (subscription.status === 'active' && subscription.trial?.claimed
    && subscription.trial?.expires?.timestampUNIX > Math.floor(Date.now() / 1000)) {
    return 'trialing';
  }

  if (subscription.status === 'active') {
    return 'active';
  }

  if (subscription.status === 'cancelled') {
    return 'cancelled';
  }

  return 'free';
}

function formatCurrency(amount, currency) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: (currency || 'USD').toUpperCase(),
  }).format(amount); // amount is already in display dollars
}

function formatMetricName(metricId) {
  const names = {
    requests: 'API Requests',
    tokens: 'Tokens',
    storage: 'Storage',
    bandwidth: 'Bandwidth',
    users: 'Users',
    projects: 'Projects',
  };
  return names[metricId] || metricId.charAt(0).toUpperCase() + metricId.slice(1);
}

function formatMetricValue(metricId, value) {
  if (metricId === 'storage' || metricId === 'bandwidth') {
    return formatBytes(value);
  }
  return value.toLocaleString();
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) {
    return '0 Bytes';
  }

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── Tracking ────────────────────────────────────────────────

function trackBilling(action) {
  gtag('event', 'billing_action', {
    action: action,
  });
  fbq('trackCustom', 'BillingAction', {
    action: action,
  });
  ttq.track('ViewContent', {
    content_id: `billing-${action}`,
    content_type: 'product',
    content_name: `Billing ${action}`,
  });
}
