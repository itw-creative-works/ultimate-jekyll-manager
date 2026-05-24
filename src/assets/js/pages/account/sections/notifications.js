/**
 * Notifications section — marketing email consent toggle.
 *
 * Reads consent.marketing.status from the user doc for the toggle's initial state.
 * User flips the toggle then clicks Save; on submit, POSTs to
 * /backend-manager/marketing/email-preferences with subscribe|unsubscribe.
 * The server writes consent.marketing to the user doc + syncs SendGrid + Beehiiv.
 *
 * Uses FormManager for standard in-flight/success/error UX. On failure, the
 * error message is shown via FormManager and the toggle stays where the user
 * left it — they can try Save again without re-flipping.
 */
import authorizedFetch from '__main_assets__/js/libs/authorized-fetch.js';
import { FormManager } from '__main_assets__/js/libs/form-manager.js';
import webManager from 'web-manager';

const FORM_ID = 'marketing-emails-form';
const TOGGLE_ID = 'marketing-emails';
const GRANT_DATE_ID = 'marketing-emails-grant-date';

let formManager = null;

export function init() {
  const $form = document.getElementById(FORM_ID);
  if (!$form) {
    return;
  }

  formManager = new FormManager(`#${FORM_ID}`, {
    autoReady: false,          // Wait for loadData() to populate the toggle
    allowResubmit: true,       // Save → flip again → Save again is normal flow
    warnOnUnsavedChanges: false, // Toggle changes are explicit-Save, not draft
  });

  formManager.on('submit', async ({ data }) => {
    const action = data.enabled ? 'subscribe' : 'unsubscribe';

    const response = await authorizedFetch(`${webManager.getApiUrl()}/backend-manager/marketing/email-preferences`, {
      method: 'POST',
      timeout: 60000,
      response: 'json',
      tries: 2,
      body: { action },
    });

    if (!response?.success) {
      throw new Error(response?.message || 'Failed to update email preferences. Please try again.');
    }

    formManager.showSuccess(
      data.enabled
        ? 'Subscribed to email updates.'
        : 'Unsubscribed from email updates.'
    );

    // Hide the grant-date line on unsubscribe (the displayed date was the OLD grant;
    // informational only). loadData() will repopulate it on the next page load if
    // the user re-subscribes.
    if (!data.enabled) {
      const $date = document.getElementById(GRANT_DATE_ID);
      if ($date) {
        $date.classList.add('d-none');
      }
    }
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
