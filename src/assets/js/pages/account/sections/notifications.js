/**
 * Notifications section — marketing email consent toggle.
 *
 * Reads consent.marketing.status from the user doc for the toggle's initial state.
 * On toggle change, POSTs to /backend-manager/marketing/email-preferences with
 * subscribe|unsubscribe. The server writes consent.marketing to the user doc
 * + syncs SendGrid + Beehiiv.
 *
 * Uses FormManager so the toggle inherits the standard in-flight/success/error
 * UX (notifications, disable-while-submitting, auto-revert on failure).
 */
import authorizedFetch from '__main_assets__/js/libs/authorized-fetch.js';
import { FormManager } from '__main_assets__/js/libs/form-manager.js';
import webManager from 'web-manager';

const FORM_ID = 'marketing-emails-form';
const TOGGLE_ID = 'marketing-emails';
const GRANT_DATE_ID = 'marketing-emails-grant-date';

let formManager = null;
let lastKnownChecked = false; // The toggle state on disk (after last successful submit)

export function init() {
  const $form = document.getElementById(FORM_ID);
  const $toggle = document.getElementById(TOGGLE_ID);
  if (!$form || !$toggle) {
    return;
  }

  formManager = new FormManager(`#${FORM_ID}`, {
    autoReady: false,             // Wait for loadData() to populate the toggle
    allowResubmit: true,          // User can toggle on/off repeatedly
    warnOnUnsavedChanges: false,  // Toggle persists immediately, no "unsaved" state
  });

  formManager.on('submit', async ({ data }) => {
    const action = data.enabled ? 'subscribe' : 'unsubscribe';

    let response;
    try {
      response = await authorizedFetch(`${webManager.getApiUrl()}/backend-manager/marketing/email-preferences`, {
        method: 'POST',
        timeout: 60000,
        response: 'json',
        tries: 2,
        body: { action },
      });
    } catch (e) {
      // Network / 4xx / 5xx — revert the toggle UI to last-known-good state and re-throw
      // so FormManager surfaces the error via showError().
      $toggle.checked = lastKnownChecked;
      throw new Error('Failed to update email preferences. Please try again.');
    }

    if (!response?.success) {
      $toggle.checked = lastKnownChecked;
      throw new Error(response?.message || 'Failed to update email preferences. Please try again.');
    }

    // Success: snapshot the new on-disk state.
    lastKnownChecked = data.enabled;

    formManager.showSuccess(
      data.enabled
        ? 'Subscribed to email updates.'
        : 'Unsubscribed from email updates.'
    );

    // Hide the grant-date line on unsubscribe (the displayed date was the OLD grant;
    // informational only). loadData() will repopulate it on the next page load if the
    // user re-subscribes.
    if (!data.enabled) {
      const $date = document.getElementById(GRANT_DATE_ID);
      if ($date) {
        $date.classList.add('d-none');
      }
    }
  });

  // Auto-submit when the toggle flips. Checkbox change events don't natively
  // fire form submit, so trigger it manually.
  $toggle.addEventListener('change', () => {
    formManager.submit();
  });
}

export function loadData(account) {
  if (!account || !formManager) {
    return;
  }

  const $toggle = document.getElementById(TOGGLE_ID);
  if (!$toggle) {
    return;
  }

  const isGranted = account.consent?.marketing?.status === 'granted';
  $toggle.checked = isGranted;
  lastKnownChecked = isGranted;

  // Show the original grant date if known — gives the user context on what they agreed to.
  const grantTimestamp = account.consent?.marketing?.grantedAt?.timestamp;
  if (isGranted && grantTimestamp) {
    const $date = document.getElementById(GRANT_DATE_ID);
    if ($date) {
      const date = new Date(grantTimestamp);
      $date.textContent = `Subscribed ${date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}.`;
      $date.classList.remove('d-none');
    }
  }

  formManager.ready();
}
