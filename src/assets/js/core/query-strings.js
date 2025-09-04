// Query Strings Module
export default function (Manager, options) {
  // Shortcuts
  const { webManager } = Manager;

  // Process query strings when DOM is ready
  webManager.dom().ready().then(() => {
    processQueryStrings();
  });

  function processQueryStrings() {
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);

    // Process affiliate/referral parameters
    processAffiliateParams(urlParams);

    // Process UTM parameters
    processUTMParams(urlParams);
  }

  function processAffiliateParams(urlParams) {
    // Check for aff or ref parameter
    const affParam = urlParams.get('aff') || urlParams.get('ref');

    // Quit if no affiliate parameter
    if (!affParam) {
      return;
    }

    // Save to localStorage with timestamp
    const affiliateData = {
      code: affParam,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      page: window.location.pathname
    };

    // Use webManager storage to save affiliate data
    webManager.storage().set('marketing.affiliate', affiliateData);
  }

  function processUTMParams(urlParams) {
    // Define UTM parameters to capture
    const utmParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content'
    ];

    // Check if any UTM parameters exist
    const utmData = {};
    let hasUTM = false;

    utmParams.forEach(param => {
      const value = urlParams.get(param);
      if (value) {
        utmData[param] = value;
        hasUTM = true;
      }
    });

    // Quit if no UTM parameters
    if (!hasUTM) {
      return;
    }

    // Add metadata
    utmData.timestamp = new Date().toISOString();
    utmData.url = window.location.href;
    utmData.page = window.location.pathname;

    // Save to localStorage
    webManager.storage().set('marketing.utm', utmData);
  }
}
