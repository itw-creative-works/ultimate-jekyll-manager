/**
 * Admin Calendar Page JavaScript
 */

// Libraries
import CalendarCore from './calendar-core.js';
import CalendarRenderer from './calendar-renderer.js';
import CalendarEvents from './calendar-events.js';

// State
let webManager = null;

// Module
export default (Manager) => {
  return new Promise(async function (resolve) {
    // Shortcuts
    webManager = Manager.webManager;

    // Initialize when DOM is ready
    await webManager.dom().ready();

    webManager.auth().listen({ once: true }, async (state) => {
      if (!state.user) {
        showUnauthenticated();
        return;
      }

      initialize();
    });

    // Resolve after initialization
    return resolve();
  });
};

// Initialize the calendar
function initialize() {
  const core = new CalendarCore();
  const renderer = new CalendarRenderer(core);
  const events = new CalendarEvents(core, webManager);

  core.setRenderer(renderer);
  core.setEventsManager(events);
  core.initialize();

  // Expose public API
  window.calendarAPI = {
    addEvent: (data) => core.addEvent(data),
    updateEvent: (id, changes) => core.updateEvent(id, changes),
    removeEvent: (id) => core.removeEvent(id),
    getEvent: (id) => core.getEvent(id),
    getEvents: (filter) => core.getEvents(filter),
    navigate: (direction) => core.navigate(direction),
    setView: (mode) => core.setView(mode),
    goToToday: () => core.goToToday(),
  };
}

// Show unauthenticated state
function showUnauthenticated() {
  const $grid = document.getElementById('calendar-grid');
  $grid.innerHTML = `
    <div class="d-flex align-items-center justify-content-center h-100 text-muted">
      <div class="text-center">
        <div class="mb-3" style="font-size: 3rem; opacity: 0.3;">📅</div>
        <p>Sign in to view the calendar</p>
      </div>
    </div>
  `;
}
