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
## [Unreleased]
### Added
- Email preferences page (`/portal/account/email-preferences`) for unsubscribe/resubscribe from marketing emails
- Email masking on preferences page to prevent forwarded-email abuse (e.g., `ia***b@gm***.com`)
- HMAC signature verification for unsubscribe links to prevent forged requests
- Checkout page supports daily, weekly, monthly, and annually billing frequencies with selective UI visibility via wm-bindings
- Default billing frequency auto-selects the longest available term (annually > monthly > weekly > daily), with URL param override
- Auth state settles before any authorized fetches fire on checkout, preventing race conditions
- Quick boot mode (`UJ_QUICK=true`) for faster dev server startup (~5s vs ~20s) by skipping clean, slow setup operations, and deferring webpack/sass compilation until after Jekyll's first build
- Dev-only warning in FormManager for form fields missing `name` attributes (skipped by validation and `getData()`)

### Changed
- Align billing section to backend SSOT: consume unified subscription structure directly (3 statuses, `product.id` as object, `payment.price` in dollars, `cancellation.pending`, `trial.claimed` + `trial.expires`)
- Use WM bindings (`data-wm-bind`) for billing plan heading, action button visibility, and cancel trigger instead of manual JS DOM manipulation
- Standardize cancel, delete, and data-request forms to use FormManager built-in `required` validation instead of manual disabled toggle and checkbox throws
- Test subscriptions now deep-merge into real user data instead of full replacement, preserving actual product/payment info
- Add `onsubmit="return false"` to all JS-managed forms as a safety net against native submission before FormManager loads
- Checkout payment method buttons start hidden and are revealed via `data-wm-bind` when payment methods load
- Remove development-only guard from click prevention logging in body.html

### Fixed
- Fix broken `</>` tag in checkout HTML causing page rendering to break
- Fix checkout price display for APIs returning plain numbers instead of `{amount: N}` objects
- Fix quantity badge styling (proper circle instead of pill shape)
- Fix form checkboxes missing `name` attributes causing FormManager to silently skip validation (cancel, delete forms)
- Fix admin forms (notifications, users) and blog/status forms missing `novalidate`, `onsubmit`, `name` attributes, and `.button-text` spans
- Fix profile premium badge using removed `trialing` status and `access` field
- Add dev-only artificial pre-delay support to checkout page for testing form protection timing

---
## [1.0.0] - 2024-06-19
### Added
- Initial release of the project 🚀
