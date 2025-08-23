// Billing section module
let webManager = null;
let appData = null;

// Initialize billing section
export async function init(wm) {
  webManager = wm;
  setupButtons();
}

// Load billing data
export async function loadData(account, sharedAppData) {
  if (!account) return;

  // Use shared app data
  appData = sharedAppData;

  updatePlanInfo(account);
  updateBillingDetails(account);
  updateUsageInfo(account);
}

// Update plan information
function updatePlanInfo(account) {
  const subscription = account.subscription;
  const $planName = document.getElementById('current-plan-name');
  const $planStatus = document.getElementById('plan-status');
  const $upgradeBtn = document.getElementById('upgrade-plan-btn');

  if ($planName) {
    // Get the product ID
    const productId = subscription.product || subscription.id || 'free';
    
    // Look up the product name from appData
    let displayName = 'Free';
    if (appData?.products?.[productId]) {
      displayName = appData.products[productId].name || productId;
    } else if (productId !== 'free') {
      // Fallback to capitalizing the product ID if no name found
      displayName = productId.charAt(0).toUpperCase() + productId.slice(1);
    }
    
    $planName.textContent = displayName;
  }

  if ($planStatus) {
    // Check subscription status
    if (subscription.status === 'suspended' || subscription.paymentIssue?.hasIssue) {
      $planStatus.innerHTML = '<span class="badge bg-danger">Payment Issue</span>';
      if ($upgradeBtn) $upgradeBtn.textContent = 'Update Payment Method';

      // Show payment issue message if available
      if (subscription.paymentIssue?.message) {
        const $billingDetails = document.getElementById('billing-details');
        if ($billingDetails) {
          $billingDetails.innerHTML = `
            <div class="alert alert-danger mb-3">
              <strong>Payment Failed:</strong> ${subscription.paymentIssue.message}
            </div>
          `;
        }
      }
    } else if (subscription.cancellation?.requested && subscription.status === 'active') {
      // Active but cancellation requested
      const cancelDate = subscription.cancellation.effectiveAt;
      $planStatus.innerHTML = '<span class="badge bg-warning">Cancelling</span>';
      if (cancelDate) {
        const daysLeft = Math.ceil((cancelDate * 1000 - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysLeft > 0) {
          $planStatus.innerHTML += ` <small class="text-muted">Ends in ${daysLeft} days</small>`;
        }
      }
      if ($upgradeBtn) $upgradeBtn.textContent = 'Resume Subscription';
    } else if (subscription.status === 'active' || subscription.access === true) {
      $planStatus.innerHTML = '<span class="badge bg-success">Active</span>';
      if ($upgradeBtn) $upgradeBtn.textContent = 'Manage Plan';
    } else if (subscription.status === 'trialing') {
      const trialEnd = subscription.trial?.endedAt || subscription.trial?.expires?.timestamp;
      $planStatus.innerHTML = `<span class="badge bg-info">Trial</span>`;
      if (trialEnd) {
        const daysLeft = Math.ceil((new Date(trialEnd) - new Date()) / (1000 * 60 * 60 * 24));
        if (daysLeft > 0) {
          $planStatus.innerHTML += ` <small class="text-muted">${daysLeft} days left</small>`;
        }
      }
      if ($upgradeBtn) $upgradeBtn.textContent = 'Upgrade Now';
    } else if (subscription.status === 'cancelled') {
      $planStatus.innerHTML = '<span class="badge bg-secondary">Cancelled</span>';
      if ($upgradeBtn) $upgradeBtn.textContent = 'Reactivate Plan';
    } else {
      $planStatus.innerHTML = '<span class="badge bg-secondary">Basic</span>';
      if ($upgradeBtn) $upgradeBtn.textContent = 'Upgrade Plan';
    }
  }
}

// Update billing details
function updateBillingDetails(account) {
  const subscription = account.subscription;

  // Update billing details if subscription is active and no payment issues
  if (subscription.billing && !subscription.paymentIssue?.hasIssue) {
    const $billingDetails = document.getElementById('billing-details');
    if ($billingDetails) {
      const nextBilling = subscription.billing.nextBillingDate;
      const amount = subscription.billing.amount;
      const currency = subscription.billing.currency || 'usd';
      const frequency = subscription.frequency || subscription.billing.interval;

      let billingHTML = '';
      if (nextBilling && amount) {
        const nextDate = new Date(nextBilling * 1000).toLocaleDateString();
        const formattedAmount = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: currency.toUpperCase()
        }).format(amount / 100);

        // Check if cancellation is requested
        if (subscription.cancellation?.requested) {
          billingHTML = `
            <div class="alert alert-warning mb-3">
              <strong>Subscription ending:</strong> Your subscription will end on ${nextDate}.
              You'll continue to have access until then.
            </div>
          `;
        } else {
          billingHTML = `
            <p class="mb-1"><strong>Next billing:</strong> ${nextDate}</p>
            <p class="mb-1"><strong>Amount:</strong> ${formattedAmount} / ${frequency}</p>
          `;
        }
      }
      $billingDetails.innerHTML = billingHTML;
    }
  }
}


// Update usage information
function updateUsageInfo(account) {
  const subscription = account.subscription || {};
  const $container = document.getElementById('usage-metrics-container');

  if (!$container) return;

  // Get the user's current plan/product
  const productId = subscription.product;
  const product = appData?.products?.[productId];
  const limits = product?.limits || {};

  // Clear container
  $container.innerHTML = '';

  // Get product limits from app data
  if (!product || !limits || Object.keys(limits).length === 0) {
    $container.innerHTML = '<div class="text-muted">Usage tracking not available for this plan</div>';
    return;
  }

  // Get actual usage from account
  let usage = account.usage || {};

  // Test - fake some random usage data
  // usage = {
  //   requests: { period: Math.floor(Math.random() * 800) + 100 },  // Random between 100-900
  //   tokens: { period: Math.floor(Math.random() * 4) + 1 },        // Random between 1-5
  //   storage: { period: Math.floor(Math.random() * 900000000) + 100000000 }, // Random MB
  //   bandwidth: { period: Math.floor(Math.random() * 2000000000) + 500000000 }, // Random MB
  // };
  // console.log('Using fake usage data:', usage);

  // Create a usage bar for each metric in limits
  Object.entries(limits).forEach(([metricId, limit]) => {
    // Get the current period usage for this metric
    const metricUsage = usage[metricId] || {};
    const used = metricUsage.period || 0;

    // Calculate percentage
    const usagePercent = Math.min(100, Math.round((used / limit) * 100));

    // Determine progress bar color
    let progressClass = 'bg-success';
    if (usagePercent >= 80) {
      progressClass = 'bg-danger';
    } else if (usagePercent >= 50) {
      progressClass = 'bg-warning';
    }

    // Format the metric name for display
    const metricName = formatMetricName(metricId);

    // Format the values based on metric type
    const formattedUsed = formatMetricValue(metricId, used);
    const formattedLimit = formatMetricValue(metricId, limit);

    // Create the metric HTML
    const metricHTML = `
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

    $container.innerHTML += metricHTML;
  });

  // If no metrics were added, show a message
  if ($container.innerHTML === '') {
    $container.innerHTML = '<div class="text-muted">No usage data available</div>';
  }
}

// Format metric name for display
function formatMetricName(metricId) {
  const names = {
    requests: 'API Requests',
    tokens: 'Tokens',
    storage: 'Storage',
    bandwidth: 'Bandwidth',
    users: 'Users',
    projects: 'Projects',
    // Add more metric name mappings as needed
  };

  return names[metricId] || metricId.charAt(0).toUpperCase() + metricId.slice(1);
}

// Format metric value based on type
function formatMetricValue(metricId, value) {
  // Handle different metric types
  if (metricId === 'storage' || metricId === 'bandwidth') {
    return formatBytes(value);
  }

  // Default to number with commas
  return value.toLocaleString();
}

// Helper function to format bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Setup button handlers
function setupButtons() {
  const $upgradeBtn = document.getElementById('upgrade-plan-btn');

  if ($upgradeBtn) {
    $upgradeBtn.addEventListener('click', handleUpgradeClick);
  }
}

// Handle upgrade button click
function handleUpgradeClick(event) {
  const buttonText = event.target.textContent;

  // Route to appropriate action based on button text
  switch(buttonText) {
    case 'Update Payment Method':
      window.location.href = '/payment/update';
      break;
    case 'Resume Subscription':
      // Handle subscription resumption
      console.log('Resume subscription');
      break;
    case 'Reactivate Plan':
      window.location.href = '/pricing';
      break;
    case 'Upgrade Plan':
    case 'Upgrade Now':
    case 'Manage Plan':
    default:
      window.location.href = '/pricing';
      break;
  }
}
