# CHANGELOG

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## Changelog Categories

- `BREAKING` for breaking changes.
- `Added` for new features.
- `Changed` for changes in existing functionality.
- `Deprecated` for soon-to-be removed features.
- `Removed` for now removed features.
- `Fixed` for any bug fixes.
- `Security` in case of vulnerabilities.

---
## [1.1.10] - 2026-05-10
### Removed
- `through2` dependency. Replaced with native `node:stream` `Transform` across 6 gulp task files (`defaults.js`, `distribute.js`, `jsonToHtml.js`, `minifyHtml.js`, `sass.js`, `utils/template-transform.js`). through2@5 became ESM-only with no `require` condition in its exports, breaking CJS require; the built-in `Transform` is a drop-in replacement

### Changed
- Bumped `@babel/preset-env` from ^7.29.2 to ^7.29.5
- Bumped `dompurify` from ^3.3.3 to ^3.4.2
- Bumped `dotenv` from ^17.4.1 to ^17.4.2
- Bumped `fast-xml-parser` from ^5.5.11 to ^5.7.3
- Bumped `gulp-filter` from ^9.0.1 to ^10.0.0 (Node 22 ESM-CJS interop keeps `require('gulp-filter').default` working)
- Bumped `html-validate` from ^10.11.3 to ^10.16.0
- Bumped `libsodium-wrappers` from ^0.8.3 to ^0.8.4
- Bumped `postcss` from ^8.5.9 to ^8.5.14
- Bumped `prettier` from ^3.8.2 to ^3.8.3
- Bumped `web-manager` from ^4.1.40 to ^4.1.41
- Bumped `webpack` from ^5.106.1 to ^5.106.2

---
## [1.1.9] - 2026-04-23
### Added
- Admin users page: "Sign in as user" dropdown option that calls BEM `POST /backend-manager/user/token` to generate a custom auth token, then shows a modal with the sign-in URL (copy button + open-in-new-tab button)
- Modal opens immediately in a loading state while the token is generated, then swaps to ready/error state
- Auth signin page: handle `authCustomToken` URL param via Firebase `signInWithCustomToken`, redirecting to `authReturnUrl` (validated) or `/dashboard`

### Fixed
- Billing section: cancel subscription button now appears for suspended paid subscriptions (previously hidden). Logic updated to `isPaid && rawStatus !== 'cancelled' && !resolved.cancelling` so it correctly shows for active, trialing, and suspended paid subs, while hiding for free users, already-cancelled subs, and subs with pending cancellation

### Changed
- Admin users table: dropdown trigger button restyled using `btn-outline-adaptive rounded-circle` for a cleaner look

---
## [1.1.8] - 2026-04-22
### Changed
- Widen backend sidebar from 282px to 283px so inner content (after `p-3` horizontal padding) clears the 250px minimum required by Google AdSense units
- Apply same 283px width to mobile offcanvas sidebar (`#mobileSidebar`) via `--bs-offcanvas-width` to override Bootstrap's default 400px
- Simplify admin firebase page cell rendering: drop redundant `String()` wrapping around values passed to `escapeHTML()` (already coerces to string internally)

---
## [1.1.7] - 2026-04-10
### Changed
- Update dependencies: web-manager to 4.1.39, webpack to 5.106.1, prettier to 3.8.2, libsodium-wrappers to 0.8.3, prepare-package to 2.1.0
- Add empty `hooks` object to `preparePackage` config in package.json for prepare-package 2.1.0's new hooks feature

---
## [1.1.6] - 2026-04-09
### Changed
- Add `hover-flex` prebuilt animation class to pricing page billing cycle toggle (Monthly/Annually) for subtle scale-up on hover
- Update README and TODO docs to use `npx mgr` instead of `npx uj`
- Fix `[Billing] Cancel complete` log to read product ID from current account instead of undefined variable

---
## [1.1.5] - 2026-04-09
### Changed
- Move pricing and feature limit values from layout frontmatter to default `_config.yml` under `web_manager.payment.products`, making the pricing page fully config-driven
- Add default `payment.products` array with 4 example plans (basic, plus, pro, max) including limits, prices, and trial config
- Handle boolean `true` config limits in feature value display (renders feature name only, check icon in comparison table)

---
## [1.1.4] - 2026-04-09
### Changed
- Update web-manager from v4.1.37 to v4.1.38

---
## [1.1.3] - 2026-04-08
### Security
- Escape all remaining unescaped innerHTML values (formatDate, formatDateTime, formatIncidentStatus, formatTimeAgo, statusLabels, dataStatusMap, numeric values) for defense-in-depth
- Add `https://` scheme validation to `window.open()` and `href` attributes for push notification URLs in calendar-events
- Remove `style` from DOMPurify `ALLOWED_ATTR` in campaign email preview to prevent CSS-based data exfiltration

---
## [1.1.2] - 2026-04-08
### Fixed
- Fix AdSense minimum width error in dashboard sidebar by increasing sidebar width from 280px to 282px (content area now meets 250px minimum)

### Changed
- Update dependencies: fast-xml-parser, postcss, webpack, wonderful-fetch, prepare-package

---
## [1.1.1] - 2026-04-06
### Security
- Fix open redirect via `authReturnUrl` URL parameter in core/auth.js — now validated with `isValidRedirectUrl()`
- Fix cross-origin redirect via unvalidated postMessage in vert.js — added origin allowlist
- Replace `new Function()` code execution in redirect.js with safe named modifier lookup
- Sanitize markdown-it output with DOMPurify in campaign-preview.js (newsletter-safe tag allowlist)
- Validate OAuth redirect URL scheme in connections.js
- Escape `classes` parameter in prerendered-icons.js to prevent attribute breakout
- Defense-in-depth: escape `formatDate()` outputs in security.js, team.js, referrals.js
- Defense-in-depth: escape cancel/refund reason strings in billing.js, refund.js
- Defense-in-depth: escape `submittingText` in form-manager.js spinner
- Document redirect validation, postMessage origin checks, eval prohibition, and DOMPurify rules in CLAUDE.md

### Added
- `dompurify` dependency for HTML sanitization

## [1.1.0] - 2026-04-06
### Added
- `payment-config.js` shared library for reading payment data from build-time config
- Pricing layout resolves prices and feature limits from `_config.yml` when not set in frontmatter
- `oauth2` config injected into client-side Configuration object via `foot.html`
- Pricing page shows "Switch to This Plan" on other paid plans when user has active subscription

### Changed
- Move `payment` under `web_manager` in default `_config.yml` so it serializes into client-side config
- Checkout page uses `payment-config.js` instead of fetching `/backend-manager/brand`
- Account billing section uses config for products/limits/currency instead of brand API
- Account connections section reads `oauth2` from config instead of brand API
- Admin dashboard uses config for product list in MRR calculations
- Remove `/backend-manager/brand` fetch from account page entirely
- "Everything in [plan]" now uses dynamic previous plan name instead of hardcoded index

### Fixed
- Liquid 4.x compatibility: use loop-based hash lookup instead of bracket notation for config limits

## [1.0.22] - 2026-04-05
### Changed
- Bump web-manager from ^4.1.36 to ^4.1.37
- Bump dotenv from ^17.4.0 to ^17.4.1
- Bump html-validate from ^10.11.2 to ^10.11.3

## [1.0.21] - 2026-04-03
### Fixed
- Disable cache breaker on Slapform contact form fetch to prevent appending cache-busting query params to POST request

## [1.0.20] - 2026-04-03
### Fixed
- Fix contact form sending `user: map[]` to Slapform by replacing nested `user` object with flat `uid` string field
- Autofill visible email input from auth state via `data-wm-bind="@value auth.user.email"` for logged-in users
- Remove redundant hidden `auth.user.email` field

## [1.0.19] - 2026-04-02
### Security
- Comprehensive XSS hardening: escape all dynamic data in innerHTML with `webManager.utilities().escapeHTML()`
- Remove all local `escapeHtml` implementations — single source of truth via web-manager
- Rebuild `showToast()` and `showNotification()` to use `textContent` instead of `innerHTML`
- Add `javascript:` protocol blocking in web-manager `@attr` binding directive
- Add URL scheme validation for vert.js postMessage handler
- Fix double-escaping in `showSuccess()`/`showError()`/`showNotification()` callers
- Document zero-trust XSS policy in CLAUDE.md and skills

### Changed
- Refactor webManager from passed parameter to direct singleton import across all modules
- Remove `init(wm)` pattern and Manager parameter passing throughout page modules
- Calendar core/events/renderer use direct imports instead of constructor injection
- Fix file structure and spacing across all JS files (consistent Libraries/Module pattern)
- Fix alternatives layout markdown code block rendering issue

---
## [1.0.18] - 2026-03-30
### Changed
- Removed redundant "Additional gems" comment from Gemfile template output in defaults.js

---
## [1.0.17] - 2026-03-30
### Added
- Configurable gems support via `gems` array in `config/ultimate-jekyll-manager.json`
- Function-based template data in defaults.js for runtime-computed values

---
## [1.0.16] - 2026-03-30
### Changed
- Removed @dev-only wrappers from page module loading console.log statements in src/index.js

---
## [1.0.15] - 2026-03-30
### Changed
- Bump web-manager from 4.1.32 to 4.1.33 (includes @sentry/* 10.46.0, chatsy 2.0.13)

---
## [1.0.13] - 2026-03-27
### Added
- MRR stat card on admin dashboard calculated from brand config prices × subscriber counts
- `setStatSubValue` helper in admin-helpers.js for displaying sub-metrics on stat cards
- Green "+N in 30d" sub-values under Total Users and Push Subscribers stat cards
- New "Active users (30d)" stat card on admin users page

### Changed
- Dashboard charts now use `getCountFromServer` queries per product × frequency instead of fetching all user docs
- Product list and billing frequencies derived dynamically from `/backend-manager/brand` API
- Consolidated "New users (30d)" from standalone card into sub-value under Total Users

### Fixed
- Pacman-shaped spinners in stat cards caused by `spinner-border-sm` inheriting `<h3>` font size (added `fs-6`)

### Removed
- `showUnauthenticated()` flows from all admin pages — pages now return early if no user

## [1.0.11] - 2026-03-24
### Added
- Firestore version + transport test page at `/test/libraries/firestore` for diagnosing SDK connectivity across browsers

## [1.0.10] - 2026-03-24
### Fixed
- `getUJMConfig()` now throws descriptive errors when config file is missing, empty, or malformed instead of crashing silently
- Admin dashboard subscription queries now filter by `subscription.status == 'active'` instead of expiry timestamp

### Changed
- Webpack watch path for web-manager changed from `src/` to `dist/`

## [1.0.9] - 2026-03-20
### Changed
- `authorizedFetch` no longer throws when no user is logged in; logs a warning and proceeds without the Authorization header

## [1.0.7] - 2026-03-20
### Changed
- Upgrade `web-manager` from ^4.1.29 to ^4.1.30

## [1.0.3] - 2026-03-16
### Added
- Ensure consuming projects have `"private": true` in package.json during setup to prevent accidental npm publishes

## [1.0.1] - 2026-03-15
### Changed
- Upgrade `node-powertools` from ^2.3.2 to ^3.0.0
- Upgrade `web-manager` from ^4.1.26 to ^4.1.28
- Upgrade `wonderful-fetch` from ^1.3.4 to ^2.0.4
- Upgrade `prepare-package` from ^1.2.6 to ^2.0.7
- Add `preparePackage.type: "copy"` configuration

## [Unreleased]
### Changed
- Migrate "app" terminology to "brand" across frontend and service worker: renamed `appData`/`fetchAppData` to `brandData`/`fetchBrandData`, `appConfig`/`fetchAppConfig` to `brandConfig`/`fetchBrandConfig`, API endpoint from `/backend-manager/app` to `/backend-manager/brand`, and `this.app` to `this.brand` in service worker

### Added
- Abandoned cart tracking on checkout page: creates a Firestore document in `payments-carts/{uid}` when authenticated users begin checkout, with a 15-minute first reminder delay
- Backend sidebar auto-expands collapsible dropdown sections containing the currently active page link (desktop and mobile)
- Email preferences page (`/portal/account/email-preferences`) for unsubscribe/resubscribe from marketing emails
- Email masking on preferences page to prevent forwarded-email abuse (e.g., `ia***b@gm***.com`)
- HMAC signature verification for unsubscribe links to prevent forged requests
- Checkout page supports daily, weekly, monthly, and annually billing frequencies with selective UI visibility via wm-bindings
- Default billing frequency auto-selects the longest available term (annually > monthly > weekly > daily), with URL param override
- Auth state settles before any authorized fetches fire on checkout, preventing race conditions
- Quick boot mode (`UJ_QUICK=true`) for faster dev server startup (~5s vs ~20s) by skipping clean, slow setup operations, and deferring webpack/sass compilation until after Jekyll's first build
- Dev-only warning in FormManager for form fields missing `name` attributes (skipped by validation and `getData()`)
- FAQPage JSON-LD schema with 3-level fallback chain (`schema.faq_page.items` → `faqs.items` → `alternative.faqs.items`)
- FAQPage schema enabled on blueprint pages with FAQ sections (pricing, contact, download, extension, alternatives)
- OG image dimension meta tags (`og:image:width`, `og:image:height`) with 1200×630 defaults
- Article published/modified time meta tags for blog posts
- Admin marketing calendar page (`/admin/calendar`) with custom-built interactive calendar for scheduling newsletters and notifications
- Calendar supports 4 view modes (month, week, day, year) with event CRUD, drag-and-drop, overlapping event layout, and `window.calendarAPI`
- Real-time red "now" line indicator in day/week views, updates every 60 seconds
- Viewport-locked admin layout variant (`themes/classy/admin/core/minimal-viewport-locked`) for full-height admin pages
- Feedback page (`/feedback`) with emoji rating selection, written feedback fields, review prompt modal, and analytics tracking
- FormManager auto-populates form fields from URL query parameters (skips utm_*, itm_*, cb, fbclid, gclid)
- Review prompt modal after positive feedback submission with copy-paste textarea and external review site link

### Changed
- Twitter card default from `summary` to configurable `summary_large_image`
- Rename `site.tracking` config to `site.analytics` with simplified keys (`google-analytics` → `google`, `meta-pixel` → `meta`, `tiktok-pixel` → `tiktok`)
- Update `webManager.config.tracking['meta-pixel']` to `webManager.config.analytics?.meta` in auth.js
- Replace hardcoded discount codes with server-side validation via `payments/discount` API endpoint
- Simplify payment intent payload: remove `auth`, `cancelUrl`, and `verification.status` fields; send `discountCode` from validated state
- Form submit falls back to first visible payment button when Enter is pressed instead of throwing
- Clear FormManager dirty state before redirect to avoid "leave site" prompt
- Use proper adjective forms in subscription terms text (e.g., "annual" instead of "annually")
- Add discount disclaimer to subscription terms when a discount code is applied
- Align billing section to backend SSOT: consume unified subscription structure directly (3 statuses, `product.id` as object, `payment.price` in dollars, `cancellation.pending`, `trial.claimed` + `trial.expires`)
- Use WM bindings (`data-wm-bind`) for billing plan heading, action button visibility, and cancel trigger instead of manual JS DOM manipulation
- Standardize cancel, delete, and data-request forms to use FormManager built-in `required` validation instead of manual disabled toggle and checkbox throws
- Test subscriptions now deep-merge into real user data instead of full replacement, preserving actual product/payment info
- Add `onsubmit="return false"` to all JS-managed forms as a safety net against native submission before FormManager loads
- Checkout payment method buttons start hidden and are revealed via `data-wm-bind` when payment methods load
- Remove development-only guard from click prevention logging in body.html

### Removed
- Remove hardcoded `DISCOUNT_CODES` map and `autoApplyWelcomeCoupon` (replaced by server-side validation)
- Remove `generateCheckoutId` and `state.checkoutId` from checkout session
- Unexport `resolvePrice` helper (internal-only usage)

### Fixed
- Fix broken `</>` tag in checkout HTML causing page rendering to break
- Fix checkout price display for APIs returning plain numbers instead of `{amount: N}` objects
- Fix quantity badge styling (proper circle instead of pill shape)
- Fix form checkboxes missing `name` attributes causing FormManager to silently skip validation (cancel, delete forms)
- Fix admin forms (notifications, users) and blog/status forms missing `novalidate`, `onsubmit`, `name` attributes, and `.button-text` spans
- Fix profile premium badge using removed `trialing` status and `access` field
- Add dev-only artificial pre-delay support to checkout page for testing form protection timing
- Fix `btn-check:checked` outline button styling in classy theme — transparent `!important` rule was overriding Bootstrap's checked background due to higher CSS specificity

---
## [1.0.0] - 2024-06-19
### Added
- Initial release of the project 🚀
