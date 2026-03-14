/**
 * Admin Dashboard Page JavaScript
 */

// Libraries
import { getPrerenderedIcon } from '__main_assets__/js/libs/prerendered-icons.js';
import authorizedFetch from '__main_assets__/js/libs/authorized-fetch.js';
import { formatTimeAgo, capitalize, escapeHtml, setStatValue } from '__main_assets__/js/libs/admin-helpers.js';
import { Chart, DoughnutController, BarController, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';

// Register Chart.js components
Chart.register(DoughnutController, BarController, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

// State
let webManager = null;
let planChart = null;
let frequencyChart = null;

// Module
export default (Manager) => {
  return new Promise(async function (resolve) {
    webManager = Manager.webManager;

    await webManager.dom().ready();

    webManager.auth().listen({ once: true }, async (state) => {
      if (!state.user) {
        showUnauthenticated();
        return;
      }

      loadDashboard();
      initTools();
    });

    return resolve();
  });
};

// Show unauthenticated state
function showUnauthenticated() {
  // Replace all spinners with sign-in message
  document.querySelectorAll('.spinner-border').forEach((spinner) => {
    const container = spinner.closest('.card-body') || spinner.parentElement;
    spinner.replaceWith(Object.assign(document.createElement('span'), {
      className: 'text-muted small',
      textContent: 'Sign in to view',
    }));
  });
}

// Load all dashboard data in parallel
async function loadDashboard() {
  const results = await Promise.allSettled([
    loadStatCards(),
    loadSubscriberData(),
    loadRecentUsers(),
    loadRecentOrders(),
  ]);

  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`Dashboard widget ${i} failed:`, result.reason);
    }
  });
}

// ============================================
// Stat Cards
// ============================================
async function loadStatCards() {
  const { collection, query, where, getCountFromServer } = await import('firebase/firestore');
  const db = webManager.firebaseFirestore;
  const now = Math.floor(Date.now() / 1000);
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60);

  const [totalUsers, newUsers, activeSubscriptions, pushSubscribers] = await Promise.allSettled([
    getCountFromServer(collection(db, 'users')),
    getCountFromServer(query(collection(db, 'users'), where('metadata.created.timestampUNIX', '>=', thirtyDaysAgo))),
    getCountFromServer(query(collection(db, 'users'), where('subscription.expires.timestampUNIX', '>=', now))),
    getCountFromServer(collection(db, 'notifications')),
  ]);

  setStatValue('stat-total-users', totalUsers);
  setStatValue('stat-new-users', newUsers);
  setStatValue('stat-subscriptions', activeSubscriptions);
  setStatValue('stat-notifications', pushSubscribers);
}

// ============================================
// Subscriber Data (for charts)
// ============================================
async function loadSubscriberData() {
  const firestore = webManager.firestore();
  const now = Math.floor(Date.now() / 1000);

  const snapshot = await firestore.collection('users')
    .where('subscription.expires.timestampUNIX', '>=', now)
    .get();

  // Group by plan
  const plans = {};
  const frequencies = {};

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const planId = data?.subscription?.product?.id || 'basic';
    const frequency = data?.subscription?.payment?.frequency || 'unknown';

    // Plan counts
    plans[planId] = (plans[planId] || 0) + 1;

    // Frequency per plan
    if (!frequencies[planId]) {
      frequencies[planId] = { monthly: 0, annually: 0, other: 0 };
    }
    if (frequency === 'monthly' || frequency === 'annually') {
      frequencies[planId][frequency]++;
    } else {
      frequencies[planId].other++;
    }
  });

  renderPlanChart(plans);
  renderFrequencyChart(frequencies);
}

// ============================================
// Charts
// ============================================
function getChartColors() {
  const style = getComputedStyle(document.documentElement);
  return {
    text: style.getPropertyValue('--bs-body-color').trim(),
    border: style.getPropertyValue('--bs-border-color').trim(),
    muted: style.getPropertyValue('--bs-secondary-color').trim(),
    palette: [
      '#0d6efd', // primary/blue
      '#198754', // success/green
      '#0dcaf0', // info/cyan
      '#ffc107', // warning/yellow
      '#dc3545', // danger/red
      '#6f42c1', // purple
      '#fd7e14', // orange
      '#20c997', // teal
    ],
  };
}

function renderPlanChart(plans) {
  const $loading = document.getElementById('chart-plans-loading');
  const $canvas = document.getElementById('chart-plans');
  if (!$canvas) {
    return;
  }

  const labels = Object.keys(plans);
  const data = Object.values(plans);

  if (labels.length === 0) {
    if ($loading) {
      $loading.innerHTML = '<span class="text-muted">No subscription data</span>';
    }
    return;
  }

  const colors = getChartColors();

  if ($loading) {
    $loading.classList.add('d-none');
  }
  $canvas.classList.remove('d-none');

  planChart = new Chart($canvas, {
    type: 'doughnut',
    data: {
      labels: labels.map(capitalize),
      datasets: [{
        data: data,
        backgroundColor: colors.palette.slice(0, labels.length),
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: colors.text, padding: 16 },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = ((ctx.parsed / total) * 100).toFixed(1);
              return ` ${ctx.label}: ${ctx.parsed.toLocaleString()} (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

function renderFrequencyChart(frequencies) {
  const $loading = document.getElementById('chart-frequency-loading');
  const $canvas = document.getElementById('chart-frequency');
  if (!$canvas) {
    return;
  }

  const planIds = Object.keys(frequencies);

  if (planIds.length === 0) {
    if ($loading) {
      $loading.innerHTML = '<span class="text-muted">No subscription data</span>';
    }
    return;
  }

  const colors = getChartColors();

  if ($loading) {
    $loading.classList.add('d-none');
  }
  $canvas.classList.remove('d-none');

  frequencyChart = new Chart($canvas, {
    type: 'bar',
    data: {
      labels: planIds.map(capitalize),
      datasets: [
        {
          label: 'Monthly',
          data: planIds.map((id) => frequencies[id].monthly),
          backgroundColor: colors.palette[0],
        },
        {
          label: 'Annually',
          data: planIds.map((id) => frequencies[id].annually),
          backgroundColor: colors.palette[1],
        },
        {
          label: 'Other',
          data: planIds.map((id) => frequencies[id].other),
          backgroundColor: colors.palette[3],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        x: {
          ticks: { color: colors.text },
          grid: { color: colors.border },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: colors.text,
            stepSize: 1,
          },
          grid: { color: colors.border },
        },
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: colors.text, padding: 16 },
        },
      },
    },
  });
}

// ============================================
// Recent Users Table
// ============================================
async function loadRecentUsers() {
  const $loading = document.getElementById('recent-users-loading');
  const $empty = document.getElementById('recent-users-empty');
  const $table = document.getElementById('recent-users-table');
  const $tbody = document.getElementById('recent-users-tbody');

  const firestore = webManager.firestore();
  const snapshot = await firestore.collection('users')
    .orderBy('metadata.created.timestampUNIX', 'desc')
    .limit(10)
    .get();

  if ($loading) {
    $loading.classList.add('d-none');
  }

  if (snapshot.empty) {
    if ($empty) {
      $empty.classList.remove('d-none');
    }
    return;
  }

  if ($table) {
    $table.classList.remove('d-none');
  }

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const email = data?.auth?.email || 'Unknown';
    const plan = data?.subscription?.product?.id || 'basic';
    const created = data?.metadata?.created?.timestampUNIX;
    const timeAgo = created ? formatTimeAgo(created * 1000) : 'Unknown';

    const $row = document.createElement('tr');
    $row.innerHTML = `
      <td class="text-truncate" style="max-width: 200px;">${escapeHtml(email)}</td>
      <td><span class="badge bg-body-secondary text-body">${escapeHtml(capitalize(plan))}</span></td>
      <td class="text-muted small">${timeAgo}</td>
    `;
    $tbody.appendChild($row);
  });
}

// ============================================
// Recent Orders Table
// ============================================
async function loadRecentOrders() {
  const $loading = document.getElementById('recent-orders-loading');
  const $empty = document.getElementById('recent-orders-empty');
  const $table = document.getElementById('recent-orders-table');
  const $tbody = document.getElementById('recent-orders-tbody');

  const firestore = webManager.firestore();
  const snapshot = await firestore.collection('payments-orders')
    .orderBy('metadata.created.timestampUNIX', 'desc')
    .limit(10)
    .get();

  if ($loading) {
    $loading.classList.add('d-none');
  }

  if (snapshot.empty) {
    if ($empty) {
      $empty.classList.remove('d-none');
    }
    return;
  }

  if ($table) {
    $table.classList.remove('d-none');
  }

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const orderId = doc.id;
    const product = data?.productId || 'Unknown';
    const processor = data?.processor || 'Unknown';
    const created = data?.metadata?.created?.timestampUNIX;
    const timeAgo = created ? formatTimeAgo(created * 1000) : 'Unknown';

    const $row = document.createElement('tr');
    $row.innerHTML = `
      <td class="font-monospace small text-truncate" style="max-width: 120px;" title="${escapeHtml(orderId)}">${escapeHtml(orderId)}</td>
      <td><span class="badge bg-body-secondary text-body">${escapeHtml(capitalize(product))}</span></td>
      <td class="small">${escapeHtml(capitalize(processor))}</td>
      <td class="text-muted small">${timeAgo}</td>
    `;
    $tbody.appendChild($row);
  });
}

// ============================================
// Admin Tools (Cron + Backup)
// ============================================
function initTools() {
  document.querySelectorAll('.btn-run-cron').forEach(($btn) => {
    $btn.addEventListener('click', () => runCron($btn));
  });

  const $backupBtn = document.getElementById('btn-run-backup');
  if ($backupBtn) {
    $backupBtn.addEventListener('click', runBackup);
  }
}

async function runCron($btn) {
  const cronId = $btn.dataset.cronId;
  const $text = $btn.querySelector('.btn-run-cron-text');
  const $result = document.getElementById('cron-result');
  const originalText = $text?.textContent;

  $btn.disabled = true;
  if ($text) $text.textContent = 'Running...';

  try {
    await authorizedFetch(`${webManager.getApiUrl()}/backend-manager/admin/cron`, {
      method: 'POST',
      timeout: 5 * 60 * 1000,
      response: 'text',
      tries: 1,
      log: true,
      body: { id: cronId },
    });

    if ($result) {
      $result.classList.remove('d-none');
      $result.innerHTML = `<div class="alert alert-success small mb-0 py-2">Cron <strong>${escapeHtml(cronId)}</strong> completed successfully</div>`;
    }
  } catch (error) {
    console.error(`Cron ${cronId} failed:`, error);
    if ($result) {
      $result.classList.remove('d-none');
      $result.innerHTML = `<div class="alert alert-danger small mb-0 py-2">Cron <strong>${escapeHtml(cronId)}</strong> failed: ${escapeHtml(error.message || 'Unknown error')}</div>`;
    }
  }

  $btn.disabled = false;
  if ($text) $text.textContent = originalText;
}

async function runBackup() {
  const $btn = document.getElementById('btn-run-backup');
  const $text = document.getElementById('btn-run-backup-text');
  const $result = document.getElementById('backup-result');

  if (!confirm('Start a Firestore backup? This may take a few minutes.')) {
    return;
  }

  if ($btn) $btn.disabled = true;
  if ($text) $text.textContent = 'Running...';

  try {
    await authorizedFetch(`${webManager.getApiUrl()}/backend-manager/admin/backup`, {
      method: 'POST',
      timeout: 5 * 60 * 1000,
      response: 'json',
      tries: 1,
      log: true,
      body: {},
    });

    if ($result) {
      $result.classList.remove('d-none');
      $result.innerHTML = `<div class="alert alert-success small mb-0 py-2">Backup started successfully</div>`;
    }
  } catch (error) {
    console.error('Backup failed:', error);
    if ($result) {
      $result.classList.remove('d-none');
      $result.innerHTML = `<div class="alert alert-danger small mb-0 py-2">Backup failed: ${escapeHtml(error.message || 'Unknown error')}</div>`;
    }
  }

  if ($btn) $btn.disabled = false;
  if ($text) $text.textContent = 'Run backup';
}
