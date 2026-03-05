/**
 * Billing Section JavaScript
 */

// Libraries
import { FormManager } from '__main_assets__/js/libs/form-manager.js';
import authorizedFetch from '__main_assets__/js/libs/authorized-fetch.js';

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

// Status display configuration
const STATUS_CONFIG = {
  free:       { label: 'Free',      badgeClass: 'badge bg-secondary' },
  active:     { label: 'Active',    badgeClass: 'badge bg-success' },
  trialing:   { label: 'Active',    badgeClass: 'badge bg-success' },
  cancelling: { label: 'Active',    badgeClass: 'badge bg-success' },
  suspended:  { label: 'Suspended', badgeClass: 'badge bg-danger' },
  cancelled:  { label: 'Cancelled', badgeClass: 'badge bg-secondary' },
};

const FREQUENCY_LABELS = { daily: 'day', weekly: 'week', monthly: 'month', annually: 'year' };

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

  updateUI(account);
}

// Called when section is shown
export function onShow() {
  // Nothing needed
}

// ─── UI Update ──────────────────────────────────────────────

/* @dev-only:start */
{
  window._billing = {
    test: (account) => updateUI(account),
    state: () => buildBillingState(currentAccount),
    restore: () => { if (currentAccount) updateUI(currentAccount); },
  };
}
/* @dev-only:end */

function updateUI(account) {
  webManager.bindings().update(buildBillingState(account));
  updateUsageInfo(account);
}

function buildBillingState(account) {
  const subscription = account?.subscription || {};
  const productId = getProductId(subscription);
  const isPaid = productId !== 'basic';
  const status = getEffectiveStatus(subscription, isPaid);
  const displayName = getDisplayName(subscription);
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.free;

  // Pre-format alert dates
  const cancelTimestamp = subscription.cancellation?.date?.timestampUNIX;
  const cancelDate = (cancelTimestamp && cancelTimestamp > 0)
    ? new Date(cancelTimestamp * 1000).toLocaleDateString()
    : 'the end of your billing period';

  const trialEndUnix = subscription.trial?.expires?.timestampUNIX;
  const trialEndDate = (trialEndUnix && trialEndUnix > 0)
    ? new Date(trialEndUnix * 1000).toLocaleDateString()
    : null;

  // Pre-format billing details
  const nextBillingUnix = subscription.expires?.timestampUNIX;
  const amount = subscription.payment?.price;
  const currency = appData?.payment?.currency || 'USD';
  const frequency = subscription.payment?.frequency;
  const hasValidBilling = nextBillingUnix && nextBillingUnix > 0 && amount;

  return {
    billing: {
      plan: {
        name: displayName,
      },
      status: {
        label: config.label,
        badgeClass: config.badgeClass,
      },
      description: {
        free: status === 'free',
        active: status === 'active' || status === 'trialing' || status === 'cancelling',
        suspended: status === 'suspended',
        cancelled: status === 'cancelled',
      },
      alerts: {
        suspended: status === 'suspended',
        cancelling: status === 'cancelling',
        trialing: status === 'trialing',
        cancelDate: cancelDate,
        trialEndDate: trialEndDate || '',
        trialHasEndDate: !!trialEndDate,
      },
      details: {
        visible: isPaid && status !== 'suspended' && status !== 'cancelled' && !!hasValidBilling,
        nextDate: hasValidBilling ? new Date(nextBillingUnix * 1000).toLocaleDateString() : '',
        amount: hasValidBilling ? `${formatCurrency(amount, currency)} / ${FREQUENCY_LABELS[frequency] || 'month'}` : '',
      },
      buttons: {
        upgrade: !isPaid || status === 'cancelled',
        change: isPaid && status !== 'cancelled' && status !== 'suspended',
        manage: isPaid && status !== 'cancelled',
        cancel: isPaid && status !== 'cancelled' && status !== 'suspended',
      },
    },
  };
}

// ─── Action Buttons ──────────────────────────────────────────

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
      openBillingPortal();
    });
  }
}

// ─── Billing Portal ─────────────────────────────────────────

async function openBillingPortal() {
  const $manageBtn = document.getElementById('manage-billing-btn');
  const $btnText = $manageBtn?.querySelector('.button-text');
  const originalText = $btnText?.textContent;

  try {
    // Show loading state
    if ($manageBtn) $manageBtn.disabled = true;
    if ($btnText) $btnText.textContent = 'Opening...';

    const response = await authorizedFetch(`${webManager.getApiUrl()}/backend-manager/payments/portal`, {
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
    console.error('Failed to open billing portal:', error);
    webManager.utilities().showNotification(error.message || 'Failed to open billing portal. Please try again later.', 'danger');
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

    const response = await authorizedFetch(`${webManager.getApiUrl()}/backend-manager/payments/cancel`, {
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

    // Detect trial cancellation: trial was active and trial period equals subscription period
    const sub = currentAccount?.subscription;
    const isTrialCancel = sub?.trial?.claimed === true
      && sub?.trial?.expires?.timestampUNIX === sub?.expires?.timestampUNIX;

    if (isTrialCancel) {
      cancelFormManager.showSuccess('Your trial has been cancelled. You\'ve been moved to the free plan. You can subscribe again anytime.');
    } else {
      cancelFormManager.showSuccess('Your subscription has been cancelled. You\'ll continue to have access until the end of your current billing period.');
    }

    // Collapse the cancel form after a short delay
    setTimeout(() => {
      const $accordion = document.getElementById('cancel-subscription-accordion');
      if ($accordion) {
        const bsCollapse = bootstrap.Collapse.getInstance($accordion);
        if (bsCollapse) bsCollapse.hide();
      }
    }, 1000);

    // Update the UI to reflect cancellation (using backend structure)
    if (sub) {
      if (isTrialCancel) {
        // Trial cancellations are immediate — set status to cancelled
        sub.status = 'cancelled';
        sub.cancellation = {
          pending: false,
          date: {
            timestamp: new Date().toISOString(),
            timestampUNIX: Math.floor(Date.now() / 1000),
          },
        };
      } else {
        // Non-trial cancellations are pending until end of billing period
        const expiresUnix = sub.expires?.timestampUNIX || 0;
        sub.cancellation = {
          pending: true,
          date: {
            timestamp: new Date(expiresUnix * 1000).toISOString(),
            timestampUNIX: expiresUnix,
          },
        };
      }
      updateUI(currentAccount);
    }
  });
}

function populateCancelReasons() {
  const $container = document.getElementById('cancel-reasons-container');
  if (!$container) {
    return;
  }

  const reasons = [...CANCEL_REASONS];
  const other = reasons.pop(); // Remove 'Other' from the end
  const shuffled = [...shuffleArray(reasons), other]; // Shuffle rest, append 'Other' last

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
