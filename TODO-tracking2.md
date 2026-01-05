TODO
- google tag optimization
  https://support.google.com/analytics/thread/352854513/gtag-click-tracking-causes-reflow-due-to-reading-a-innertext-a-textcontent?hl=en


- SW update error (devtools check update on reload, then reload, notice it goes forever and then logs an error
  // Private: Set up update handlers
  _setupUpdateHandlers(registration) {
    // Listen for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;

      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New service worker available
          this._notifyUpdateCallbacks({
            type: 'update-available',
            worker: newWorker
          });

          // Automatically skip waiting and activate new worker
          if (this.manager.config.serviceWorker?.autoUpdate !== false) {
            this.skipWaiting();
          }
        }
      });
    });

- tiktok error (CHECK UJ LEGACY CODE FOR TIKTOK EXAMPLES)
Click
console.js:36 📊 gtag: {command: 'event', event: 'cookie_consent_auto_accepted', params: {…}, fullArgs: Array(3)}
console.js:36 📘 fbq: {command: 'trackCustom', event: 'CookieConsentAutoAccepted', params: {…}, fullArgs: Array(3)}
console.js:36 [TikTok Pixel] - Missing 'content_id' paramter
Issue: The 'content_id' parameter isn't being received. This is required for Video Shopping Ads (VSA).
Suggestion: Include the 'content_id' parameter in your source code. This is required for Video Shopping Ads (VSA). See https://ads.tiktok.com/help/article/standard-events-parameters?redirected=2 for more information.
eval @ console.js:36
iC @ main.MTE0NjY3MDc0MQ.js:1
r.warn @ main.MTE0NjY3MDc0MQ.js:1
r.handleEventPayloadValidate @ main.MTE0NjY3MDc0MQ.js:1
(anonymous) @ main.MTE0NjY3MDc0MQ.js:1
(anonymous) @ main.MTE0NjY3MDc0MQ.js:1
(anonymous) @ main.MTE0NjY3MDc0MQ.js:1
(anonymous) @ main.MTE0NjY3MDc0MQ.js:1
(anonymous) @ main.MTE0NjY3MDc0MQ.js:1
(anonymous) @ main.MTE0NjY3MDc0MQ.js:1
(anonymous) @ main.MTE0NjY3MDc0MQ.js:1
(anonymous) @ main.MTE0NjY3MDc0MQ.js:1
(anonymous) @ main.MTE0NjY3MDc0MQ.js:1
(anonymous) @ main.MTE0NjY3MDc0MQ.js:1
(anonymous) @ main.MTE0NjY3MDc0MQ.js:1
u @ main.MTE0NjY3MDc0MQ.js:1
(anonymous) @ main.MTE0NjY3MDc0MQ.js:1
(anonymous) @ main.MTE0NjY3MDc0MQ.js:1
(anonymous) @ main.MTE0NjY3MDc0MQ.js:1
e.track @ main.MTE0NjY3MDc0MQ.js:1
i.track @ main.MTE0NjY3MDc0MQ.js:1
(anonymous) @ main.MTE0NjY3MDc0MQ.js:1
trackCookieAutoAccepted @ cookieconsent.js:354
eval @ cookieconsent.js:126
sentryWrapped @ helpers.js:93
setTimeout
eval @ browserapierrors.js:95
autoAcceptHandler @ cookieconsent.js:124
sentryWrapped @ helpers.js:93Understand this warning
console.js:36 [TikTok Pixel] - Invalid content type
Issue: The content type for one or more of your events is not valid. Content type must be either "product", "product_group", "destination", "hotel", "flight" or "vehicle".
Suggestion: Go to your source code and update the content type. See https://ads.tiktok.com/help/article/standard-events-parameters?redirected=2 for more information.
eval @ console.js:36
iC @ main.MTE0NjY3MDc0MQ.js:1
r.warn @ main.MTE0NjY3MDc0MQ.js:1
r.handleEventPayloadValidate @ main.MTE0NjY3MDc0MQ.js:1
(anonymous) @ main.MTE0NjY3MDc0MQ.js:1
(anonymous) @ main.MTE0NjY3MDc0MQ.js:1
(anonymous) @ main.MTE0NjY3MDc0MQ.js:1
(anonymous) @ main.MTE0NjY3MDc0MQ.js:1
(anonymous) @ main.MTE0NjY3MDc0MQ.js:1
(anonymous) @ main.MTE0NjY3MDc0MQ.js:1
(anonymous) @ main.MTE0NjY3MDc0MQ.js:1
(anonymous) @ main.MTE0NjY3MDc0MQ.js:1
(anonymous) @ main.MTE0NjY3MDc0MQ.js:1
(anonymous) @ main.MTE0NjY3MDc0MQ.js:1
(anonymous) @ main.MTE0NjY3MDc0MQ.js:1
u @ main.MTE0NjY3MDc0MQ.js:1
(anonymous) @ main.MTE0NjY3MDc0MQ.js:1
(anonymous) @ main.MTE0NjY3MDc0MQ.js:1
(anonymous) @ main.MTE0NjY3MDc0MQ.js:1
e.track @ main.MTE0NjY3MDc0MQ.js:1
i.track @ main.MTE0NjY3MDc0MQ.js:1
(anonymous) @ main.MTE0NjY3MDc0MQ.js:1
trackCookieAutoAccepted @ cookieconsent.js:354
eval @ cookieconsent.js:126
sentryWrapped @ helpers.js:93
setTimeout
eval @ browserapierrors.js:95
autoAcceptHandler @ cookieconsent.js:124
sentryWrapped @ helpers.js:93Understand this warning
console.js:36 📊 gtag: {command: 'event', event: 'cookie_consent_accepted', params: {…}, fullArgs: Array(3)}
console.js:36 📘 fbq: {command: 'trackCustom', event: 'CookieConsentAccepted', params: undefined, fullArgs: Array(2)}
console.js:36 [TikTok Pixel] - Invalid content type
Issue: The content type for one or more of your events is not valid. Content type must be either "product", "product_group", "destination", "hotel", "flight" or "vehicle".
Suggestion: Go to your source code and update the content type. See https://ads.tiktok.com/help/article/standard-events-parameters?redirected=2 for more information.
