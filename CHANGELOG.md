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
## [1.6.3] - 2026-06-03

### Changed

- **Workflow template dynamically generates secrets from `.env`.** `defaults.js` reads the default `_.env`, extracts all key names, and produces a `{ github.secrets }` template variable — no more hardcoding individual secrets in `build.yml`.
- **`publishSecrets()` replaces `publishGitHubToken()` in setup.** Now reads the consumer's `.env` and publishes ALL non-empty keys as GitHub Actions repo secrets (not just `GH_TOKEN`).

### Added

- **Country flag SVGs:** id, in, ph, pk, ru, vn (modern-square style).
- **Auto-create `pages/` dir for custom themes** in webpack.js — prevents `Module not found: __theme__/pages` error when a consumer theme lacks a `pages/` directory.

### Removed

- **`BACKEND_MANAGER_KEY`** removed from workflow template (replaced by dynamic `.env` secrets).

---
## [1.6.2] - 2026-06-02

### Fixed

- **`npx mgr setup` now merges new `.env` keys into existing consumer projects.** Previously, `ensureCoreFiles()` returned early when `src/_config.yml` existed, skipping the `gulp defaults` task that handles `.env` merging. New framework keys (like `BACKEND_MANAGER_OPENAI_API_KEY`) were never added to consumers that had already run setup once.

---
## [1.6.1] - 2026-06-02

### Changed

- **Translation system overhauled: JSON array format, gpt-5.4-nano model, .env API key.** Replaced tagged text `[0]...[/0]` format with JSON arrays (eliminates tag corruption). Upgraded from `gpt-4.1-mini` to `gpt-5.4-nano` (3.5x cheaper). API key now read from `BACKEND_MANAGER_OPENAI_API_KEY` in `.env` instead of remote `fetchOpenAIKey()`. Uses GPT-5+ Responses API (`developer` role, `reasoning: { effort: 'low' }`).
- **Translation concurrency: node-powertools `queue()` replaces batched delays.** Removed 25-page batches with 10s sleeps; now uses `queue({ concurrency: 5 })` for steady throughput.
- **Translation retries simplified.** Removed recursive subdivision system. On JSON array length mismatch, retries up to `MAX_RETRIES` (2) with file/language context in logs.

### Added

- **`data-uj-no-translate` HTML attribute** — marks DOM elements (and children) to skip during translation. Applied to country and phone code `<select>` dropdowns on the account page, reducing account.html from ~1241 to ~454 translatable strings.
- **`BACKEND_MANAGER_OPENAI_API_KEY`** added to default `.env` template.
- **Prompt cache HIT/MISS logging** with entry counts per language.
- **`IGNORE_EXCEPTIONS`** — allows specific pages through folder-level exclusions (e.g. `test/translation.html` survives the `test/` folder exclusion).

### Removed

- **`fetchOpenAIKey()`** — remote API key fetch from `api.itwcreativeworks.com` removed.
- **Subdivision retry system** (`subdivideAndTranslate`) — replaced by simple length-mismatch retry.
- **`test/`, `team/`, `updates/` folders** excluded from translation by default.

---
## [1.6.0] - 2026-06-02

### Changed

- **`getEnvironment()` is now the single source of truth for environment detection** (and `testing` is a first-class environment). [src/utils/mode-helpers.js](src/utils/mode-helpers.js) — `getEnvironment()` is the ONLY function that reads the raw signals (`UJ_TEST_MODE` / `window.Configuration.uj.environment` / `UJ_BUILD_MODE` / `UJ_IS_SERVER` / `NODE_ENV`) and resolves them to exactly one of `'development' | 'testing' | 'production'` (mutually exclusive; **testing wins**). `isDevelopment()` / `isProduction()` / `isTesting()` now **derive** from it, so they can never disagree and exactly one is always true. `isProduction()` is a real positive check, not `!isDevelopment()`. [src/build.js](src/build.js) drops its own `getEnvironment()` (now mixed in via `attachTo`). Doc renamed `cross-context-helpers.md` → [docs/environment-detection.md](docs/environment-detection.md).
- **Redirect delay now keys off non-production (dev OR testing), not dev-only.** [src/assets/js/modules/redirect.js](src/assets/js/modules/redirect.js) delays the redirect whenever `environment !== 'production'` so it's observable in tests too.
- **Footer language dropdown gates the extra-languages list on `translation.enabled`** (+ vertical-alignment fix). [footer.html](src/defaults/dist/_includes/themes/classy/frontend/sections/footer.html)

### Added

- **`test/_init.js` pre-test lifecycle hook (setup-only).** [src/test/runner.js](src/test/runner.js) loads an optional `test/_init.js` from BOTH the framework and consumer test roots and runs its `setup()` once before any suite (the `_`-prefix keeps it out of discovery). Mirrors BEM/EM/BXM. Default scaffold at [src/defaults/test/_init.js](src/defaults/test/_init.js). [docs/test-framework.md](docs/test-framework.md) adds a "NEVER mock — test against the real harness" section + `_init.js` reference, and tests now assert the env invariant across every signal scenario.
- **`translation.exclude` config** — folder or page paths excluded from AI translation (added to both the files and folders match sets). Default [_config.yml](src/defaults/src/_config.yml) excludes `blog`. [src/gulp/tasks/translation.js](src/gulp/tasks/translation.js)
- **`setup` prunes legacy first-name-only default team members** (e.g. `team/alex`) and their image dirs via `removeLegacyTeamMembers()`. [src/commands/setup.js](src/commands/setup.js)
- **`npx mgr install live`** accepted as an alias for `prod`/`production`. [src/commands/install.js](src/commands/install.js); docs use `install dev` / `install live` consistently.

### Fixed

- **Download buttons use a `[data-download]` hook** instead of the brittle `.btn-primary:not([type="submit"])` selector. [download.html](src/defaults/dist/_layouts/themes/classy/frontend/pages/download.html) + [download/index.js](src/assets/js/pages/download/index.js)
- **Feedback review modal:** $100 gift-card incentive + an explicit "you must actually post your review" warning, and copy normalized "Write a review" → "Post your review". [feedback.html](src/defaults/dist/_layouts/themes/classy/frontend/pages/feedback.html) + [feedback/index.js](src/assets/js/pages/feedback/index.js)
- Removed a leftover `package copy.json` from the repo root.

---
## [1.5.0] - 2026-06-02

### Added

- **Neobrutalism theme** — a complete second shipped theme (alongside `classy`), not a recolor: hard ink borders, offset "press" shadows, chunky display type, flat color-blocks, square controls. Custom homepage + pricing layouts. It restyles **standard Bootstrap classes** (`.btn`, `.card`, `.text-bg-*`) and a **universal semantic layout vocabulary** (`.section-hero`, `.showcase-row`, `.stat-block`, `.pricing-plan`, `.cta-panel`, …) — **no theme-prefixed classes** — so the same markup is swappable across themes (change `theme.id`, done). [src/assets/themes/neobrutalism/](src/assets/themes/neobrutalism/)
- **Theme system: three-layer page-asset cascade (Global → Theme → Consumer) for BOTH CSS and JS.**
  - Theme page CSS: `themes/<id>/pages/<path>/index.scss` compiles to a theme-suffixed bundle (`index.<themeId>.bundle.css`) via [src/gulp/tasks/sass.js](src/gulp/tasks/sass.js), linked by [head.html](src/defaults/dist/_includes/core/head.html) with `{% iffile %}`. Missing = nothing loads (component styles handle it), no fallback needed.
  - Theme page JS: `__theme__/pages/<path>/index.js` loaded as the `#theme` layer in [src/index.js](src/index.js), executed `main → theme → project` (a `webpackInclude: /\.js$/` guard stops `.scss` from being pulled into the JS import context).
  - Per-page HTML layout overrides under `_layouts/themes/<id>/` reuse classy's `page.resolved.*` frontmatter data contract and fall back to classy when a layout is absent.
- **Theme-authoring template** at [src/assets/themes/_template/](src/assets/themes/_template/) + a full **[docs/themes.md](docs/themes.md)** reference for building a theme inside UJM or in a consumer project (selection/resolution, classy fallback, page CSS/JS layers, the no-prefix vocabulary, adaptive-button + interactive-accent gotchas).
- **Single interactive-accent token** (`--nb-accent-interactive` = `var(--bs-primary)`) drives all hover/active states (blue), distinct from the yellow signature accent reserved for static blocks. Adaptive buttons (`btn-adaptive`/`-inverse`) get explicit theme overrides so they render solid and press like every other button.
- **Asset-layer test harness** — `UJ_TEST_LAYERS` flag + [manage-test-layers.js](src/gulp/tasks/utils/manage-test-layers.js) generate real consumer-side test files; the `/test/libraries/layers` page renders the Global/Theme/Consumer cascade as red/green dots to prove all three layers load in order. `npm run start:test-layers` enables it.

---
## [1.4.3] - 2026-05-28

### Fixed

- **Imagemin: uppercase-extension images (e.g. `IMG_3119.JPG`) now build end to end.** v1.4.2 made the glob case-insensitive so the file was discovered, but `gulp-responsive-modern`'s `lib/format.js` does a case-sensitive `switch` on `path.extname()` and returns the string `'unsupported'` for `.JPG`, which then crashes `sharp.toFormat()`. [src/gulp/tasks/imagemin.js](src/gulp/tasks/imagemin.js) now pipes each file through an in-stream `Transform` that lowercases the extension on the Vinyl path before the responsive plugin sees it (the on-disk source is left untouched).
- **Log files no longer truncate before the crash that caused them.** [src/utils/attach-log-file.js](src/utils/attach-log-file.js) switched from `fs.createWriteStream` (async-buffered) to synchronous `fs.writeSync` against an open fd. The buffered stream dropped its tail when a gulp task threw and the process exited — so the lines describing the failure never reached `logs/build.log`. Synchronous writes guarantee the full error + stack survive an immediate exit.

### Changed

- **Auth: signup-consent gating now keys off the user doc's `flags.signupProcessed` instead of a time window.** [src/assets/js/core/auth.js](src/assets/js/core/auth.js) drops the `SIGNUP_MAX_AGE` (5-minute) heuristic and the client-only `localStorage` flag. `sendUserSignupMetadata` fires whenever the doc shows signup unprocessed (the server is idempotent), and the consent guard only signs a user out once signup has actually been processed — removing the risk of locking users out on a transient metadata-send failure.
- **Footer language dropdown always renders.** No longer gated on `site.translation.enabled`; falls back to `site.translation.default` (or `"en"`) when no extra languages are configured. [src/defaults/dist/_includes/themes/classy/frontend/sections/footer.html](src/defaults/dist/_includes/themes/classy/frontend/sections/footer.html)
- **Sentence-case copy normalization** across default pages (pricing, alternatives, admin/test pages, sitemap section labels): "API access", "Flash sale", "Root pages", "…and more:" etc.
- **Updates feed:** the `v0.0.1` sample entry is marked `draft: true` so it's hidden from the listing and sitemap (dev-only).

---
## [1.4.2] - 2026-05-27

### Fixed

- **Imagemin: uppercase image extensions (e.g. `IMG_3119.JPG`) no longer break the responsive build.** `gulp-responsive-modern` uses micromatch internally, which is strictly case-sensitive regardless of filesystem. On macOS APFS, gulp's `src()` would discover the file and count it toward expected outputs, but the lowercase-only `**/*.{jpg,jpeg,png}` pattern wouldn't match — producing zero outputs and erroring with "Available images do not match the following config". [src/gulp/tasks/imagemin.js](src/gulp/tasks/imagemin.js) now expands `ALL_IMAGE_GLOB` and `RESPONSIVE_GLOB` to include uppercase variants so consumers don't need to rename camera/phone files.

---
## [1.4.1] - 2026-05-27

### Changed

- **Bumped `puppeteer` `^24.43.1` → `^25.1.0`.** Puppeteer 25 is ESM-only and requires Node 22+; UJM's existing `require('puppeteer')` calls in [src/test/runners/boot.js](src/test/runners/boot.js) and [src/test/runners/chromium.js](src/test/runners/chromium.js) keep working via Node 22's native ESM-require interop.
- **Bumped `html-validate` `^10.17.0` → `^11.4.0`.** Used by [src/gulp/tasks/audit.js](src/gulp/tasks/audit.js); audit suite still passes.

---
## [1.4.0] - 2026-05-27

### Added

- **`UJ_IMAGEMIN_REWRITE_SOURCES=true` flag** (opt-in, off by default) — when set, the `imagemin` gulp task scans every image scheduled for processing and rewrites in place any whose longest dimension exceeds 4096px. Uses `sharp` with `fit: 'inside'` (aspect-preserving), JPEG quality 80 / mozjpeg / progressive, PNG quality 80. Cache hashes for affected files are updated so the new content becomes the new cache key. Intended as a one-off cleanup for repos with pre-existing oversized source images that silently stall `gulp-responsive-modern`/`sharp`. See [docs/images.md](docs/images.md#cleanup-for-existing-oversized-sources-uj_imagemin_rewrite_sources).
- **Log-file tee** (`src/utils/attach-log-file.js`): every line of stdout/stderr produced by the gulp pipeline is duplicated to `logs/dev.log` (during `npm start`) or `logs/build.log` (during `npm run build`) in the consumer project root. ANSI color codes are stripped from the file output; terminal output is unchanged. Files truncate fresh on each run. Skipped when `UJ_IS_SERVER=true` (CI/cloud) — no `logs/` directory is created in workspace contexts. Attached at the top of `src/gulp/main.js`. See [docs/local-development.md](docs/local-development.md#log-files).
- **Pricing page: 7-day money-back guarantee badge** under the billing toggle and per-card on each paid plan; free plan shows "Upgrade any time" with a rocket icon.
- **Pricing page: trial-aware CTA copy** — buttons now read "Get free trial" only when the plan's `trial.days > 0`, otherwise "Get started". Free plan stays "Get started". Avoids misleading users into thinking they need a trial for a free plan or that every paid plan offers one.
- **Auth: field-level error rendering.** New `isPasswordError()` and `passwordErrorMessage()` helpers in `src/assets/js/libs/auth.js` route Firebase password errors (`auth/weak-password`, `auth/missing-password`, `auth/wrong-password`, `auth/password-does-not-meet-requirements`) onto the password input via `FormManager.throwFieldErrors()` instead of the form-level banner. Signin: `auth/invalid-credential` | `auth/wrong-password` | `auth/user-not-found` highlight both email + password with "Incorrect email or password" (Firebase intentionally collapses these to prevent email enumeration). `auth/invalid-email` highlights the email field. Signup: when the email already exists and auto-signin fails, the message lands inline on the email field rather than throwing a generic banner error.
- **Dev-only consent-guard warning** in `src/assets/js/core/auth.js` `sendUserSignupMetadata` catch block: shows a `webManager.utilities().showNotification()` with the exact wall-clock time the consent guard will sign the user out (and remaining mm:ss) when the metadata POST fails. Wrapped in `/* @dev-only:start */` blocks so production builds strip it.

### Changed

- **Sentence-case copy normalization** across ~60 layouts, pages, and section configs. Examples: "Sign Out" → "Sign out", "API Keys" → "API keys", "Save Changes" → "Save changes", "Contact Us" → "Contact us", "Main Menu" → "Main menu", "All Items" → "All items", "Admin Panel" → "Admin panel", "Sign Up" → "Sign up". Touches frontend pages (account, auth, contact, download, extension, index, payment, pricing, team, etc.), blueprint admin/legal/portal pages, test pages, and nav/footer/sidebar/account JSON section configs.
- **FormManager: `.has-validation` on input-group when a field is marked invalid.** Bootstrap requires this class on the wrapping `.input-group` so the trailing element (e.g. a password-visibility toggle) keeps its border-radius once a sibling `.invalid-feedback` is appended.
- **Classy theme forms SCSS:** restored rounded right corners on `.input-group.has-validation > *:nth-last-child(2)` so the visually-last interactive element keeps its `$classy-radius-lg`. Also added `.form-control.is-invalid:focus` override to keep the danger (red) focus ring instead of the brand-blue ring the classy theme was applying.

### Fixed

- **`imagemin` gulp task race condition (build mode):** the task was declared `async function imagemin(complete)` and returned a stream directly. Async functions wrap their return value in a Promise, so gulp resolved the task on the (already-resolved) Promise instead of waiting for the stream's `'finish'` event. Downstream tasks (jekyll, audit, minifyHtml) then started while imagemin was still writing to `dist/`, and jekyll would snapshot `_site/` before late images landed. Builds reported success while silently shipping a partial site. Fixed by explicitly `await`ing stream completion via `new Promise((resolve, reject) => { ... .on('finish', resolve).on('error', reject) })` before moving to the cache-push step, then `return complete()`. The wait only ever runs in build mode (dev mode short-circuits earlier in the task), so `npm start` startup is unaffected.
- **Oversized source images silently failing to land in `_site/`.** Source images with very large dimensions (10000px+ longest side) decode into hundreds of MB per worker in `sharp`, which can stall the `gulp-responsive-modern` stream so quietly that gulp reports the task complete. The build appears successful but some images never reach `_site/`. Documented the constraint and the new `UJ_IMAGEMIN_REWRITE_SOURCES` cleanup flag in [docs/images.md](docs/images.md). Recommended fix is to cap images at the upload step; the rewrite flag is a fallback for cleaning up existing repos.

---
## [1.3.12] - 2026-05-25

### Fixed

- **Fresh-consumer `npx mgr setup` now works on the first run.** Two ordering bugs prevented setup from succeeding on a brand-new consumer project: (1) `ensureBundle()` ran `bundle install` before `ensureCoreFiles()` scaffolded the `Gemfile`, failing with "Could not locate Gemfile" — reordered so core files are scaffolded first. (2) The gulpfile eagerly `require()`s every task module at load time, and `sass.js`/`distribute.js`/`imagemin.js` all call `Manager.getUJMConfig()` at module top-level, so a fresh consumer (with no `config/ultimate-jekyll-manager.json`) couldn't even invoke `gulp defaults` — extended `ensureCoreFiles()` to seed both `src/_config.yml` and `config/ultimate-jekyll-manager.json` from `dist/defaults/` before invoking gulp. Both steps remain idempotent (existing-file guard + `{ overwrite: false }` copy).

---
## [1.3.11] - 2026-05-24

### Changed

- **Account page UI polish.** Three small consistency fixes on `/account`: (1) Notifications "Save preferences" button now has the `floppy-disk` icon to match the profile section's "Save Changes" button. (2) Generate signin link modal no longer shows a redundant Cancel button in its footer — the X in the modal header already dismisses it. (3) Connections "Manage connections" card no longer renders a divider between the section title and the first item (dropped `list-group list-group-flush` from `#connections-list`); the per-item `border-top` already handles inter-item separation, matching the Sign-in methods card's pattern.

---
## [1.3.10] - 2026-05-24

### Added

- **Generate signin link** — advanced-user feature on `/account#security` that creates a temporary `/signin?authCustomToken=<token>` URL via `POST /backend-manager/user/token`. Centered text-link trigger sits under the Active sessions card (same Bootstrap utility classes as Cancel subscription: `btn btn-link btn-sm text-muted text-decoration-underline opacity-50`). Opens a danger-bordered modal with a typed-phrase gate (`I will not share this link`) that enables the red Generate button. On success, the warning view swaps in-place for the link inside a readonly monospaced input + Copy button, with a prominent 1-hour expiry warning. Token never persists outside the input — `show.bs.modal` resets state every open. Backend route already existed (`functions/routes/user/token/post.js`) and the existing `handleCustomTokenSignin` flow in `src/assets/js/libs/auth.js` consumes the resulting URL.

### Changed

- **Account-page marketing toggle now requires an explicit "Save preferences" button.** v1.3.9 made the toggle auto-submit on change. Cleaner UX: user flips the toggle, sees the new state visually, then clicks Save when they actually want to commit. Markup adds a `<button type="submit" class="btn btn-primary">Save preferences</button>` to the `#marketing-emails-form` (classy account template). JS drops the `addEventListener('change', () => formManager.submit())` line. On failure, the toggle stays where the user left it (no auto-revert) — they see the error message via FormManager and can hit Save again.

### Removed

- **`.cancel-trigger-link` SCSS class.** Replaced with Bootstrap utilities on both the existing Cancel subscription button and the new Generate signin link button (`text-muted opacity-50` instead of the custom `opacity: 0.7` + hover transition + `0.8125rem` font size). Avoids inventing project-specific classes when Bootstrap utilities cover the same styling.

---
## [1.3.9] - 2026-05-24

### Fixed

- **Account-page marketing toggle showed "Failed to update email preferences" even on successful unsubscribe.** Root cause: `pages/account/sections/notifications.js` was checking `response.data?.success !== true`, but `authorizedFetch` returns the JSON body directly (no `data` wrapper), and BEM's `assistant.respond({ success: true })` writes the object at the response root via `res.json(response)`. So `response.success === true` and `response.data?.success === undefined` — the check fired even though the backend had successfully written `consent.marketing.status = 'revoked'` AND removed the contact from SendGrid + Beehiiv. Frontend UX showed a danger toast and reverted the toggle, but server state was already correct, putting the UI out of sync with reality. Fix: check `response.success` at the root.

### Changed

- **`pages/account/sections/notifications.js` refactored to use FormManager**, matching the project rule that all user-driven API forms use form-manager for in-flight/success/error UX. The toggle is now wrapped in `<form id="marketing-emails-form">` (classy account template, `src/defaults/dist/_layouts/themes/classy/frontend/pages/account/index.html`), and the change event triggers `formManager.submit()`. Success notification uses `formManager.showSuccess()`; failure throws so FormManager surfaces the error toast and the JS reverts the toggle to its last-known-good state. Replaces the ad-hoc `addEventListener('change')` + raw `authorizedFetch` + manual `webManager.utilities().showNotification()` pattern.

---
## [1.3.8] - 2026-05-24

### Fixed

- **Reverse-signup now keeps the user on `/signin` so they actually see the inline error.** v1.3.7 fixed `isNewUser` detection, but a follow-on race appeared: when Firebase's `getRedirectResult()` returns a fresh-signup user, the auth-state-change listener in `core/auth.js` fires `state.user = <about-to-be-deleted>` BEFORE `reverseAccidentalSignup`'s `await newUser.delete() → signOut()` chain completes. The listener's `policy === 'unauthenticated'` branch then redirects to `/account` (or `authReturnUrl`), and by the time the inline `showError()` call fires, the user is already off the page. Fixed with a `window.__UJM_REVERSING_SIGNUP` flag set synchronously before the delete + cleared after signOut's followup state-change. The listener checks the flag at the top and short-circuits the entire callback — no redirect, no metadata POST, no consent guard, nothing — until the reversal completes and the user lands on `user = null` with the inline error visible on `/signin`.

---
## [1.3.7] - 2026-05-24

### Fixed

- **Reverse-signup detection on `/signin` was completely broken.** The reverse-signup-on-/signin flow in `src/assets/js/libs/auth.js` (lines 289 and 664) was reading `result.additionalUserInfo?.isNewUser` directly off the `UserCredential` returned by `getRedirectResult()` and `signInWithPopup()`. That property does NOT exist on the v9+ modular SDK — verified against `@firebase/auth`'s `auth-public.d.ts`, which declares `UserCredential` as exactly `{ user, providerId, operationType }`. The legacy compat SDK exposed `additionalUserInfo` as a direct property, hence the v9 migration footgun. On the modular SDK you must call the standalone helper `getAdditionalUserInfo(userCredential): AdditionalUserInfo | null` to access `isNewUser`. Result: `isNewUser` was always `undefined` → always falsy → the `if (isNewUser && !isSignupPage)` reverse gate at line 296 never fired in production. New Google accounts on `/signin` got signed in straight to `/account` with no consent on record, despite the reverse-signup code existing in the bundle since multiple versions ago. Confirmed live on Somiibo (Test 4 of `TODO-CONSENT-LIVETEST.md` failed 3× in a row with `operationType: 'signIn'` and no `[Auth] Reversing accidental signup` log line). Now both sites import `getAdditionalUserInfo` and call it on the result. Added two `console.warn` diagnostic logs (one per site) so future regressions surface immediately — can be removed once we're confident the fix sticks.

---
## [1.3.6] - 2026-05-24

### Fixed

- **`auth/error-code:-47` now shows a friendly message instead of the raw FirebaseError.** v1.3.5's diagnostic confirmed: on the OAuth redirect path (`signInWithIdp` → 503), Firebase strips the BEM-side `HttpsError` message and delivers `code: 'auth/error-code:-47'` with `customData: {}` — empty. There's nothing to extract because Firebase ate the message client-side. This contradicts Firebase's own [Identity Platform docs](https://cloud.google.com/identity-platform/docs/blocking-functions) which describe a `BLOCKING_FUNCTION_ERROR_RESPONSE` wrapper that SHOULD carry the original message. The wrapper works on the 400 path (email signup, OAuth popup) — our v1.3.4 extractor handles that fine. The 503 path is broken: tracked at [firebase-js-sdk#8054](https://github.com/firebase/firebase-js-sdk/issues/8054), where a Firebase engineer said "503 seems to be the working as design error codes" then the issue was auto-closed as stale 5 weeks later without a fix or workaround. The `-47` code is 1:1 with "blocking-function rejected this signup," so `extractBlockingFunctionMessage()` now returns a generic-but-helpful message covering all three BEM `beforeCreate` reasons (rate limit, disposable email, custom hook reject): "Account creation is temporarily restricted. This can happen if you've recently created too many accounts, or your email is on our blocked list. Please try again later or contact support." The original `customData.serverResponse` path stays as the primary handler — the `-47` catchall is an additive fallback for when Firebase eats the message.

---
## [1.3.5] - 2026-05-24

### Added

- **Diagnostic logging in `extractBlockingFunctionMessage()` (`src/assets/js/libs/auth.js`).** When BEM's `beforeCreate` rate limit (2 signups/day/IP) fires via Google OAuth redirect, the user just saw "Firebase: Error (auth/error-code:-47)" instead of the helpful "Unable to create account at this time. Please try again later." message. The 1.3.4 extraction handles the standard 400-with-`BLOCKING_FUNCTION_ERROR_RESPONSE` path, but the 503 path (Google's Identity Toolkit returns 503 directly with code -47, no `customData.serverResponse`) flows through to the generic `auth.code` branch. Added a `console.warn` that dumps the full error shape (code, message, customData, serverResponse) so the next failed signup attempt reveals exactly what Firebase delivers — then we can write a matching handler. Diagnostic ships first; fix follows in a subsequent version.

---
## [1.3.4] - 2026-05-22

### Added

- **Surface BEM blocking-function error messages to users.** Firebase Auth blocking functions (`before-create`, `before-signin`) that throw `HttpsError('resource-exhausted', 'Too many signups...')` get wrapped by Firebase as the opaque `auth/internal-error` (sometimes `auth/error-code:-47`). The actual BEM-side message is buried in `error.customData.serverResponse` inside a `BLOCKING_FUNCTION_ERROR_RESPONSE : ((error : (message : "...")))` wrapper. New `extractBlockingFunctionMessage(error)` helper in `src/assets/js/libs/auth.js` unwraps it. Wired into all 4 auth error sites (OAuth popup, OAuth redirect, email signup, email signin) so users now see "Too many signups from your IP, please try again later" instead of "Firebase: Error (auth/error-code:-47)."

---
## [1.3.3] - 2026-05-21

### Changed

- **Reordered account page sections** in `src/defaults/dist/_layouts/themes/classy/frontend/pages/account/index.html`. Sidebar nav and section blocks now run Profile → Security → Subscription → Billing → Referrals → Team → Notifications → API Keys, pushing the less-frequently-used Team and Notifications sections below Referrals. Section content unchanged.

---
## [1.3.2] - 2026-05-22

### Fixed

- **Consent guard was running before `sendUserSignupMetadata`, killing every fresh signup.** `src/assets/js/core/auth.js`: on a brand-new signup the user doc exists with `consent.legal.status: 'revoked'` (the schema default written by BEM's `on-create` event); `sendUserSignupMetadata` is what flips it to `'granted'`. Previously the guard ran first and signed the user out before the metadata POST could fire — orphaned every new account. Reordered to run `sendUserSignupMetadata` first, and the guard now skips accounts younger than `SIGNUP_MAX_AGE` (5min) so a transient network error during the POST doesn't lock a user out forever — they can retry. After the grace window, the guard fires normally.

---
## [1.3.1] - 2026-05-21

### Changed

- **`ENFORCE_CONSENT_GUARD` flipped to `true`** in `src/assets/js/core/auth.js`. The page-load consent guard now silently signs out any authenticated user whose doc has `consent.legal.status !== 'granted'`. Caveat: any pre-consent-system user doc (missing the field, or defaulted to `'revoked'`) will be signed out on page load — run the legacy-user migration first, or live-test against fresh signups.

---
## [1.3.0] - 2026-05-21

### Added

- **Marketing consent capture on the signup form.** Frontend half of `backend-manager` v5.2.0's consent system. `src/defaults/dist/_layouts/themes/classy/frontend/pages/auth/signup.html` replaces the legal-copy line with two real checkboxes (`consent-legal`, `consent-marketing`) wrapped in a `#consent-group` so validation can highlight the pair as a unit. `consent-legal` is required to submit.
- **`captureSignupConsent()` + `validateConsent()` in `src/assets/js/libs/auth.js`.** Pulls checkbox state + label text from the FormManager-collected data and writes it to `webManager.storage()` under key `consent` BEFORE Firebase auth fires — survives the post-signup redirect the same way `attribution` does. `validateConsent()` blocks submit via a phantom `__consent` field name and surfaces feedback via the wrapper outline + an inline error message instead of red-X-ing the single legal checkbox.
- **`reverseAccidentalSignup()` for the Google quirk.** Landing on `/signin` with an unknown Google account auto-creates the Firebase auth user; this reverses that path — deletes the user, signs out, strips `authReturnUrl`, and surfaces an inline form error. Best-effort delete; the page-load consent guard (below, currently OFF) is the backstop if delete fails.
- **`ENFORCE_CONSENT_GUARD` in `src/assets/js/core/auth.js`.** Page-load guard that silently signs out any authenticated user whose doc has `consent.legal.status !== 'granted'`. Default **FALSE** until the legacy-user migration runs (which sets all existing docs to `granted` + `source: 'imported'`); flipping it on before then would lock every existing user out.
- **`consent` field on the `sendUserSignupMetadata` payload.** Forwards the storage-survived consent blob to BEM's `/user/signup` route so it can write the canonical `consent.{legal,marketing}` sub-tree on the new user doc.
- **Marketing-emails toggle on the account page.** `src/defaults/dist/_layouts/themes/classy/frontend/pages/account/index.html` + `src/assets/js/pages/account/sections/notifications.js` reworked to read `account.consent.marketing.status` (not the old `preferences.notifications.marketing`) and POST to `/backend-manager/marketing/email-preferences` on change. Shows the original grant date below the toggle.

### Changed

- **`web-manager` bumped to `^4.2.0`** (was `file:../web-manager` from local dev). Locks in `DEFAULT_ACCOUNT.consent.{legal,marketing}` so `resolveAccount()` always returns a defined consent shape for legacy users.
- Minor template touchups on `oauth2.html`, `reset.html`, `signin.html`, `token.html`, `signup.html` — heading casing, `filter-adaptive` class on the brandmark logo so it inverts in dark mode.

### Fixed

- **`_team` seed authors** — corrected LinkedIn/Twitter handles in `christina-hill.md`, `james-oconnor.md`, `marcus-johnson.md`, `priya-sharma.md`, `sarah-rodriguez.md` so the default scaffolded `/team/` page links don't 404.

---
## [1.2.3] - 2026-05-19

### Added

- **Markdown table styles in blog posts** — `article .blog-post-content table` in `src/assets/css/pages/blog/post.scss` now renders any plain `| col | col |` markdown table with a rounded outer border, uppercase letter-spaced thead on a tinted background, zebra-striped tbody rows, hover highlight, and tighter padding/font-size on mobile (≤575.98px).

### Changed

- **Tidied heading-margin rule** in `src/assets/css/pages/blog/post.scss` — collapsed `h1..h6` onto one selector and removed the commented-out `:first-child` reset.

---
## [1.2.2] - 2026-05-18

### Added

- **`docs/<topic>.md` deep references** — 17 new files referenced by the v1.2.0 CLAUDE.md reorg that hadn't been committed yet: `ads.md`, `analytics.md`, `appearance.md`, `assets.md`, `audit.md`, `css.md`, `icons.md`, `images.md`, `javascript-libraries.md`, `jekyll-plugin.md`, `layouts-and-pages.md`, `lazy-loading.md`, `local-development.md`, `page-loading.md`, `project-structure.md`, `seo.md`, `xss-prevention.md`. Restores parity with the cross-links already shipped in [CLAUDE.md](CLAUDE.md).
- **`src/defaults/docs/README.md`, `src/defaults/test/README.md`, `src/defaults/CHANGELOG.md`** — consumer-project scaffolding files distributed via the `defaults` gulp task.

---
## [1.2.1] - 2026-05-18

### Changed

- **Default `/extension` page** — removed the redundant downloads-section heading block ("Install" badge + "Available on every browser" headline + "Choose your browser below to get started" subheadline) that duplicated the role of the page hero. Browser-selector pills now sit directly under the hero. Affects `src/defaults/dist/_layouts/themes/classy/frontend/pages/extension/index.html` and drops the now-unused `downloads.superheadline` / `downloads.headline` / `downloads.headline_accent` / `downloads.subheadline` frontmatter keys.

---
## [1.2.0] - 2026-05-12

### Added

- **Three-layer test framework** (`build` / `page` / `boot`, 60 framework tests passing in ~3s). New under `src/test/`: `assert.js` (Jest-compatible matcher set), `runner.js` (discovery + dispatch + reporter), `index.js` (public API), `runners/{chromium,boot}.js` (Puppeteer launchers with a zero-dep embedded HTTP server in `server.js` for serving `_site/` to Chromium — required because service workers can't register from `file://`), `harness/page/index.html` (stub harness page), `fixtures/consumer-site/` (minimal hand-built `_site/` for framework boot tests). Consumer-test discovery uses the `isFrameworkSelfTest` package-name check to scope framework `boot/` suites to UJM's own runs.
- **`test` CLI command + `--test` alias** (`src/commands/test.js`) — avoids `-t` collision with the existing `translation` command. Sets `UJ_TEST_MODE=true` + auto-routes `UJ_TEST_BOOT_PROJECT` to the fixture when UJM tests itself. `"test": "node ./bin/ultimate-jekyll test"` added to scripts, `"test": "npx mgr test"` added to projectScripts.
- **`src/utils/mode-helpers.js`** — `attachTo(Manager)` mixin exposing `isTesting`/`isDevelopment`/`isProduction`/`getVersion`. Wired into `src/build.js` (CJS, build-time Manager) and `src/index.js` (ESM, frontend Manager). Driven by `UJ_TEST_MODE` env in Node + `globalThis.UJ_TEST_MODE` in browser contexts.
- **`puppeteer` devDep** — peer-optional for consumers (only needed if they write `page`/`boot` tests; `build` layer needs nothing extra).
- **New `docs/<topic>.md` deep references** — `docs/test-framework.md`, `docs/test-boot-layer.md`, `docs/cross-context-helpers.md`. Plus `docs/_legacy-claude-md.md` as a holding pen for the previous 1832-line CLAUDE.md content awaiting future per-subsystem split.
- **Consumer-shipped `src/defaults/CLAUDE.md`** with `# ========== Default Values ==========` / `# ========== Custom Values ==========` markers. Framework section stays live-synced across `npx mgr setup` while the Custom section is preserved verbatim — same merge protocol as `.env`/`.gitignore`.
- **`'CLAUDE.md'` FILE_MAP rule** (`src/gulp/tasks/defaults.js`) with `mergeLines: true` — positioned after the `'**/*.md'` catch-all so the last-match-wins logic in `getFileOptions` activates the merge path.

### Changed

- **CLAUDE.md reorganized from 1832 to 195 lines** as a TOC hub with one-paragraph-per-subsystem + cross-links. Legacy content stashed in `docs/_legacy-claude-md.md` as a migration source.
- **README.md updated** with a Testing section (build/page/boot layer overview + example test files) and a Sister Projects callout.

### Fixed

- **`mergeLineBasedFiles` idempotency bug** — the inline merge function unconditionally inserted a blank line before `CUSTOM_SECTION_MARKER`, causing first-merge after a fresh `jetpack.copy` to grow the file by one newline. Now skips the insert if `mergedDefaultSection` already ends blank. Affects `.env`/`.gitignore`/`CLAUDE.md` equally — first-merge is now a true no-op.

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
