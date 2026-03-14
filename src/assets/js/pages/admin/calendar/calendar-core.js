/**
 * Calendar Core
 * State management, date math, localStorage persistence, and public API.
 */

// Storage key
const STORAGE_KEY = '_admin.calendar.events';

// Default event colors
export const EVENT_COLORS = [
  '#4CAF50', '#2196F3', '#FF9800', '#F44336',
  '#9C27B0', '#00BCD4', '#795548', '#607D8B',
];

// View modes
export const VIEW_MODES = ['day', 'week', 'month', 'year'];

// Day abbreviations
export const DAY_ABBREVS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Month names
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default class CalendarCore {
  constructor() {
    this.currentDate = new Date();
    this.viewMode = 'month';
    this.events = new Map();
    this.renderer = null;
    this.eventsManager = null;
    this.$root = document.getElementById('calendar-root');

    this._loadEvents();
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

  initialize() {
    this.renderer.render();
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
    }

    this._dispatch('calendar:navigate');
    this.renderer.render();
  }

  goToToday() {
    this.currentDate = new Date();
    this._dispatch('calendar:navigate');
    this.renderer.render();
  }

  setView(mode) {
    if (!VIEW_MODES.includes(mode)) {
      return;
    }

    this.viewMode = mode;
    this._dispatch('calendar:viewchange');
    this.renderer.render();
  }

  // ============================================
  // Event CRUD
  // ============================================
  addEvent(eventData) {
    const id = 'evt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const event = {
      id,
      title: eventData.title || 'Untitled',
      type: eventData.type || 'newsletter',
      date: eventData.date || this._formatDate(this.currentDate),
      time: eventData.time || '09:00',
      duration: eventData.duration || 60,
      status: eventData.status || 'draft',
      color: eventData.color || EVENT_COLORS[0],
      data: eventData.data || {},
    };

    this.events.set(id, event);
    this._saveEvents();
    this._dispatch('calendar:eventchange', { action: 'add', event });
    this.renderer.render();

    return id;
  }

  updateEvent(id, changes) {
    const event = this.events.get(id);
    if (!event) {
      return null;
    }

    // Deep merge data if provided
    if (changes.data) {
      changes.data = { ...event.data, ...changes.data };
    }

    Object.assign(event, changes);
    this._saveEvents();
    this._dispatch('calendar:eventchange', { action: 'update', event });
    this.renderer.render();

    return event;
  }

  removeEvent(id) {
    const event = this.events.get(id);
    if (!event) {
      return false;
    }

    this.events.delete(id);
    this._saveEvents();
    this._dispatch('calendar:eventchange', { action: 'remove', event });
    this.renderer.render();

    return true;
  }

  getEvent(id) {
    return this.events.get(id) || null;
  }

  getEvents(filter) {
    const events = Array.from(this.events.values());
    if (!filter) {
      return events;
    }

    return events.filter((evt) => {
      if (filter.date && evt.date !== filter.date) {
        return false;
      }
      if (filter.type && evt.type !== filter.type) {
        return false;
      }
      if (filter.status && evt.status !== filter.status) {
        return false;
      }
      return true;
    });
  }

  getEventsForDate(dateStr) {
    return this.getEvents({ date: dateStr }).sort((a, b) => a.time.localeCompare(b.time));
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
    }
  }

  isToday(date) {
    const today = new Date();
    return date.getFullYear() === today.getFullYear()
      && date.getMonth() === today.getMonth()
      && date.getDate() === today.getDate();
  }

  // Format Date to YYYY-MM-DD
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
  // Persistence
  // ============================================
  _loadEvents() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }

      const arr = JSON.parse(raw);
      arr.forEach((evt) => {
        this.events.set(evt.id, evt);
      });
    } catch (e) {
      // Corrupt data, start fresh
      console.warn('Calendar: Failed to load events from localStorage', e);
    }
  }

  _saveEvents() {
    try {
      const arr = Array.from(this.events.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch (e) {
      console.warn('Calendar: Failed to save events to localStorage', e);
    }
  }

  // ============================================
  // Event Dispatching
  // ============================================
  _dispatch(eventName, detail) {
    this.$root.dispatchEvent(new CustomEvent(eventName, { detail }));
  }
}
