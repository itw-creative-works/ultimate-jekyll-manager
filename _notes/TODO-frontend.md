Frontend TODO
- sentry in WM
- chatsy
  - remake chatsy into a module that we can install here and then users can load it via cdnjs instead of our website
- contact form with tracking and form-manager and slapform

- save utm tags, send during checkout, signup, etc

- token redirect for auth system (for auth with desktop apps, etc)

ensure blog, article, posts, etc all use proper HTML semantics tags, aria, etc

js refactor
- make all fns await asyn operations
- order the fn definitions in the order they are called (most import/toplevel first then the rest. put all tracking fns at the bottom)
- move export to top and do not use init() fn, just call all fns inside dom.ready OR the main export (depends on the structure)
- track errors w sentry, not ga4/fb/tiktok
- add Manager, options back to each index.js for standardization
- for stanndardization, also ALWAYS set webManager = Manager.webManager in the index.js

pages
- blog + post
- about
- contact
- team + member
- extension and download

MAKE OUR CUSTOM THEME CLASSY!!

for pages like pricing, home, about etc
- put default frontmatter in the default pages so user can override

NEW PLAN NAME STANDARD
1. Basic, Starter, Pro, Max
1. Basic, Starter, Plus, Pro

Implement account resolver

https://docs.stripe.com/payments/link/express-checkout-element-link

// // Load page specific scripts
// if (url.includes('/pricing')) {
//   dom.loadScript({src: 'https://cdn.itwcreativeworks.com/assets/general/js/pricing-page-handler/index.js'})
// } else if (url.includes('/download')) {
//   dom.loadScript({src: 'https://cdn.itwcreativeworks.com/assets/general/js/download-page-handler/index.js'})
// } else if (url.includes('/browser-extension') || url.includes('/extension')) {
//   dom.loadScript({src: 'https://cdn.itwcreativeworks.com/assets/general/js/browser-extension-page-handler/index.js'})
// } else if (window.location.pathname.endsWith('.html')) {
//   // Redirect and remove .html
//   window.location.pathname = window.location.pathname.replace('.html', '');
// }



// // Save user auth data
// Manager.auth().ready(function (user) {
//   setupTracking(user);

//   storage.set('user.auth.uid', user.uid);
//   storage.set('user.auth.email', user.email);
// })
