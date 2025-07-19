// Libraries
// ...

// Variables
let hasLostFocus = false;
let launchTimeout;
let errorTimeout;

// Elements
let $launchButton;
let $downloadButton;
let $errorAlert;

// Module
export default (Manager) => {
  return new Promise(async function (resolve, reject) {
    // Shortcuts
    const { webManager } = Manager;

    // Get elements and URL parameters
    $launchButton = document.getElementById('launch-button');
    $downloadButton = document.getElementById('download-button');
    $errorAlert = document.getElementById('error-alert');
    const urlParams = window.location.search;

    // Enable both buttons
    [$launchButton, $downloadButton].forEach(button => {
      button.removeAttribute('disabled');
      button.classList.remove('disabled');
    });

    // window.addEventListener('blur', () => {
    //   hasLostFocus = true;
    //   if (launchTimeout) {
    //     clearTimeout(launchTimeout);
    //   }
    // });

    // window.addEventListener('focus', () => {
    //   if (hasLostFocus) {
    //     window.close();
    //   }
    // });

    // Build app URL with parameters
    const baseUrl = $launchButton.getAttribute('href');
    const appUrl = `${baseUrl}${urlParams}`;
    $launchButton.setAttribute('href', appUrl);

    // Handle launch button click
    launchApp(appUrl);

    // Handle launch button click
    $launchButton.addEventListener('click', (event) => {
      event.preventDefault();
      launchApp(appUrl);
    });

    // Close window after 5 seconds regardless
    // launchTimeout = setTimeout(() => {
    //   if (!hasLostFocus) {
    //     console.log('App did not launch, closing window');
    //   }
    //   window.close();
    // }, 5000)

    // Resolve
    return resolve();
  });
}

function launchApp(appUrl) {
    // Attempt to launch app
  const launchTime = Date.now();
  window.location.href = appUrl;

  // Clear any previous error timeout
  clearTimeout(errorTimeout);
  $errorAlert.setAttribute('hidden', true);

  // Check if deep link failed after 2 seconds
  errorTimeout = setTimeout(() => {
    if (hasLostFocus) {
      console.log('Deep link launched app successfully');
    } else {
      console.log('Deep link failed to launch app');
      $errorAlert.removeAttribute('hidden');
    }
  }, 1000);
}
