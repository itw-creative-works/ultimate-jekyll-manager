/**
 * Status Page JavaScript
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

    // Initialize components
    initializeUptimeBars();
    initializeSubscribeForm();
    initializeTooltips();
    initializeRefreshTimer();

    // Fetch status data (if configured)
    fetchStatusData();

    // Resolve after initialization
    return resolve();
  });
};

// Configuration
const config = {
  selectors: {
    statusBanner: '#status-banner',
    statusText: '#status-text',
    servicesList: '#services-list',
    maintenanceList: '#maintenance-list',
    maintenanceEmpty: '#maintenance-empty',
    incidentsList: '#incidents-list',
    incidentsEmpty: '#incidents-empty',
    subscribeForm: '#status-subscribe-form',
  },
  statusClasses: {
    operational: 'status-operational',
    degraded: 'status-degraded',
    major: 'status-major',
    maintenance: 'status-maintenance',
  },
  statusLabels: {
    operational: 'Operational',
    degraded: 'Degraded Performance',
    major: 'Major Outage',
    maintenance: 'Under Maintenance',
  },
};

// Initialize uptime bar tooltips
function initializeUptimeBars() {
  const $uptimeBars = document.querySelectorAll('.uptime-bars');

  $uptimeBars.forEach($barsContainer => {
    const $bars = $barsContainer.querySelectorAll('.uptime-bar');

    $bars.forEach(($bar, index) => {
      $bar.addEventListener('mouseenter', (e) => showUptimeTooltip(e, $bar, index, $bars.length));
      $bar.addEventListener('mouseleave', hideUptimeTooltip);
      $bar.addEventListener('mousemove', moveUptimeTooltip);
    });
  });
}

// Show uptime tooltip
function showUptimeTooltip(e, $bar, index, totalDays) {
  // Get the actual day number from data attribute (1-90)
  const dayNumber = parseInt($bar.dataset.day, 10) || (index + 1);

  // Calculate days ago (day 1 = 89 days ago, day 90 = today)
  const daysAgo = totalDays - dayNumber;
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);

  // Get status from the bar's class
  let status = 'operational';
  if ($bar.classList.contains('status-degraded')) {
    status = 'degraded';
  } else if ($bar.classList.contains('status-major')) {
    status = 'major';
  } else if ($bar.classList.contains('status-maintenance')) {
    status = 'maintenance';
  }

  // Get uptime data if available
  const uptime = $bar.dataset.uptime || '100%';

  // Create tooltip
  let $tooltip = document.querySelector('.uptime-tooltip');
  if (!$tooltip) {
    $tooltip = document.createElement('div');
    $tooltip.className = 'uptime-tooltip rounded-3 p-2 small';
    document.body.appendChild($tooltip);
  }

  // Format date
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  $tooltip.innerHTML = `
    <div class="fw-semibold mb-1">${dateStr}</div>
    <div class="d-flex align-items-center gap-2">
      <span class="status-dot rounded-circle ${config.statusClasses[status]}"></span>
      <span>${config.statusLabels[status]}</span>
    </div>
    <div class="text-muted small">Uptime: ${uptime}</div>
  `;

  $tooltip.style.display = 'block';
  positionTooltip(e, $tooltip);
}

// Hide uptime tooltip
function hideUptimeTooltip() {
  const $tooltip = document.querySelector('.uptime-tooltip');
  if ($tooltip) {
    $tooltip.style.display = 'none';
  }
}

// Move uptime tooltip with cursor
function moveUptimeTooltip(e) {
  const $tooltip = document.querySelector('.uptime-tooltip');
  if ($tooltip) {
    positionTooltip(e, $tooltip);
  }
}

// Position tooltip near cursor
function positionTooltip(e, $tooltip) {
  const padding = 10;
  const tooltipRect = $tooltip.getBoundingClientRect();

  let left = e.clientX + padding;
  let top = e.clientY - tooltipRect.height - padding;

  // Keep tooltip within viewport
  if (left + tooltipRect.width > window.innerWidth) {
    left = e.clientX - tooltipRect.width - padding;
  }

  if (top < 0) {
    top = e.clientY + padding;
  }

  $tooltip.style.left = `${left}px`;
  $tooltip.style.top = `${top}px`;
}

// Initialize subscribe form
function initializeSubscribeForm() {
  const $form = document.querySelector(config.selectors.subscribeForm);

  if (!$form) {
    return;
  }

  const formManager = new FormManager($form, {
    submittedText: 'Subscribed!',
    allowResubmit: false,
  });

  formManager.on('submit', async () => {
    // Track subscription
    trackStatusSubscribe();

    // Here you would typically send to your backend
    // For now, we'll simulate a successful subscription
    await simulateApiCall();

    formManager.showSuccess('You\'ve been subscribed to status updates!');
  });
}

// Initialize Bootstrap tooltips
function initializeTooltips() {
  const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
  tooltipTriggerList.forEach(tooltipTriggerEl => {
    new bootstrap.Tooltip(tooltipTriggerEl);
  });
}

// Initialize refresh timer - counts up every second, resets every 60 seconds
function initializeRefreshTimer() {
  const $timer = document.querySelector('#status-refresh-timer');

  if (!$timer) {
    return;
  }

  let seconds = 0;

  setInterval(() => {
    seconds++;

    // Reset and refresh data every 60 seconds
    if (seconds >= 60) {
      seconds = 0;
      fetchStatusData();
    }

    $timer.textContent = seconds;
  }, 1000);
}

// Fetch status data from API (if configured)
function fetchStatusData() {
  // Check if there's a status API endpoint configured
  const statusApiUrl = window.statusConfig?.apiUrl;

  if (!statusApiUrl) {
    // No API configured, use static data
    return;
  }

  // Fetch from API
  fetch(statusApiUrl)
    .then(response => response.json())
    .then(data => {
      updateStatusDisplay(data);
    })
    .catch(error => {
      console.warn('Failed to fetch status data:', error);
    });
}

// Update status display with fetched data
function updateStatusDisplay(data) {
  // Update overall status
  if (data.overall) {
    updateOverallStatus(data.overall);
  }

  // Update individual services
  if (data.services) {
    updateServices(data.services);
  }

  // Update maintenance items
  if (data.maintenance) {
    updateMaintenance(data.maintenance);
  }

  // Update incidents
  if (data.incidents) {
    updateIncidents(data.incidents);
  }
}

// Update overall status banner
function updateOverallStatus(status) {
  const $banner = document.querySelector(config.selectors.statusBanner);
  const $text = document.querySelector(config.selectors.statusText);

  if (!$banner || !$text) {
    return;
  }

  // Remove all status classes
  Object.values(config.statusClasses).forEach(cls => {
    $banner.classList.remove(cls);
  });

  // Add new status class
  $banner.classList.add(config.statusClasses[status.level] || config.statusClasses.operational);

  // Update text
  $text.textContent = status.message || config.statusLabels[status.level];
}

// Update individual service statuses
function updateServices(services) {
  services.forEach(service => {
    const $serviceItem = document.querySelector(`[data-service-id="${service.id}"]`);

    if (!$serviceItem) {
      return;
    }

    // Update status dot
    const $statusDot = $serviceItem.querySelector('[data-service-status]');
    if ($statusDot) {
      Object.values(config.statusClasses).forEach(cls => {
        $statusDot.classList.remove(cls);
      });
      $statusDot.classList.add(config.statusClasses[service.status] || config.statusClasses.operational);
    }

    // Update uptime percentage
    const $uptime = $serviceItem.querySelector('[data-service-uptime]');
    if ($uptime && service.uptime !== undefined) {
      $uptime.textContent = `${service.uptime}%`;
    }

    // Update uptime bars if provided
    if (service.history) {
      updateUptimeBars($serviceItem, service.history);
    }
  });
}

// Update uptime bars for a service
function updateUptimeBars($serviceItem, history) {
  const $bars = $serviceItem.querySelectorAll('.uptime-bar');

  history.forEach((day, index) => {
    const $bar = $bars[index];

    if (!$bar) {
      return;
    }

    // Remove all status classes
    Object.values(config.statusClasses).forEach(cls => {
      $bar.classList.remove(cls);
    });

    // Add new status class
    $bar.classList.add(config.statusClasses[day.status] || config.statusClasses.operational);

    // Store uptime data
    if (day.uptime !== undefined) {
      $bar.dataset.uptime = `${day.uptime}%`;
    }
  });
}

// Update maintenance section
function updateMaintenance(maintenanceItems) {
  const $list = document.querySelector(config.selectors.maintenanceList);
  const $empty = document.querySelector(config.selectors.maintenanceEmpty);

  if (!$list) {
    return;
  }

  if (!maintenanceItems || maintenanceItems.length === 0) {
    if ($empty) {
      $empty.style.display = 'block';
    }
    return;
  }

  // Hide empty state
  if ($empty) {
    $empty.style.display = 'none';
  }

  // Build maintenance cards
  const html = maintenanceItems.map(item => `
    <div class="card maintenance-card border-0 bg-body-tertiary mb-3 status-maintenance">
      <div class="card-body p-4">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <h4 class="h5 fw-semibold mb-0">${escapeHtml(item.title)}</h4>
          <span class="text-muted small">${formatDate(item.scheduled_for)}</span>
        </div>
        <p class="text-muted mb-0">${escapeHtml(item.description)}</p>
        ${item.affected_services ? `
          <div class="mt-2">
            <small class="text-muted">
              <strong>Affected:</strong> ${item.affected_services.map(s => escapeHtml(s)).join(', ')}
            </small>
          </div>
        ` : ''}
      </div>
    </div>
  `).join('');

  // Insert before empty state
  if ($empty) {
    $empty.insertAdjacentHTML('beforebegin', html);
  } else {
    $list.innerHTML = html;
  }
}

// Update incidents section
function updateIncidents(incidents) {
  const $list = document.querySelector(config.selectors.incidentsList);
  const $empty = document.querySelector(config.selectors.incidentsEmpty);

  if (!$list) {
    return;
  }

  if (!incidents || incidents.length === 0) {
    if ($empty) {
      $empty.style.display = 'block';
    }
    return;
  }

  // Hide empty state
  if ($empty) {
    $empty.style.display = 'none';
  }

  // Build incident cards
  const html = incidents.map(incident => `
    <div class="card incident-card border-0 bg-body-tertiary mb-3 status-${incident.status}">
      <div class="card-body p-4">
        <div class="d-flex justify-content-between align-items-start mb-2 flex-wrap gap-2">
          <h4 class="h5 fw-semibold mb-0">${escapeHtml(incident.title)}</h4>
          <div class="d-flex align-items-center gap-2">
            <span class="badge ${getIncidentBadgeClasses(incident.status)}">${formatIncidentStatus(incident.status)}</span>
            <span class="text-muted small">${formatDate(incident.created_at)}</span>
          </div>
        </div>
        ${incident.updates && incident.updates.length > 0 ? `
          <div class="incident-timeline mt-3">
            ${incident.updates.map(update => `
              <div class="timeline-item status-${update.status} pb-3">
                <div class="small text-muted mb-1">${formatDateTime(update.created_at)}</div>
                <div class="small">${escapeHtml(update.message)}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    </div>
  `).join('');

  // Insert before empty state
  if ($empty) {
    $empty.insertAdjacentHTML('beforebegin', html);
  } else {
    $list.innerHTML = html;
  }
}

// Tracking functions
function trackStatusSubscribe() {
  gtag('event', 'status_subscribe', {
    method: 'email'
  });
  fbq('track', 'Lead', {
    content_name: 'Status Updates',
    content_category: 'subscription'
  });
  ttq.track('SubmitForm', {
    content_id: 'status-subscribe',
    content_type: 'product',
    content_name: 'Status Subscription'
  });
}

// Helper functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatDateTime(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function formatIncidentStatus(status) {
  const statusLabels = {
    investigating: 'Investigating',
    identified: 'Identified',
    monitoring: 'Monitoring',
    resolved: 'Resolved'
  };
  return statusLabels[status] || status;
}

function getIncidentBadgeClasses(status) {
  const badgeClasses = {
    investigating: 'bg-warning-subtle text-warning',
    identified: 'bg-danger-subtle text-danger',
    monitoring: 'bg-info-subtle text-info',
    resolved: 'bg-success-subtle text-success'
  };
  return badgeClasses[status] || 'bg-secondary-subtle text-secondary';
}

function simulateApiCall() {
  return new Promise(resolve => setTimeout(resolve, 1000));
}
