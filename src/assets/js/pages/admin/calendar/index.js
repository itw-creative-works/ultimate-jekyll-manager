/**
 * Admin Marketing Calendar Page JavaScript
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
  const core = new CalendarCore(webManager);
  const renderer = new CalendarRenderer(core);
  const events = new CalendarEvents(core, webManager);

  core.setRenderer(renderer);
  core.setEventsManager(events);
  core.initialize();
}

// Show unauthenticated state
function showUnauthenticated() {
  const $grid = document.getElementById('calendar-grid');
  $grid.innerHTML = `
    <div class="d-flex align-items-center justify-content-center h-100 text-muted">
      <div class="text-center">
        <p>Sign in to view the marketing calendar</p>
      </div>
    </div>
  `;
}
