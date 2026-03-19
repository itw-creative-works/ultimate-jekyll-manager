/**
 * Calendar Renderer
 * Renders the toolbar and calendar grid for all 4 view modes.
 * Campaigns are color-coded by type (email=blue, push=green) and
 * styled by status (pending=normal, sent=faded+checkmark, failed=red).
 */

import { getPrerenderedIcon } from '__main_assets__/js/libs/prerendered-icons.js';
import { escapeHtml } from '__main_assets__/js/libs/admin-helpers.js';
import { VIEW_MODES, DAY_ABBREVS, MONTH_NAMES, TYPE_COLORS, STATUS_STYLES, DISPLAY_TYPES } from './calendar-core.js';

export default class CalendarRenderer {
  constructor(core) {
    this.core = core;
    this.$toolbar = document.getElementById('calendar-toolbar');
    this.$grid = document.getElementById('calendar-grid');
    this._nowLineInterval = null;
  }

  // ============================================
  // Main Render
  // ============================================
  render() {
    this._renderToolbar();
    this._renderGrid();
    this._startNowLine();
  }

  // ============================================
  // Toolbar
  // ============================================
  _renderToolbar() {
    const core = this.core;

    this.$toolbar.innerHTML = `
      <div class="calendar-toolbar-nav">
        <button type="button" class="btn btn-sm btn-outline-adaptive" data-calendar-nav="-1" title="Previous">
          ${getPrerenderedIcon('chevron-left', 'fa-sm')}
        </button>
        <button type="button" class="btn btn-sm btn-outline-adaptive" data-calendar-nav="1" title="Next">
          ${getPrerenderedIcon('chevron-right', 'fa-sm')}
        </button>
        <button type="button" class="btn btn-sm btn-outline-adaptive ms-1" data-calendar-today>
          Today
        </button>
      </div>
      <div class="calendar-toolbar-period">
        ${core.formatPeriodLabel()}
      </div>
      <div class="calendar-toolbar-views btn-group" role="group" aria-label="Calendar view">
        ${VIEW_MODES.map((mode) => `
          <button type="button"
                  class="btn btn-sm btn-outline-adaptive ${core.viewMode === mode ? 'active' : ''}"
                  data-calendar-view="${mode}">
            ${this._getViewIcon(mode)} ${mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        `).join('')}
      </div>
    `;

    // Navigation handlers
    this.$toolbar.querySelectorAll('[data-calendar-nav]').forEach(($btn) => {
      $btn.addEventListener('click', () => {
        core.navigate(parseInt($btn.dataset.calendarNav, 10));
      });
    });

    this.$toolbar.querySelector('[data-calendar-today]').addEventListener('click', () => {
      core.goToToday();
    });

    // View mode handlers
    this.$toolbar.querySelectorAll('[data-calendar-view]').forEach(($btn) => {
      $btn.addEventListener('click', () => {
        core.setView($btn.dataset.calendarView);
      });
    });
  }

  _getViewIcon(mode) {
    const icons = {
      day: 'calendar-day',
      week: 'calendar-week',
      month: 'calendar',
      year: 'grid-2',
      list: 'table-list',
    };
    return getPrerenderedIcon(icons[mode], 'fa-sm');
  }

  // ============================================
  // Grid Delegation
  // ============================================
  _renderGrid() {
    switch (this.core.viewMode) {
      case 'month':
        this._renderMonthView();
        break;
      case 'week':
        this._renderWeekView();
        break;
      case 'day':
        this._renderDayView();
        break;
      case 'year':
        this._renderYearView();
        break;
      case 'list':
        this._renderListView();
        break;
    }
  }

  // ============================================
  // Month View
  // ============================================
  _renderMonthView() {
    const core = this.core;
    const cells = core.getMonthGrid();

    let html = '';

    // Day headers
    html += '<div class="calendar-day-header">';
    DAY_ABBREVS.forEach((day) => {
      html += `<div>${day}</div>`;
    });
    html += '</div>';

    // Grid cells
    html += '<div class="calendar-month">';
    cells.forEach((cell) => {
      const dateStr = core.formatDate(cell.date);
      const isToday = core.isToday(cell.date);
      const campaigns = core.getCampaignsForDate(dateStr);

      let classes = 'calendar-cell';
      if (isToday) {
        classes += ' calendar-cell--today';
      }
      if (cell.outside) {
        classes += ' calendar-cell--outside';
      }

      html += `<div class="${classes}" data-date="${dateStr}">`;
      html += `<div class="calendar-cell-date">${cell.date.getDate()}</div>`;
      html += '<div class="calendar-cell-events">';

      const maxVisible = 3;
      campaigns.slice(0, maxVisible).forEach((campaign) => {
        html += this._renderEventPill(campaign);
      });

      if (campaigns.length > maxVisible) {
        html += `<div class="calendar-cell-more" data-date="${dateStr}">+${campaigns.length - maxVisible} more</div>`;
      }

      html += '</div></div>';
    });
    html += '</div>';

    this.$grid.innerHTML = html;
    this._bindCellClicks();
    this._bindEventPillClicks();
    this._bindDragAndDrop();
  }

  // ============================================
  // Week View
  // ============================================
  _renderWeekView() {
    const core = this.core;
    const weekDates = core.getWeekDates();
    const hours = this._getHours();

    let html = '';

    // Header row
    html += '<div class="calendar-week-header">';
    html += '<div></div>'; // time gutter header
    weekDates.forEach((date) => {
      const isToday = core.isToday(date);
      html += `
        <div class="calendar-week-header-cell ${isToday ? 'calendar-cell--today' : ''}">
          ${DAY_ABBREVS[date.getDay()]}
          <span class="calendar-week-header-date">${date.getDate()}</span>
        </div>
      `;
    });
    html += '</div>';

    // All-day row
    html += '<div class="calendar-week-allday">';
    html += '<div class="calendar-week-time-label">all-day</div>';
    weekDates.forEach((date) => {
      const dateStr = core.formatDate(date);
      html += `<div class="calendar-cell" data-date="${dateStr}" data-allday="true" style="min-height:auto;border-bottom:none;"></div>`;
    });
    html += '</div>';

    // Time grid body
    html += '<div class="calendar-week-body">';

    // Time labels column
    html += '<div class="calendar-week-time-col">';
    hours.forEach((hour) => {
      html += `<div class="calendar-week-time-label">${hour.label}</div>`;
    });
    html += '</div>';

    // Day columns
    weekDates.forEach((date) => {
      const dateStr = core.formatDate(date);
      const campaigns = core.getCampaignsForDate(dateStr);

      html += `<div class="calendar-week-day-col" data-date="${dateStr}">`;
      hours.forEach((hour) => {
        html += `<div class="calendar-week-time-slot" data-date="${dateStr}" data-hour="${hour.value}"></div>`;
      });

      // Positioned events with overlap layout
      const layout = this._calculateOverlapLayout(campaigns);
      campaigns.forEach((campaign) => {
        html += this._renderTimeEvent(campaign, layout.get(campaign.id));
      });

      html += '</div>';
    });

    html += '</div>';

    this.$grid.innerHTML = html;
    this._bindCellClicks();
    this._bindEventPillClicks();
    this._bindDragAndDrop();
  }

  // ============================================
  // Day View
  // ============================================
  _renderDayView() {
    const core = this.core;
    const date = core.currentDate;
    const dateStr = core.formatDate(date);
    const campaigns = core.getCampaignsForDate(dateStr);
    const hours = this._getHours();

    let html = '';

    // Day body with time grid
    html += '<div class="calendar-day-body">';

    // Time labels
    html += '<div class="calendar-week-time-col">';
    hours.forEach((hour) => {
      html += `<div class="calendar-week-time-label">${hour.label}</div>`;
    });
    html += '</div>';

    // Day column
    html += `<div class="calendar-day-col" data-date="${dateStr}">`;
    hours.forEach((hour) => {
      html += `<div class="calendar-week-time-slot" data-date="${dateStr}" data-hour="${hour.value}"></div>`;
    });

    // Positioned events with overlap layout
    const layout = this._calculateOverlapLayout(campaigns);
    campaigns.forEach((campaign) => {
      html += this._renderTimeEvent(campaign, layout.get(campaign.id));
    });

    html += '</div></div>';

    this.$grid.innerHTML = html;
    this._bindCellClicks();
    this._bindEventPillClicks();
    this._bindDragAndDrop();
  }

  // ============================================
  // Year View
  // ============================================
  _renderYearView() {
    const core = this.core;
    const year = core.currentDate.getFullYear();

    let html = '<div class="calendar-year">';

    for (let month = 0; month < 12; month++) {
      html += `<div class="calendar-mini-month" data-month="${month}">`;
      html += `<div class="calendar-mini-month-title">${MONTH_NAMES[month]}</div>`;
      html += '<div class="calendar-mini-month-grid">';

      // Mini day headers
      DAY_ABBREVS.forEach((day) => {
        html += `<div class="calendar-mini-day-header">${day.charAt(0)}</div>`;
      });

      // Mini month days
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = core.getDaysInMonth(year, month);

      // Empty cells before first day
      for (let i = 0; i < firstDay; i++) {
        html += '<div class="calendar-mini-day calendar-cell--outside"></div>';
      }

      // Actual days
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const dateStr = core.formatDate(date);
        const isToday = core.isToday(date);
        const hasCampaigns = core.getCampaignsForDate(dateStr).length > 0;

        let classes = 'calendar-mini-day';
        if (isToday) {
          classes += ' calendar-cell--today';
        }
        if (hasCampaigns) {
          classes += ' has-events';
        }

        html += `<div class="${classes}">${d}</div>`;
      }

      html += '</div></div>';
    }

    html += '</div>';

    this.$grid.innerHTML = html;

    // Click mini-month to navigate to month view
    this.$grid.querySelectorAll('.calendar-mini-month').forEach(($mini) => {
      $mini.addEventListener('click', () => {
        const month = parseInt($mini.dataset.month, 10);
        core.currentDate.setMonth(month);
        core.setView('month');
      });
    });
  }

  // ============================================
  // List View
  // ============================================
  _renderListView() {
    const core = this.core;
    const campaigns = core.getAllCampaignsSorted();

    if (campaigns.length === 0) {
      this.$grid.innerHTML = `
        <div class="calendar-list-empty">
          <div class="text-center">
            <p>No campaigns in this date range</p>
          </div>
        </div>
      `;
      return;
    }

    let html = '<div class="calendar-list"><table>';

    let currentDateStr = null;

    campaigns.forEach((campaign) => {
      const dateStr = core._campaignDate(campaign);

      // Date group header
      if (dateStr !== currentDateStr) {
        currentDateStr = dateStr;
        const d = new Date(campaign.sendAt * 1000);
        const dayName = DAY_ABBREVS[d.getDay()];
        const monthName = MONTH_NAMES[d.getMonth()].slice(0, 3);
        const isToday = core.isToday(d);
        const todayBadge = isToday ? ' <span class="badge bg-danger ms-2">Today</span>' : '';

        html += `<tr class="calendar-list-date-header"><td colspan="4">${dayName}, ${monthName} ${d.getDate()}, ${d.getFullYear()}${todayBadge}</td></tr>`;
      }

      // Campaign row
      const time = this._formatTime(core.campaignTime(campaign));
      const name = (campaign.settings && campaign.settings.name) || 'Untitled';
      const color = core.campaignColor(campaign);
      const statusStyle = core.campaignStatusStyle(campaign);
      const isRecurring = campaign.recurrence || campaign.recurringId || campaign._virtual;

      const typeBadge = campaign.type === 'email'
        ? `<span class="badge" style="background-color: ${TYPE_COLORS.email}">${getPrerenderedIcon('envelope', 'fa-xs me-1')} Email</span>`
        : `<span class="badge" style="background-color: ${TYPE_COLORS.push}">${getPrerenderedIcon('bell', 'fa-xs me-1')} Push</span>`;

      let statusBadge = '';
      if (campaign.status === 'sent') {
        statusBadge = `<span class="badge bg-success">${getPrerenderedIcon('circle-check', 'fa-xs me-1')} Sent</span>`;
      } else if (campaign.status === 'failed') {
        statusBadge = `<span class="badge bg-danger">${getPrerenderedIcon('triangle-exclamation', 'fa-xs me-1')} Failed</span>`;
      } else {
        statusBadge = '<span class="badge bg-secondary">Pending</span>';
      }

      const recurringIcon = isRecurring ? getPrerenderedIcon('repeat', 'fa-xs me-1 text-muted') : '';

      html += `
        <tr class="calendar-list-row" data-campaign-id="${campaign.id}" style="opacity: ${statusStyle.opacity}">
          <td style="width: 60px">${time}</td>
          <td>${recurringIcon}${escapeHtml(name)}</td>
          <td style="width: 80px">${typeBadge}</td>
          <td style="width: 80px">${statusBadge}</td>
        </tr>
      `;
    });

    html += '</table></div>';

    this.$grid.innerHTML = html;

    // Bind row clicks
    this.$grid.querySelectorAll('.calendar-list-row').forEach(($row) => {
      $row.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = $row.dataset.campaignId;
        core.eventsManager.openEditModal(id);
      });
    });
  }

  // ============================================
  // Campaign Rendering Helpers
  // ============================================
  _renderEventPill(campaign) {
    const core = this.core;
    const timeStr = this._formatTime(core.campaignTime(campaign));
    const color = core.campaignColor(campaign);
    const statusStyle = core.campaignStatusStyle(campaign);
    const name = (campaign.settings && campaign.settings.name) || 'Untitled';
    const isEditable = core.isEditable(campaign);
    const isRecurring = campaign.recurrence || campaign.recurringId || campaign._virtual;
    const statusIcon = statusStyle.icon
      ? getPrerenderedIcon(statusStyle.icon, 'fa-xs')
      : '';
    const typeIcon = campaign.type === 'email'
      ? getPrerenderedIcon('envelope', 'fa-xs')
      : getPrerenderedIcon('bell', 'fa-xs');
    const recurringIcon = isRecurring
      ? getPrerenderedIcon('repeat', 'fa-xs')
      : '';

    let pillClass = 'calendar-event';
    if (campaign.status === 'failed') {
      pillClass += ' calendar-event--failed';
    }
    if (campaign.status === 'sent') {
      pillClass += ' calendar-event--sent';
    }
    if (campaign._virtual) {
      pillClass += ' calendar-event--virtual';
    }
    if (isRecurring && !campaign._virtual) {
      pillClass += ' calendar-event--recurring';
    }

    return `
      <div class="${pillClass}"
           data-campaign-id="${campaign.id}"
           ${isEditable && !campaign._virtual ? 'draggable="true"' : ''}
           style="background-color: ${color}; opacity: ${statusStyle.opacity};"
           title="${escapeHtml(name)}${isRecurring ? ' (recurring)' : ''}">
        ${statusIcon}
        ${recurringIcon}
        <span class="calendar-event-time">${timeStr}</span>
        <span class="calendar-event-type-icon">${typeIcon}</span>
        <span class="calendar-event-title">${escapeHtml(name)}</span>
      </div>
    `;
  }

  _renderTimeEvent(campaign, layout) {
    const core = this.core;
    const time = core.campaignTime(campaign);
    const [hours, minutes] = time.split(':').map(Number);
    const topPx = (hours * 60 + minutes);
    const heightPx = Math.max(core.campaignDuration(), 15);
    const timeStr = this._formatTime(time);
    const color = core.campaignColor(campaign);
    const statusStyle = core.campaignStatusStyle(campaign);
    const name = (campaign.settings && campaign.settings.name) || 'Untitled';
    const isEditable = core.isEditable(campaign);
    const isRecurring = campaign.recurrence || campaign.recurringId || campaign._virtual;
    const statusIcon = statusStyle.icon
      ? getPrerenderedIcon(statusStyle.icon, 'fa-xs me-1')
      : '';
    const recurringIcon = isRecurring
      ? getPrerenderedIcon('repeat', 'fa-xs me-1')
      : '';

    // Layout: column position and total columns for side-by-side overlap
    const col = layout ? layout.col : 0;
    const totalCols = layout ? layout.totalCols : 1;
    const widthPct = 100 / totalCols;
    const leftPct = col * widthPct;

    const sizeStyle = totalCols > 1
      ? `left: ${leftPct}%; width: calc(${widthPct}% - 2px);`
      : '';

    let eventClass = 'calendar-week-event';
    if (campaign.status === 'failed') {
      eventClass += ' calendar-event--failed';
    }
    if (campaign.status === 'sent') {
      eventClass += ' calendar-event--sent';
    }
    if (campaign._virtual) {
      eventClass += ' calendar-event--virtual';
    }
    if (isRecurring && !campaign._virtual) {
      eventClass += ' calendar-event--recurring';
    }

    return `
      <div class="${eventClass}"
           data-campaign-id="${campaign.id}"
           ${isEditable && !campaign._virtual ? 'draggable="true"' : ''}
           style="background-color: ${color}; opacity: ${statusStyle.opacity}; top: ${topPx}px; height: ${heightPx}px; ${sizeStyle}"
           title="${escapeHtml(name)}${isRecurring ? ' (recurring)' : ''}">
        ${statusIcon}${recurringIcon}<strong>${timeStr}</strong> ${escapeHtml(name)}
      </div>
    `;
  }

  /**
   * Calculate side-by-side layout for overlapping campaigns.
   * Returns a Map of campaignId → { col, totalCols }
   */
  _calculateOverlapLayout(campaigns) {
    const layout = new Map();

    if (campaigns.length === 0) {
      return layout;
    }

    const core = this.core;
    const duration = core.campaignDuration();

    // Convert to intervals
    const intervals = campaigns.map((c) => {
      const time = core.campaignTime(c);
      const [h, m] = time.split(':').map(Number);
      const start = h * 60 + m;
      const end = start + duration;
      return { id: c.id, start, end };
    }).sort((a, b) => a.start - b.start || a.end - b.end);

    // Group overlapping events into clusters
    const clusters = [];
    let currentCluster = [intervals[0]];

    for (let i = 1; i < intervals.length; i++) {
      const clusterEnd = Math.max(...currentCluster.map((iv) => iv.end));
      if (intervals[i].start < clusterEnd) {
        currentCluster.push(intervals[i]);
      } else {
        clusters.push(currentCluster);
        currentCluster = [intervals[i]];
      }
    }
    clusters.push(currentCluster);

    // Assign columns within each cluster
    clusters.forEach((cluster) => {
      const columns = [];

      cluster.forEach((interval) => {
        let placed = false;
        for (let c = 0; c < columns.length; c++) {
          const lastInCol = columns[c];
          if (interval.start >= lastInCol.end) {
            columns[c] = interval;
            layout.set(interval.id, { col: c, totalCols: 0 });
            placed = true;
            break;
          }
        }

        if (!placed) {
          layout.set(interval.id, { col: columns.length, totalCols: 0 });
          columns.push(interval);
        }
      });

      // Set totalCols for all events in this cluster
      const totalCols = columns.length;
      cluster.forEach((interval) => {
        layout.get(interval.id).totalCols = totalCols;
      });
    });

    return layout;
  }

  // ============================================
  // Now Line (real-time red indicator)
  // ============================================
  _startNowLine() {
    clearInterval(this._nowLineInterval);

    // Only show in day/week views
    if (this.core.viewMode !== 'day' && this.core.viewMode !== 'week') {
      return;
    }

    this._updateNowLine();
    this._nowLineInterval = setInterval(() => this._updateNowLine(), 60000);
  }

  _updateNowLine() {
    // Remove any existing now lines
    this.$grid.querySelectorAll('.calendar-now-line').forEach(($el) => $el.remove());

    const now = new Date();
    const todayStr = this.core.formatDate(now);
    const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();

    // Find the day column(s) that match today
    const $cols = this.$grid.querySelectorAll(
      `.calendar-week-day-col[data-date="${todayStr}"], .calendar-day-col[data-date="${todayStr}"]`
    );

    $cols.forEach(($col) => {
      const $line = document.createElement('div');
      $line.className = 'calendar-now-line';
      $line.style.top = `${minutesSinceMidnight}px`;
      $col.appendChild($line);
    });
  }

  // ============================================
  // Interaction Bindings
  // ============================================
  _bindCellClicks() {
    const core = this.core;

    // Month view: single click → day view, double click → create campaign
    let clickTimer = null;

    this.$grid.querySelectorAll('.calendar-cell').forEach(($cell) => {
      $cell.addEventListener('click', (e) => {
        if (e.target.closest('[data-campaign-id]')) {
          return;
        }

        const date = $cell.dataset.date;
        if (!date || core.viewMode !== 'month') {
          return;
        }

        clearTimeout(clickTimer);
        clickTimer = setTimeout(() => {
          const parts = date.split('-');
          core.currentDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          core.setView('day');
        }, 250);
      });

      $cell.addEventListener('dblclick', (e) => {
        if (e.target.closest('[data-campaign-id]')) {
          return;
        }

        clearTimeout(clickTimer);

        const date = $cell.dataset.date;
        if (!date) {
          return;
        }

        core.eventsManager.openCreateModal(date, null);
      });
    });

    // Time slots (week/day views): double click only to create campaign
    this.$grid.querySelectorAll('.calendar-week-time-slot').forEach(($slot) => {
      $slot.addEventListener('dblclick', (e) => {
        if (e.target.closest('[data-campaign-id]')) {
          return;
        }

        const date = $slot.dataset.date;
        if (!date) {
          return;
        }

        const time = $slot.dataset.hour
          ? String($slot.dataset.hour).padStart(2, '0') + ':00'
          : null;

        core.eventsManager.openCreateModal(date, time);
      });
    });

    // "+N more" clicks
    this.$grid.querySelectorAll('.calendar-cell-more').forEach(($more) => {
      $more.addEventListener('click', (e) => {
        e.stopPropagation();
        const dateStr = $more.dataset.date;
        const parts = dateStr.split('-');
        core.currentDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        core.setView('day');
      });
    });
  }

  _bindEventPillClicks() {
    this.$grid.querySelectorAll('[data-campaign-id]').forEach(($pill) => {
      $pill.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = $pill.dataset.campaignId;
        this.core.eventsManager.openEditModal(id);
      });
    });
  }

  _bindDragAndDrop() {
    const core = this.core;

    // Drag start on pending campaign pills only
    this.$grid.querySelectorAll('[data-campaign-id][draggable]').forEach(($pill) => {
      $pill.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', $pill.dataset.campaignId);
        e.dataTransfer.effectAllowed = 'move';
        $pill.classList.add('calendar-event--dragging');
        requestAnimationFrame(() => {
          this.$grid.classList.add('calendar-grid--dragging');
        });
      });

      $pill.addEventListener('dragend', () => {
        $pill.classList.remove('calendar-event--dragging');
        this.$grid.classList.remove('calendar-grid--dragging');
        this.$grid.querySelectorAll('.calendar-cell--drag-over').forEach(($el) => {
          $el.classList.remove('calendar-cell--drag-over');
        });
      });
    });

    // Drop targets: cells and time slots
    const $dropTargets = this.$grid.querySelectorAll('.calendar-cell, .calendar-week-time-slot');
    $dropTargets.forEach(($cell) => {
      $cell.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        $cell.classList.add('calendar-cell--drag-over');
      });

      $cell.addEventListener('dragleave', () => {
        $cell.classList.remove('calendar-cell--drag-over');
      });

      $cell.addEventListener('drop', (e) => {
        e.preventDefault();
        $cell.classList.remove('calendar-cell--drag-over');

        const campaignId = e.dataTransfer.getData('text/plain');
        const newDate = $cell.dataset.date;
        if (!campaignId || !newDate) {
          return;
        }

        // Only allow rescheduling editable campaigns (pending one-offs and recurring templates)
        const campaign = core.getCampaign(campaignId);
        if (!campaign || !core.isEditable(campaign)) {
          return;
        }

        // Build new sendAt from drop target
        const parts = newDate.split('-');
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));

        // If dropping on a time slot, use that hour
        if ($cell.dataset.hour) {
          d.setHours(parseInt($cell.dataset.hour), 0, 0, 0);
        } else {
          // Keep original time
          const originalDate = new Date(campaign.sendAt * 1000);
          d.setHours(originalDate.getHours(), originalDate.getMinutes(), 0, 0);
        }

        const newSendAtUNIX = Math.floor(d.getTime() / 1000);
        const newSendAtISO = d.toISOString();

        // Optimistic update: render immediately, rollback on failure
        const rollback = core.optimisticUpdateSendAt(campaignId, newSendAtUNIX);

        core.eventsManager.rescheduleCampaign(campaignId, newSendAtISO)
          .catch((err) => {
            console.error('Failed to reschedule campaign:', err);
            if (rollback) {
              rollback();
            }
          });
      });
    });
  }

  // ============================================
  // Utility
  // ============================================
  _getHours() {
    const hours = [];
    for (let h = 0; h < 24; h++) {
      const period = h >= 12 ? 'PM' : 'AM';
      const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
      hours.push({
        value: h,
        label: `${display} ${period}`,
      });
    }
    return hours;
  }

  _formatTime(timeStr) {
    if (!timeStr) {
      return '';
    }
    const [h, m] = timeStr.split(':').map(Number);
    const period = h >= 12 ? 'p' : 'a';
    const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${display}${m > 0 ? ':' + String(m).padStart(2, '0') : ''}${period}`;
  }

}
