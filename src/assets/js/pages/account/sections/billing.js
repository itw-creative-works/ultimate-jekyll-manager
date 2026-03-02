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

  // Determine product info
  const productId = getProductId(subscription);
  const isPaid = productId !== 'basic';
  const displayName = getDisplayName(productId, isPaid);

  // Set status badge and description
  if (!$planStatus || !$planDescription) {
    return;
  }

  const status = getEffectiveStatus(subscription, isPaid);

  switch (status) {
    case 'free': {
      $planStatus.className = 'badge bg-secondary';
      $planStatus.textContent = 'Free';
      $planDescription.innerHTML = `You are currently on the <strong>${displayName}</strong> plan. Upgrade to unlock premium features.`;
      break;
    }
    case 'active': {
      $planStatus.className = 'badge bg-success';
      $planStatus.textContent = 'Active';
      $planDescription.innerHTML = `You are currently on the <strong>${displayName}</strong> plan.`;
      break;
    }
    case 'trialing': {
      const daysLeft = getTrialDaysLeft(subscription);
      $planStatus.className = 'badge bg-info';
      $planStatus.textContent = daysLeft > 0 ? `Trial (${daysLeft} days left)` : 'Trial';
      $planDescription.innerHTML = `You're trialing the <strong>${displayName}</strong> plan.`;
      break;
    }
    case 'cancelling': {
      const daysLeft = getCancellationDaysLeft(subscription);
      $planStatus.className = 'badge bg-warning text-body';
      $planStatus.textContent = daysLeft > 0 ? `Cancelling (${daysLeft} days left)` : 'Cancelling';
      $planDescription.innerHTML = `Your <strong>${displayName}</strong> plan is set to cancel. You still have access until the end of your billing period.`;
      break;
    }
    case 'payment_issue': {
      $planStatus.className = 'badge bg-danger';
      $planStatus.textContent = 'Payment Issue';
      $planDescription.innerHTML = `Your <strong>${displayName}</strong> plan has a payment issue. Please update your payment method to avoid losing access.`;
      break;
    }
    case 'cancelled': {
      $planStatus.className = 'badge bg-secondary';
      $planStatus.textContent = 'Cancelled';
      $planDescription.innerHTML = `Your <strong>${displayName}</strong> subscription has ended. Resubscribe to regain access to premium features.`;
      break;
    }
    case 'expired': {
      $planStatus.className = 'badge bg-secondary';
      $planStatus.textContent = 'Expired';
      $planDescription.innerHTML = `Your <strong>${displayName}</strong> subscription has expired. Subscribe again to regain access.`;
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

  // Payment issue alert
  if (status === 'payment_issue') {
    const message = subscription.paymentIssue?.message || 'Your payment method was declined.';
    const attempts = subscription.paymentIssue?.attempts || 0;
    const nextRetry = subscription.paymentIssue?.nextRetry;
    let retryText = '';
    if (nextRetry) {
      retryText = ` Next retry: ${new Date(nextRetry).toLocaleDateString()}.`;
    }

    $alerts.innerHTML += `
      <div class="alert alert-danger d-flex align-items-start">
        <span class="me-2 flex-shrink-0">${getPrerenderedIcon('triangle-exclamation', 'fa-md')}</span>
        <div>
          <strong>Payment failed</strong> ${attempts > 1 ? `(${attempts} attempts)` : ''}
          <p class="mb-0 small">${message}${retryText} Please update your payment method to keep your subscription active.</p>
        </div>
      </div>
    `;
  }

  // Cancellation pending alert
  if (status === 'cancelling') {
    const effectiveDate = subscription.cancellation?.effectiveAt;
    const dateStr = effectiveDate
      ? new Date(effectiveDate * 1000).toLocaleDateString()
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

  // Trial ending soon alert (last 3 days)
  if (status === 'trialing') {
    const daysLeft = getTrialDaysLeft(subscription);
    if (daysLeft > 0 && daysLeft <= 3) {
      $alerts.innerHTML += `
        <div class="alert alert-info d-flex align-items-start">
          <span class="me-2 flex-shrink-0">${getPrerenderedIcon('clock', 'fa-md')}</span>
          <div>
            <strong>Trial ending soon</strong>
            <p class="mb-0 small">Your free trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Upgrade now to keep access to premium features.</p>
          </div>
        </div>
      `;
    }
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

  // Only show billing details for paid subscriptions with billing info
  if (!isPaid || !subscription.billing || subscription.paymentIssue?.hasIssue) {
    $details.classList.add('d-none');
    return;
  }

  const nextBilling = subscription.billing.nextBillingDate;
  const amount = subscription.billing.amount;
  const currency = subscription.billing.currency || 'usd';
  const frequency = subscription.frequency || (subscription.billing.interval === 1 ? 'monthly' : 'annually');

  if (!nextBilling || !amount) {
    $details.classList.add('d-none');
    return;
  }

  const nextDate = new Date(nextBilling * 1000).toLocaleDateString();
  const formattedAmount = formatCurrency(amount, currency);
  const frequencyLabel = frequency === 'annually' || frequency === 'yearly' ? 'year' : 'month';

  let html = '';

  if (subscription.cancellation?.requested) {
    // Cancellation pending — don't show "next billing"
    html = '';
  } else {
    html = `
      <div class="row small text-muted">
        <div class="col-sm-6 mb-1">
          <strong>Next billing:</strong> ${nextDate}
        </div>
        <div class="col-sm-6 mb-1">
          <strong>Amount:</strong> ${formattedAmount} / ${frequencyLabel}
        </div>
      </div>
    `;
  }

  if (html) {
    $details.innerHTML = html;
    $details.classList.remove('d-none');
  } else {
    $details.classList.add('d-none');
  }
}

// ─── Action Buttons ──────────────────────────────────────────

function updateActionButtons(account) {
  const subscription = account.subscription || {};
  const productId = getProductId(subscription);
  const isPaid = productId !== 'basic';
  const status = getEffectiveStatus(subscription, isPaid);

  // Hide all action buttons first
  document.querySelectorAll('.plan-action-btn').forEach(btn => btn.classList.add('d-none'));

  const $upgradeBtn = document.getElementById('upgrade-plan-btn');
  const $changeBtn = document.getElementById('change-plan-btn');
  const $manageBtn = document.getElementById('manage-billing-btn');
  const $cancelTrigger = document.getElementById('cancel-subscription-trigger');

  switch (status) {
    case 'free':
      if ($upgradeBtn) $upgradeBtn.classList.remove('d-none');
      if ($cancelTrigger) $cancelTrigger.classList.add('d-none');
      break;

    case 'active':
      if ($changeBtn) $changeBtn.classList.remove('d-none');
      if ($manageBtn) $manageBtn.classList.remove('d-none');
      if ($cancelTrigger) $cancelTrigger.classList.remove('d-none');
      break;

    case 'trialing':
      if ($upgradeBtn) $upgradeBtn.classList.remove('d-none');
      if ($cancelTrigger) $cancelTrigger.classList.remove('d-none');
      break;

    case 'cancelling':
      if ($manageBtn) $manageBtn.classList.remove('d-none');
      if ($cancelTrigger) $cancelTrigger.classList.add('d-none');
      break;

    case 'payment_issue':
      if ($manageBtn) $manageBtn.classList.remove('d-none');
      if ($cancelTrigger) $cancelTrigger.classList.remove('d-none');
      break;

    case 'cancelled':
    case 'expired':
      if ($upgradeBtn) $upgradeBtn.classList.remove('d-none');
      if ($cancelTrigger) $cancelTrigger.classList.add('d-none');
      break;

    default:
      if ($upgradeBtn) $upgradeBtn.classList.remove('d-none');
      if ($cancelTrigger) $cancelTrigger.classList.add('d-none');
      break;
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
  const $checkbox = document.getElementById('cancel-confirm-checkbox');
  const $submitBtn = document.getElementById('cancel-subscription-btn');

  if (!$form || !$checkbox || !$submitBtn) {
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

  // Enable/disable submit based on checkbox
  $checkbox.addEventListener('change', () => {
    $submitBtn.disabled = !$checkbox.checked;
  });

  cancelFormManager.on('submit', async ({ data }) => {
    if (!$checkbox.checked) {
      throw new Error('Please confirm the cancellation terms before proceeding.');
    }

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

    // Update the UI to reflect cancellation
    if (currentAccount?.subscription) {
      currentAccount.subscription.cancellation = {
        requested: true,
        requestedAt: Date.now(),
        effectiveAt: currentAccount.subscription.billing?.currentPeriodEnd || null,
        reason: reason,
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

  // Get the user's current plan/product
  const productId = getProductId(subscription);
  const product = appData?.payment?.products?.find(p => p.id === productId);
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
  return subscription.product?.id || subscription.product || 'basic';
}

function getDisplayName(productId, isPaid) {
  const product = appData?.payment?.products?.find(p => p.id === productId);
  return product?.name
    || (isPaid ? productId.charAt(0).toUpperCase() + productId.slice(1) : 'Free');
}

function getEffectiveStatus(subscription, isPaid) {
  if (!isPaid) {
    return 'free';
  }

  if (subscription.status === 'suspended' || subscription.paymentIssue?.hasIssue) {
    return 'payment_issue';
  }

  if (subscription.cancellation?.requested && subscription.status === 'active') {
    return 'cancelling';
  }

  if (subscription.status === 'active' || subscription.access === true) {
    return 'active';
  }

  if (subscription.status === 'trialing') {
    return 'trialing';
  }

  if (subscription.status === 'cancelled') {
    return 'cancelled';
  }

  if (subscription.status === 'expired') {
    return 'expired';
  }

  return 'free';
}

function getTrialDaysLeft(subscription) {
  const trialEnd = subscription.trial?.endedAt || subscription.trial?.expires?.timestamp;
  if (!trialEnd) {
    return 0;
  }
  return Math.max(0, Math.ceil((new Date(trialEnd) - new Date()) / (1000 * 60 * 60 * 24)));
}

function getCancellationDaysLeft(subscription) {
  const effectiveAt = subscription.cancellation?.effectiveAt;
  if (!effectiveAt) {
    return 0;
  }
  // effectiveAt is in Unix seconds
  return Math.max(0, Math.ceil((effectiveAt * 1000 - Date.now()) / (1000 * 60 * 60 * 24)));
}

function formatCurrency(amountInCents, currency) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amountInCents / 100);
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
