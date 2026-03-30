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
