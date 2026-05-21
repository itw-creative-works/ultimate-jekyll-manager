/**
 * Notifications section — marketing email consent toggle.
 *
 * Reads consent.marketing.status from the user doc for the toggle's initial state.
 * On toggle, POSTs to /backend-manager/marketing/email-preferences with subscribe|unsubscribe.
 * The server writes consent.marketing to the user doc + syncs SendGrid + Beehiiv.
 */
import authorizedFetch from '__main_assets__/js/libs/authorized-fetch.js';
import webManager from 'web-manager';

const TOGGLE_ID = 'marketing-emails';
const GRANT_DATE_ID = 'marketing-emails-grant-date';

export function init() {
  const $toggle = document.getElementById(TOGGLE_ID);
  if (!$toggle) {
    return;
  }
  $toggle.addEventListener('change', handleToggleChange);
}

export function loadData(account) {
  if (!account) {
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
}

async function handleToggleChange(event) {
  const $toggle = event.target;
  const wasChecked = !$toggle.checked; // checkbox already flipped at this point
  const isEnabled = $toggle.checked;
  const action = isEnabled ? 'subscribe' : 'unsubscribe';

  // Disable while in-flight so rapid clicks don't fire multiple requests
  $toggle.disabled = true;

  try {
    const response = await authorizedFetch(`${webManager.getApiUrl()}/backend-manager/marketing/email-preferences`, {
      method: 'POST',
      timeout: 15000,
      response: 'json',
      tries: 2,
      body: { action },
    });

    if (response.error || response.data?.success !== true) {
      throw new Error(response.message || response.error || 'Failed to update email preferences.');
    }

    webManager.utilities().showNotification(
      isEnabled ? 'Subscribed to email updates.' : 'Unsubscribed from email updates.',
      { type: 'success' }
    );

    // Hide the grant-date line on unsubscribe (it was the OLD grant date — informational only).
    // It'll get repopulated the next time loadData runs if the user re-subscribes.
    if (!isEnabled) {
      const $date = document.getElementById(GRANT_DATE_ID);
      if ($date) {
        $date.classList.add('d-none');
      }
    }
  } catch (error) {
    console.error('Failed to update marketing consent:', error);

    // Revert toggle on failure so UI matches server state
    $toggle.checked = wasChecked;

    webManager.utilities().showNotification(
      'Failed to update email preferences. Please try again.',
      { type: 'danger' }
    );
  } finally {
    $toggle.disabled = false;
  }
}
