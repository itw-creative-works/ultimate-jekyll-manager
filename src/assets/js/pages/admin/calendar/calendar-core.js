/**
 * Calendar Core
 * State management, date math, Firestore real-time sync, recurrence
 * computation, and public API.
 * Reads from Firestore marketing-campaigns collection directly.
 */

// View modes
export const VIEW_MODES = ['day', 'week', 'month', 'year', 'list'];

// Day abbreviations
export const DAY_ABBREVS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Month names
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Recurrence pattern options
export const RECURRENCE_PATTERNS = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];

// Campaign type colors
export const TYPE_COLORS = {
  email: '#2196F3',
  push: '#4CAF50',
};

// Campaign status styles
export const STATUS_STYLES = {
  pending: { opacity: 1, icon: null },
  sent: { opacity: 0.55, icon: 'circle-check' },
  failed: { opacity: 1, icon: 'triangle-exclamation' },
};

// Display type constants
export const DISPLAY_TYPES = {
  ONE_OFF: 'one-off',
  RECURRING_TEMPLATE: 'recurring-template',
  RECURRING_HISTORY: 'recurring-history',
};

export default class CalendarCore {
  constructor(webManager) {
    this.webManager = webManager;
    this.currentDate = new Date();
    this.viewMode = 'month';
    this.campaigns = new Map();       // Real Firestore docs
    this._virtualEvents = null;       // Cached virtual events (regenerated on data change)
    this.renderer = null;
    this.eventsManager = null;
    this.$root = document.getElementById('calendar-root');
    this._unsubscribe = null;
  }

  // ============================================
  // Initialization
  // ============================================
  setRenderer(renderer) {
    this.renderer = renderer;
  }

  setEventsManager(eventsManager) {
    this.eventsManager = eventsManager;
  }

  async initialize() {
    await this._loadRecurringTemplates();
    this._subscribeToRange();
  }

  destroy() {
    if (this._unsubscribeRange) {
      this._unsubscribeRange();
      this._unsubscribeRange = null;
    }
    if (this._unsubscribeRecurring) {
      this._unsubscribeRecurring();
      this._unsubscribeRecurring = null;
    }
  }

  // ============================================
  // Navigation
  // ============================================
  navigate(direction) {
    const d = this.currentDate;

    switch (this.viewMode) {
      case 'day':
        d.setDate(d.getDate() + direction);
        break;
      case 'week':
        d.setDate(d.getDate() + (7 * direction));
        break;
      case 'month':
        d.setMonth(d.getMonth() + direction);
        break;
      case 'year':
        d.setFullYear(d.getFullYear() + direction);
        break;
      case 'list':
        d.setDate(d.getDate() + (30 * direction));
        break;
    }

    this._virtualEvents = null;
    this.renderer.render(); // Instant render from cache
    this._subscribeToRange(); // Background fetch for accurate data
    this._dispatch('calendar:navigate');
  }

  goToToday() {
    this.currentDate = new Date();
    this._virtualEvents = null;
    this.renderer.render();
    this._subscribeToRange();
    this._dispatch('calendar:navigate');
  }

  setView(mode) {
    if (!VIEW_MODES.includes(mode)) {
      return;
    }

    this.viewMode = mode;
    this._virtualEvents = null;
    this.renderer.render();
    this._subscribeToRange();
    this._dispatch('calendar:viewchange');
  }

  // ============================================
  // Campaign Display Type Detection
  // ============================================
  getCampaignDisplayType(doc) {
    if (doc.recurrence) {
      return DISPLAY_TYPES.RECURRING_TEMPLATE;
    }
    if (doc.recurringId) {
      return DISPLAY_TYPES.RECURRING_HISTORY;
    }
    return DISPLAY_TYPES.ONE_OFF;
  }

  isEditable(doc) {
    // Virtual occurrences are not editable (they don't exist as docs)
    if (doc._virtual) {
      return false;
    }
    // History records are read-only
    if (doc.recurringId) {
      return false;
    }
    // Sent/failed are read-only
    if (doc.status === 'sent' || doc.status === 'failed') {
      return false;
    }
    // Pending one-offs and recurring templates are editable
    return true;
  }

  // ============================================
  // Optimistic Updates
  // ============================================

  /**
   * Optimistically update a campaign's sendAt locally and re-render.
   * Returns a rollback function that restores the original value.
   */
  optimisticUpdateSendAt(id, newSendAtUNIX) {
    const campaign = this.campaigns.get(id);
    if (!campaign) {
      return null;
    }

    const originalSendAt = campaign.sendAt;
    campaign.sendAt = newSendAtUNIX;
    this._virtualEvents = null; // Clear virtual cache
    this.renderer.render();

    // Return rollback function
    return () => {
      campaign.sendAt = originalSendAt;
      this._virtualEvents = null;
      this.renderer.render();
    };
  }

  // ============================================
  // Campaign Accessors
  // ============================================
  getCampaign(id) {
    // Check real Firestore docs first
    const real = this.campaigns.get(id);
    if (real) {
      return real;
    }

    // Check virtual events (synthetic IDs like "templateId__virtual__timestamp")
    const virtuals = this._getVirtualEvents();
    for (const v of virtuals) {
      if (v.id === id) {
        return v;
      }
    }

    return null;
  }

  /**
   * Get all display items for a given date, including virtual recurring occurrences.
   * Merges: one-off docs + recurring history docs + virtual occurrences (not overlapping with history).
   */
  getCampaignsForDate(dateStr) {
    const items = [];
    const historyDatesById = this._getHistoryDateMap();

    // Real Firestore docs that land on this date (skip recurring templates — they render via virtuals)
    this.campaigns.forEach((c) => {
      if (c.recurrence) {
        return;
      }
      if (this._campaignDate(c) === dateStr) {
        items.push(c);
      }
    });

    // Virtual recurring occurrences for this date
    const virtuals = this._getVirtualEvents();
    virtuals.forEach((v) => {
      if (this._campaignDate(v) !== dateStr) {
        return;
      }
      // Don't add a virtual if a history record already covers this date for this recurring template
      const key = `${v._recurringSourceId}:${dateStr}`;
      if (historyDatesById.has(key)) {
        return;
      }
      items.push(v);
    });

    return items.sort((a, b) => a.sendAt - b.sendAt);
  }

  /**
   * Get all display items sorted chronologically (for list view).
   * Merges non-recurring docs + virtual recurring occurrences.
   */
  getAllCampaignsSorted() {
    const items = [];
    const historyDatesById = this._getHistoryDateMap();

    // Real non-recurring docs
    this.campaigns.forEach((c) => {
      if (c.recurrence) {
        return;
      }
      items.push(c);
    });

    // Virtual recurring occurrences (suppress where history exists)
    const virtuals = this._getVirtualEvents();
    virtuals.forEach((v) => {
      const dateStr = this._campaignDate(v);
      const key = `${v._recurringSourceId}:${dateStr}`;
      if (historyDatesById.has(key)) {
        return;
      }
      items.push(v);
    });

    return items.sort((a, b) => a.sendAt - b.sendAt);
  }

  // ============================================
  // Campaign Helpers
  // ============================================

  /**
   * Get YYYY-MM-DD string from a campaign's sendAt timestamp
   */
  _campaignDate(campaign) {
    const d = new Date(campaign.sendAt * 1000);
    return this._formatDate(d);
  }

  /**
   * Get HH:MM string from a campaign's sendAt timestamp
   */
  campaignTime(campaign) {
    const d = new Date(campaign.sendAt * 1000);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  /**
   * Get duration in minutes (default 60 for display purposes)
   */
  campaignDuration() {
    return 60;
  }

  /**
   * Get color based on campaign type
   */
  campaignColor(campaign) {
    return TYPE_COLORS[campaign.type] || TYPE_COLORS.email;
  }

  /**
   * Get status style info
   */
  campaignStatusStyle(campaign) {
    return STATUS_STYLES[campaign.status] || STATUS_STYLES.pending;
  }

  // ============================================
  // Recurrence: Virtual Event Generation
  // ============================================

  /**
   * Build a map of recurringId:dateStr → true for all history records.
   * Used to suppress virtual occurrences on dates that have real history docs.
   */
  _getHistoryDateMap() {
    const map = new Map();
    this.campaigns.forEach((c) => {
      if (!c.recurringId) {
        return;
      }
      const dateStr = this._campaignDate(c);
      map.set(`${c.recurringId}:${dateStr}`, true);
    });
    return map;
  }

  /**
   * Get virtual events for recurring templates within the visible range.
   * Cached per render cycle; cleared when Firestore data changes.
   */
  _getVirtualEvents() {
    if (this._virtualEvents) {
      return this._virtualEvents;
    }

    const { startUNIX, endUNIX } = this._getVisibleRange();
    const virtuals = [];

    this.campaigns.forEach((c) => {
      if (!c.recurrence) {
        return;
      }
      const occurrences = this._generateOccurrences(c, startUNIX, endUNIX);
      virtuals.push(...occurrences);
    });

    this._virtualEvents = virtuals;
    return virtuals;
  }

  /**
   * Generate virtual occurrence items for a recurring template within a date range.
   */
  _generateOccurrences(template, startUNIX, endUNIX) {
    const recurrence = template.recurrence;
    const hour = recurrence.hour || 0;
    const occurrences = [];

    // Start from the beginning of the visible range and iterate forward
    const startDate = new Date(startUNIX * 1000);
    const endDate = new Date(endUNIX * 1000);

    // Find the first occurrence at or after startDate based on pattern
    let cursor = this._findFirstOccurrence(recurrence, startDate);

    // Safety: limit iterations
    let maxIterations = 400;

    while (cursor <= endDate && maxIterations-- > 0) {
      const cursorUNIX = Math.floor(cursor.getTime() / 1000);

      if (cursorUNIX >= startUNIX && cursorUNIX <= endUNIX) {
        occurrences.push({
          id: `${template.id}__virtual__${cursorUNIX}`,
          sendAt: cursorUNIX,
          status: 'pending',
          type: template.type,
          settings: template.settings,
          recurrence: template.recurrence,
          _virtual: true,
          _recurringSourceId: template.id,
        });
      }

      cursor = this._advanceCursor(recurrence, cursor);
    }

    return occurrences;
  }

  /**
   * Find the first occurrence at or after the given date.
   */
  _findFirstOccurrence(recurrence, startDate) {
    const hour = recurrence.hour || 0;
    const day = recurrence.day || 1;
    const month = recurrence.month || 1;

    switch (recurrence.pattern) {
      case 'daily': {
        const d = new Date(startDate);
        d.setHours(hour, 0, 0, 0);
        if (d < startDate) {
          d.setDate(d.getDate() + 1);
        }
        return d;
      }
      case 'weekly': {
        // day = day of week (0=Sun, 1=Mon, ..., 6=Sat)
        const d = new Date(startDate);
        d.setHours(hour, 0, 0, 0);
        const currentDay = d.getDay();
        let daysUntil = day - currentDay;
        if (daysUntil < 0 || (daysUntil === 0 && d < startDate)) {
          daysUntil += 7;
        }
        d.setDate(d.getDate() + daysUntil);
        return d;
      }
      case 'monthly': {
        // day = day of month
        const d = new Date(startDate.getFullYear(), startDate.getMonth(), day, hour, 0, 0, 0);
        if (d < startDate) {
          d.setMonth(d.getMonth() + 1);
        }
        return d;
      }
      case 'quarterly': {
        // Fires on day of month every 3 months, starting from month 0, 3, 6, 9
        const quarterMonths = [0, 3, 6, 9];
        for (const qm of quarterMonths) {
          const d = new Date(startDate.getFullYear(), qm, day, hour, 0, 0, 0);
          if (d >= startDate) {
            return d;
          }
        }
        // Next year's first quarter
        return new Date(startDate.getFullYear() + 1, 0, day, hour, 0, 0, 0);
      }
      case 'yearly': {
        // month = month (1-12), day = day of month
        const m = month - 1; // Convert 1-based to 0-based
        const d = new Date(startDate.getFullYear(), m, day, hour, 0, 0, 0);
        if (d < startDate) {
          d.setFullYear(d.getFullYear() + 1);
        }
        return d;
      }
      default:
        return new Date(startDate);
    }
  }

  /**
   * Advance the cursor to the next occurrence.
   */
  _advanceCursor(recurrence, cursor) {
    const d = new Date(cursor);

    switch (recurrence.pattern) {
      case 'daily':
        d.setDate(d.getDate() + 1);
        break;
      case 'weekly':
        d.setDate(d.getDate() + 7);
        break;
      case 'monthly':
        d.setMonth(d.getMonth() + 1);
        break;
      case 'quarterly':
        d.setMonth(d.getMonth() + 3);
        break;
      case 'yearly':
        d.setFullYear(d.getFullYear() + 1);
        break;
      default:
        // Prevent infinite loop
        d.setDate(d.getDate() + 1);
        break;
    }

    return d;
  }

  // ============================================
  // Date Utilities
  // ============================================
  getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }

  getMonthGrid() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = this.getDaysInMonth(year, month);
    const daysInPrevMonth = this.getDaysInMonth(year, month - 1);

    const cells = [];

    // Previous month trailing days
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      cells.push({ date: d, outside: true });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      cells.push({ date: d, outside: false });
    }

    // Next month leading days (fill to complete 6 rows = 42 cells)
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      cells.push({ date: d, outside: true });
    }

    return cells;
  }

  getWeekDates() {
    const d = new Date(this.currentDate);
    const day = d.getDay();
    d.setDate(d.getDate() - day);

    const dates = [];
    for (let i = 0; i < 7; i++) {
      dates.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }

    return dates;
  }

  formatPeriodLabel() {
    const d = this.currentDate;
    const month = MONTH_NAMES[d.getMonth()];
    const year = d.getFullYear();

    switch (this.viewMode) {
      case 'day':
        return `${DAY_ABBREVS[d.getDay()]}, ${month} ${d.getDate()}, ${year}`;
      case 'week': {
        const weekDates = this.getWeekDates();
        const start = weekDates[0];
        const end = weekDates[6];
        const startMonth = MONTH_NAMES[start.getMonth()].slice(0, 3);
        const endMonth = MONTH_NAMES[end.getMonth()].slice(0, 3);
        if (start.getMonth() === end.getMonth()) {
          return `${startMonth} ${start.getDate()} – ${end.getDate()}, ${year}`;
        }
        return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${year}`;
      }
      case 'month':
        return `${month} ${year}`;
      case 'year':
        return `${year}`;
      case 'list': {
        const { startUNIX, endUNIX } = this._getVisibleRange();
        const startDate = new Date(startUNIX * 1000);
        const endDate = new Date(endUNIX * 1000);
        const startLabel = `${MONTH_NAMES[startDate.getMonth()].slice(0, 3)} ${startDate.getDate()}`;
        const endLabel = `${MONTH_NAMES[endDate.getMonth()].slice(0, 3)} ${endDate.getDate()}, ${endDate.getFullYear()}`;
        return `${startLabel} – ${endLabel}`;
      }
      default:
        return '';
    }
  }

  isToday(date) {
    const today = new Date();
    return date.getFullYear() === today.getFullYear()
      && date.getMonth() === today.getMonth()
      && date.getDate() === today.getDate();
  }

  _formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  formatDate(date) {
    return this._formatDate(date);
  }

  // ============================================
  // Firestore: One-time recurring template load
  // ============================================
  async _loadRecurringTemplates() {
    try {
      const { collection, query, where, getDocs, onSnapshot } = await import('firebase/firestore');
      const db = this.webManager.firebaseFirestore;
      const colRef = collection(db, 'marketing-campaigns');

      // Fetch all recurring templates (IDs prefixed with _recurring-)
      // These are loaded once and kept in memory since virtuals are computed client-side
      const recurringDocs = await getDocs(query(
        colRef,
        where('__name__', '>=', '_recurring-'),
        where('__name__', '<=', '_recurring-\uf8ff'),
      ));

      recurringDocs.forEach((doc) => {
        const data = doc.data();
        data.id = doc.id;
        console.log('[Calendar] Recurring template:', doc.id, data);
        this.campaigns.set(doc.id, data);
      });

      // Also listen for changes to recurring templates in real-time
      this._unsubscribeRecurring = onSnapshot(query(
        colRef,
        where('__name__', '>=', '_recurring-'),
        where('__name__', '<=', '_recurring-\uf8ff'),
      ), (snapshot) => {
        // Remove old recurring templates, add fresh ones
        for (const id of this.campaigns.keys()) {
          if (id.startsWith('_recurring-')) {
            this.campaigns.delete(id);
          }
        }
        snapshot.forEach((doc) => {
          const data = doc.data();
          data.id = doc.id;
          this.campaigns.set(doc.id, data);
        });
        this._virtualEvents = null;
        this.renderer.render();
      });

      this.renderer.render();
    } catch (error) {
      console.error('Calendar: Failed to load recurring templates', error);
    }
  }

  // ============================================
  // Firestore: Range-based subscription (view-dependent)
  // ============================================
  async _subscribeToRange() {
    // Unsubscribe from previous range listener
    if (this._unsubscribeRange) {
      this._unsubscribeRange();
      this._unsubscribeRange = null;
    }

    const { startUNIX, endUNIX } = this._getVisibleRange();

    try {
      const { collection, query, where, orderBy, onSnapshot } = await import('firebase/firestore');
      const db = this.webManager.firebaseFirestore;

      const rangeQuery = query(
        collection(db, 'marketing-campaigns'),
        where('sendAt', '>=', startUNIX),
        where('sendAt', '<=', endUNIX),
        orderBy('sendAt', 'asc'),
      );

      this._unsubscribeRange = onSnapshot(rangeQuery, (snapshot) => {
        // Remove old non-recurring docs (keep recurring templates)
        for (const id of this.campaigns.keys()) {
          if (!id.startsWith('_recurring-')) {
            this.campaigns.delete(id);
          }
        }

        // Add range-matched docs
        snapshot.forEach((doc) => {
          const data = doc.data();
          data.id = doc.id;
          console.log('[Calendar] Firestore doc:', doc.id, data);
          this.campaigns.set(doc.id, data);
        });

        console.log('[Calendar] Total docs:', this.campaigns.size);
        this._virtualEvents = null;
        this._dispatch('calendar:datachange');
        this.renderer.render();
      }, (error) => {
        console.error('Calendar: Firestore range subscription error', error);
      });
    } catch (error) {
      console.error('Calendar: Failed to subscribe to range', error);
    }
  }

  /**
   * Calculate the visible date range as unix timestamps.
   * Adds buffer to capture events on boundary days.
   */
  _getVisibleRange() {
    const d = this.currentDate;
    let start, end;

    switch (this.viewMode) {
      case 'day':
        start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
        break;
      case 'week': {
        const weekDates = this.getWeekDates();
        start = weekDates[0];
        end = new Date(weekDates[6]);
        end.setDate(end.getDate() + 1);
        break;
      }
      case 'month': {
        // Include overflow days from prev/next month (6 rows of 7 = 42 days)
        const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
        start = new Date(d.getFullYear(), d.getMonth(), 1 - firstDay);
        end = new Date(start);
        end.setDate(end.getDate() + 42);
        break;
      }
      case 'year':
        start = new Date(d.getFullYear(), 0, 1);
        end = new Date(d.getFullYear() + 1, 0, 1);
        break;
      case 'list':
        start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 30);
        end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 60);
        break;
    }

    return {
      startUNIX: Math.floor(start.getTime() / 1000),
      endUNIX: Math.floor(end.getTime() / 1000),
    };
  }

  // ============================================
  // Event Dispatching
  // ============================================
  _dispatch(eventName, detail) {
    this.$root.dispatchEvent(new CustomEvent(eventName, { detail }));
  }
}
