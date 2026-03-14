/**
 * Admin Notifications Index Page JavaScript
 */

// Libraries
import { setStatValue } from '__main_assets__/js/libs/admin-helpers.js';

// State
let webManager = null;

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

      loadStats();
    });

    return resolve();
  });
};

// Show unauthenticated state
function showUnauthenticated() {
  document.querySelectorAll('.spinner-border').forEach((spinner) => {
    spinner.replaceWith(Object.assign(document.createElement('span'), {
      className: 'text-muted small',
      textContent: 'Sign in to view',
    }));
  });
}

// Load stat card counts
async function loadStats() {
  const { collection, getCountFromServer } = await import('firebase/firestore');
  const db = webManager.firebaseFirestore;

  const [pushSubscribers, totalUsers] = await Promise.allSettled([
    getCountFromServer(collection(db, 'notifications')),
    getCountFromServer(collection(db, 'users')),
  ]);

  setStatValue('stat-push-subscribers', pushSubscribers);
  setStatValue('stat-total-users', totalUsers);
}
