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

### Fixed
- **The sass watcher no longer dies with `ENOENT: scandir .../src/assets/css/bundles` in consumers that have no project bundles dir.** `bundleFiles` fed an unguarded `src/assets/css/bundles/*.scss` glob into `src()`/`watch()`, and gulp's `src()` throws when it scandirs a missing directory — the boot-time compile survived, but every watcher-triggered rebuild errored within milliseconds and the consumer's dist CSS silently went stale. The project-bundles glob is now included only when the dir exists — the same `jetpack.exists` guard `themePageGlobs()` in the same file already uses for theme page dirs (and documents with the identical rationale). Most consumers don't define project bundles, so most consumers hit this on every SCSS edit.

---
## [1.9.28] - 2026-07-03

### Changed
- **web-manager `^4.3.2` → `^4.3.4`** — picks up the dev API URL switch to `https://localhost:5002` (the frontend half of BEM's HTTPS serve proxy; plain http:// could not connect to it) and dev-only loopback redirect support for native-app sign-in.

### Fixed
- **`serve` no longer reuses HTTPS certificates this machine doesn't trust, and actually reuses the ones it does** — two bugs in `getHttpsConfig()` (harmonized with backend-manager's identical fix): (1) the reuse lookup matched `localhost*.pem`, but mkcert names files after the FIRST SAN host (`development.<brand>+N.pem`), so cached certs were never found and certs were silently regenerated on EVERY serve; (2) the "validity" check only looked for a `BEGIN CERTIFICATE` header — a cert issued by a DIFFERENT machine's mkcert CA (e.g. `.temp` copied from another Mac) or an expired one was reused blindly, making browsers reject `https://localhost:4000`. Existing certs are now verified (unexpired + signature chains to the current `mkcert -CAROOT` root) and wiped + regenerated when they don't; the no-mkcert self-signed fallback is preserved.

---
## [1.9.27] - 2026-07-03

### Changed
- **The token page's legacy `?payload=` wrap is now ADDITIVE, never a replacement.** Custom-scheme redirects carry BOTH `?authToken=<token>` (the modern shape) AND `?payload={"token":…}` (the legacy-app shape) — previously the wrap DELETED `authToken` before setting `payload`, so modern desktop apps (Electron Manager's `getAuthUrl()` flow, which reads only `authToken`) received a token they couldn't see. Each consumer reads its own param and ignores the other; old-app behavior unchanged. One line (`searchParams.delete('authToken')` removed); the whole wrap still deletes cleanly when legacy desktop app support ends.

### Fixed
- **The `/token` page no longer spins forever after a failure.** The loading spinner was static layout markup that `showError()` never hid, so any resolution error (token fetch failure, invalid redirect URL, unauthenticated) left it spinning behind the error alert. The spinner now stops on every terminal state and, on error, is replaced by a **Try again** button (reloads the page to re-attempt auth + token generation) plus a smaller **Go home** link. New page-layer suite `token-error-state.test.js` locks the spinner-off / actions-on transition and the retry-button wiring.

## [1.9.26] - 2026-07-02

### Fixed
- **Setup reruns no longer clobber the consumer's `test/_init.js`.** No `FILE_MAP` rule matched `test/**` in the defaults task, so shipped test files fell through to the `overwrite: true` default and every `npx mgr setup` reset the consumer's fixture hook to the stub (silently breaking any project whose suites depend on `_init.js`-synthesized fixtures). `test/**/*` is now copy-once (`overwrite: false`) — seeded when missing, consumer-owned after — matching the existing `src/`/`hooks/` convention. `getFileOptions` is exported from `defaults.js` and the rule classes are locked by a new build-layer test (`defaults-file-options.test.js`); the defaults-distribution rule table is documented in `docs/build-system.md`.

## [1.9.25] - 2026-07-02

### Fixed
- **`--extended` no longer swallows the test target.** The bin parsed argv with bare yargs, so value-less flags were untyped and `mgr test --extended some/target` became `extended='some/target'` with NO positional target — the target was lost AND extended mode silently stayed off (the string fails the `=== true || === 'true'` check), running the full suite in normal mode. The bin now declares `.boolean(['extended'])`, mirroring the same fix in BEM's CLI. Flag-last invocations (`mgr test some/target --extended`) were unaffected.

## [1.9.24] - 2026-07-02

### Fixed
- **Test discovery now excludes `_`-prefixed directories at ANY depth.** The discovery globs ignored only top-level `_` entries (`['_**']`), so files nested under an underscore directory — e.g. a consumer's `test/_helpers/harness.js` — were picked up as suites and failed with "not a valid suite". Both discovery globs (framework + consumer) now share the exported `DISCOVERY_IGNORE = ['**/_*.js', '**/_*/**']` (runner.js), matching the documented convention: `_`-prefixed files AND everything under `_`-prefixed directories are skipped. New build-layer self-test (`test-discovery.test.js`) proves the pattern against a real temp tree; `docs/test-framework.md` → Discovery documents the convention. Mirrors EM's fix — same constant, test, and docs shape across BXM/EM/UJM (BEM's recursive walker already skipped `_` at every depth).

## [1.9.23] - 2026-07-02

### Changed
- **`docs/cdp-debugging.md` rewritten for the per-session isolated browser model** (mirrored across UJM/BEM/BXM/EM/WM). Claude sessions now auto-launch their OWN private Chrome via the `chrome-devtools` MCP — no manual launch command, no ports, no shared `chrome-profiles/agent`, no `CHROME_CDP_PORT`. Profiles are ephemeral (log in during the task); self-signed HTTPS is pre-accepted.

### Added
- **OMEGA mirror mandate** — `CLAUDE.md` (Doc-update parity) now states the docs are structurally MIRRORED across the sister frameworks (section skeleton, consumer template, shared-concept doc filenames, omega skills — same order everywhere); `src/defaults/CLAUDE.md` carries a maintainer mirror note. Canonical skeletons live in the `omega:main` skill's mirror-spec resource.

### Fixed
- Resolved the committed merge conflict in `docs/cdp-debugging.md` and settled the rule (also in CLAUDE.md): **the dev server URL is `https://localhost:4000` — NEVER the LAN IP** (`https://192.168.x.x:...`).

## [1.9.22] - 2026-07-01

### Changed
- Moved `/cancel` and `/refund` default redirects from `redirects/authentication/helpers/` into a new `redirects/billing/` category

### Fixed
- `/refund` default redirect now points to `/terms` (where the refund policy lives) instead of `/privacy`

---
## [1.9.20] - 2026-06-30

### Fixed
- **Imagemin Gulp 5 binary corruption** — `gulp.src()` in the imagemin task was missing `encoding: false`, causing Gulp 5's default UTF-8 encoding to corrupt binary image files (replacing JPEG bytes with U+FFFD replacement characters). This was the root cause of `IMG_3119.JPG` CI failures.

---
## [1.9.19] - 2026-06-30

### Changed
- **Added buffer diagnostics** to `lowercaseExtTransform` — logs buffer length, first bytes, and null/buffer state for debugging image processing failures on CI.

---
## [1.9.18] - 2026-06-30

### Fixed
- **CI workflow template** — `sfw npm install` now falls back to plain `npm install` when all 3 attempts fail, instead of aborting the build. Works around a `sfw` bug that crashes on certain package fetches.

---
## [1.9.17] - 2026-06-30

### Changed
- **Updated `gulp-responsive-modern` to 1.0.2** — improved error reporting so CI failures surface the actual error message instead of an empty `Error`.

---
## [1.9.16] - 2026-06-30

### Fixed
- **Workflow template not syncing to consumers** — `defaults.js` was missing `overwrite: true` on the `.github/workflows/build.yml` entry, so the file was only written on first scaffold and silently skipped on every subsequent `npx mgr setup`.

### Changed
- **CI workflow hardening** — `sfw npm install` now retries up to 3 times with 15s delay to handle transient `ECONNRESET` / socket hang-ups on GitHub Actions runners.
- **Updated GitHub Actions versions** — `actions/checkout` v4 → v7, `actions/setup-node` v4 → v6 (fixes Node.js 20 deprecation warnings).

---
## [1.9.15] - 2026-06-30

### Fixed
- **Imagemin uppercase extension handling** — files like `IMG_3119.JPG` now process correctly on Linux CI. The `lowercaseExtTransform` reads file contents into a buffer before renaming the Vinyl path, and cache-path logic normalizes extensions to lowercase.
- **Updated `gulp-responsive-modern` to 1.0.1** — case-insensitive format detection and buffer-first sharp initialization.

---
## [1.9.14] - 2026-06-29

### Changed
- **Updated Font Awesome icons to Pro Plus 7.3.0.** Brands: 549 → 609 (+60). Solid: 4,677 → 4,799 (+122). Documented download/update process in `docs/icons.md`.
- **Added CSS comments** to form-state disabled-button guards in `_utilities.scss`.
- **Calendar UTC clock** now refreshes on a separate 1s interval (decoupled from the 60s now-line update).

---
## [1.9.13] - 2026-06-29

### Changed
- **Upgraded major dependencies**: @babel/core 7→8, @babel/preset-env 7→8, js-yaml 4→5. Guarded `yaml.load()` call sites against js-yaml 5's empty-document throw behavior. No webpack config changes needed for Babel 8.
- **Upgraded patch/minor dependencies**: adm-zip, dompurify, fast-xml-parser, html-validate, postcss, prettier, puppeteer, sass, web-manager, webpack (5.108.3).
- **Auth form fully disabled during OAuth redirect check.** Fields and buttons are now disabled via `_setDisabled(true)` while `handleRedirectResult()` runs, preventing interaction during the redirect validation window.
- **Improved CSS-disabled button styling.** Added `background-color` and `border-color` to the `data-form-state` CSS guard so the visual matches Bootstrap's native `:disabled` appearance (no flash on transition).

### Added
- **`_dev_simulateRedirect` query parameter** for auth pages (`/signin`, `/signup`, `/reset`). Values: `true`/`success` (login flow), `signup` (new-user flow), `error` (error + re-enable). Exercises the real `handleRedirectResult()` code paths with fake data.
- **UTC clock seconds** on the marketing calendar page (refreshes every second).
- **Documented all `_dev_*` query parameters** in `docs/local-development.md`.

---
## [1.9.10] - 2026-06-26

### Changed
- **Migrated all `?cb={{ site.uj.cache_breaker }}` patterns to `| uj_cachebreak` filter.** Every asset reference (favicons, CSS/JS bundles, logos, brandmarks, provider logos, ad unit scripts) now uses the `uj_cachebreak` Liquid filter from jekyll-uj-powertools v1.8.0. The filter intelligently handles URLs with or without existing query strings (`?` vs `&`). The only remaining `site.uj.cache_breaker` reference is the `buildTime` JS variable in foot.html (not a URL).

---
## [1.9.9] - 2026-06-26

### Fixed
- **Added missing `?cb=` cachebreaker to logo/brandmark `<img>` tags.** Nav (2 variants: wordmark + avatar), dashboard sidebar (desktop + mobile), and feedback page rating images were all rendering without `?cb={{ site.uj.cache_breaker }}`, causing stale cached images when logos changed on the CDN. All other assets (favicons, CSS/JS bundles, ad units) already had cachebreakers — these 5 img tags were the only gaps.

### Added
- **Documented cachebreaker rule** in `CLAUDE.md` (File Conventions) and `docs/common-mistakes.md` (#14): all `<img src>` tags in includes/layouts must append the cachebreaker. `data-lazy="@src"` is handled at the JS layer.
- **Listed `uj_append_param` and `uj_cachebreak` filters** in `docs/jekyll-plugin.md` (shipped in jekyll-uj-powertools v1.8.0).

---
## [1.9.8] - 2026-06-25

### Changed
- **Removed redundant `disabled` from submit buttons in default templates.** The CSS `form[data-form-state]:not([data-form-state="ready"]) [type="submit"]` already protects submit buttons visually during initialization. The `disabled` HTML attribute was unnecessary cruft — FormManager excludes submit buttons from the permanently-disabled snapshot and re-enables them on `ready()`. Affected: auth (signin, signup, reset), hero demo, email-preferences, and all test forms.

---
## [1.9.7] - 2026-06-23

### Added
- **Gitignore rules for blogify test posts.** The default `.gitignore` template now excludes `src/_posts/test/` and `src/assets/images/blog/post-test-*/` so generated test blog content stays out of version control. Consumer projects pick this up on the next `npx mgr setup`.

---
## [1.9.6] - 2026-06-22

### Changed
- **FormManager: forms editable during initialization.** Removed the whole-form CSS lockdown (`pointer-events: none; opacity: 0.65`) and blanket `_setDisabled(true)` from `_init()`. Inputs are now immediately interactive — only submit buttons stay disabled until FM is ready. Premature submission is prevented by three existing layers: `disabled` on submit buttons, `onsubmit="return false"`, and FM's state check.
- **Disabled-state CSS covers `[aria-disabled="true"]`.** Added `[aria-disabled="true"]` to the disabled selectors in `_utilities.scss` and the body.html click interceptor for Bootstrap/accessibility pattern compatibility.
- **FM form-state submit button safety net.** Added `form[data-form-state]:not([data-form-state="ready"]) [type="submit"]` to the disabled CSS — ensures submit buttons in non-ready FM forms always show disabled styling even if the `disabled` attribute is omitted.
- **Replaced `.npmignore` with `files` field** in `package.json` for cleaner tarball control.

---
## [1.9.5] - 2026-06-22

### Changed
- **FormManager: CSS-based loading guard replaces per-element `disabled`.** All FM-managed forms now use `data-form-state="initializing"` + a CSS rule (`pointer-events: none; opacity: 0.65`) instead of `disabled` attributes on individual inputs. FM sets the attribute in `_init()` and the CSS unblocks when state transitions to `ready`. Removed loading-guard `disabled` from inputs across all 41 forms (auth, contact, checkout, hero demo, account, admin, etc.) and 7 test forms. Submit buttons retain `disabled` in HTML — FM excludes `type="submit"` from the snapshot by design.

### Added
- **Supply-chain security via Socket Firewall.** New `safeInstall()` helper (`src/lib/safe-install.js`) wraps npm install with `sfw` (Socket Firewall) when available, scanning the full transitive dependency tree for malware before download. `npx mgr install` and `npx mgr setup` now route through it. CI `build.yml` installs sfw globally and runs `sfw npm install`.

### Fixed
- **Footer language switcher no longer links to excluded pages.** The language dropdown now checks `translation.exclude` before rendering language links. Pages matching an exclude entry (e.g. blog posts when `"blog"` is excluded) only show the default language, preventing dead `/es/blog/...` links that 404.

---
## [1.9.4] - 2026-06-20

### Fixed
- **Blog post ads no longer render inside blockquotes.** Ad insertion now filters out `<p>` elements inside `<blockquote>`, `<details>`, and `<figure>` so ads only appear between top-level content blocks.

---
## [1.9.3] - 2026-06-18

### Changed
- **Notifly build-error notifications use absolute path.** Switched from bare `notifly` keyword to full application path (`/Applications/Notifly.app/Contents/MacOS/Notifly`) so the notification binary resolves reliably regardless of PATH.

---
## [1.9.2] - 2026-06-17

### Added
- **Account page: API & MCP section.** Renamed "API keys" to "API & MCP". New MCP integration card with server URL (copy-to-clipboard) and tabbed setup instructions for 9 providers: Claude, Cursor, VS Code, Codex, Gemini CLI, OpenCode, Windsurf, Zed, and Other. MCP URL built dynamically from `webManager.getApiUrl()`.

---
## [1.9.1] - 2026-06-17

### Changed

- **FormManager: snapshot-and-restore disabled-state model (replaces `data-fm-keep-disabled`).** `_init()` now snapshots every element that has `disabled` in HTML markup (excluding submit buttons — those are loading guards FM takes over). Snapshotted elements stay disabled through every state transition automatically — no data attributes needed. Recommended form pattern: `<form data-form-state="initializing" onsubmit="return false">` with CSS `form[data-form-state]:not([data-form-state="ready"]) { pointer-events: none; }`. Documented in `docs/javascript-libraries.md`.

### Added

- **Comprehensive FormManager test suite (30 page-layer tests).** Disabled-state snapshot (5 tests), getData/setData/input groups (12 tests), validation/honeypot/file-accept (13 tests). Previously FormManager had zero automated tests.
- **Visual Test 7 on the FM test page** (`/test/libraries/form-manager`) — permanently disabled elements, submit cycle demo, rapid-cycle button for manual verification.

---
## [1.9.0] - 2026-06-17

### Added

- **Token page: MCP OAuth flow.** When the `/token` page receives `?mcp=true&redirect_uri=...&state=...`, it completes an OAuth-style handshake — the user signs in via Firebase Auth, the page obtains a fresh ID token, and redirects back to the `redirect_uri` with `code=<idToken>&state=<state>`. This lets Claude (or any MCP client) authenticate users through the existing sign-in UI without a custom OAuth server.

### Changed

- **Dev-URL guidance updated** — docs (local-development.md, themes.md, cdp-debugging.md, CLAUDE.md) now say "prefer `https://localhost:4000`; fall back to the network IP if localhost doesn't connect" instead of hardcoding a specific IP.

---
## [1.8.2] - 2026-06-14

### Added

- **FormManager: `data-fm-keep-disabled` opt-out for permanently-disabled fields.** `_setDisabled` blanket-toggles `disabled` on every control in the form (loading/submitting ↔ ready), which silently re-enabled fields meant to STAY disabled — e.g. "coming soon" radio options rendered inside a managed form. Controls carrying `data-fm-keep-disabled` are now always forced to `disabled = true` and never re-enabled. Documented in `docs/javascript-libraries.md` (FormManager section).
- **`docs/cdp-debugging.md` — launching a controllable browser (mirrored across UJM/BEM/BXM/EM).** The canonical Chrome launch for agents and humans: CDP port + REQUIRED dedicated `--user-data-dir` (Chrome 136+ silently ignores the debug port on the default profile — verified on 149), the persistent agent profile (`~/Library/Application Support/chrome-profiles/agent` — log in once, state survives relaunches, verified), the shared-instance model (CDP is multi-client — agents share the one logged-in Chrome on one port, one tab each; a second profile/port only for a second identity), safe quit by profile match, and driving via the `chrome-devtools` MCP (`CHROME_CDP_PORT` set before the session) or any CDP client. UJM flavor: point it at the dev server for the edit → live-reload → screenshot/console/network loop. Indexed in CLAUDE.md.

---
## [1.8.1] - 2026-06-11

### Changed

- **`docs/audit.md` rewritten as the full-audit check catalog (`/omega:ujm audit`).** The two-stage site audit became an ID'd catalog: mirrored universal checks (U-01..U-14 — tests at every layer, XSS, secrets, config canon, doc parity, dead code, dep health, …), UJM-specific checks (UJM-01..UJM-10 — inline-script ban, theme-prefixed classes, content writing rules, SEO meta, purge safelist, reads-vs-writes, page-module pattern, images, a11y), and framework-repo checks (F-01..F-04 — sister parity, defaults sync, docs completeness, green framework suite), with scope auto-detect (consumer vs framework via package.json), a persisted findings report (`.temp/audit/claude-audit.md`), a severity-ordered TodoWrite fix loop, and the `npx mgr audit` automated stage absorbed from the old doc. Wired to the `omega:ujm` router's Audit process; `docs/audit.md` is mirrored across BEM/BXM/EM. CLAUDE.md's docs index updated to match.
- **package.json `keywords` corrected** — replaced the stale template list (`Autoprefixer`, `imagemin` — not used; `Browsersync` — true but noise) with accurate, discovery-oriented ones (`jekyll`, `static-site`, `static-site-generator`, `website`, `seo`, `gulp`, `sass`, `webpack`, `postcss`). npm-listing metadata only; no behavior change. Mirrored across BEM/BXM/EM.

---
## [1.8.0] - 2026-06-11

### Added

- **`docs/migration.md` + expanded `docs/audit.md` + dashboard-pages pattern (action-skill consolidation).** The standalone `UJM:migrate`/`UJM:audit`/`UJM:new-page`/`UJM:new-site` skills were deleted and folded into `omega:ujm` as process checklists; their framework facts landed in the repo: new `docs/migration.md` (full old-UJ→UJM migration incl. `_legacy/` flow + config re-mapping, `_config.yml` quick-fix key schema, revert-posts procedure), `docs/audit.md` expanded to the full two-stage workflow (AI content pass → `npx mgr audit` fix loop), and `docs/layouts-and-pages.md` gained the dashboard list/detail/edit page pattern (separate pages, `?id=` redirects, breadcrumbs).
- **Dev-process guidance relaxed: only `npm start` is off-limits.** The "NEVER run" rule in CLAUDE.md + `src/defaults/CLAUDE.md` now prohibits only the long-running dev server (instruct the user to start it if it isn't running; read `logs/*.log`, never tail the process) — `npx mgr test` and `npm run build` are fine to run.
- **Skills-as-routers migration — `docs/no-inline-scripts.md` + `docs/purgecss.md` (new), plus `seo.md` / `layouts-and-pages.md` / `javascript-libraries.md` / `assets.md` extensions.** Framework facts migrated from the `omega:ujm` skill into the repo so they version-match the installed package: `no-inline-scripts.md` carries the full hard-rule playbook (where scripts move, Liquid `data-*`/`<template>`/conditional bridges, window-global callbacks, step-by-step migration, verification grep); `purgecss.md` carries the safelist playbook (two locations, RegExp anchoring, `variables: false` gotcha, per-file processing, current UJM safelist, category guide); `seo.md` retitled "SEO & Content" and gains the content writing rules (action-verb H1s, sentence case, headline/accent structure, frontmatter SEO, superheadline rules) + Services and Solutions page strategies + alternatives content guidelines; `layouts-and-pages.md` gains default-page customization rules (.md vs .html, page exclusions), the per-page customization-levels table (homepage/pricing/about/contact/download incl. hero display modes, pricing feature comments, testimonial/FAQ guidelines), and the custom-page creation checklist; `javascript-libraries.md` gains the reads-vs-writes rule (Firestore SDK for dashboard reads, Cloud Functions for writes) + Firestore read examples; `assets.md` gains the account-dropdown item field reference. The `data-wm-bind` deep reference moved to `web-manager/docs/bindings.md` (the module that owns the feature). All indexed in CLAUDE.md; the skill is now a thin router (pointers + hard rules + process checklists).

### Changed

- **Router skill renamed `UJM:patterns` → `omega:ujm`** — all framework skills now live under the `omega:` namespace (`omega:em`/`omega:bxm`/`omega:ujm`/`omega:bem` + the `omega:main` hub). CLAUDE.md's Recommended skills section updated.
- **newsflash homepage post slots are strictly deduplicated.** Each section consumes its own slice of `site.posts` so no story repeats down the page: hero = post 1, top stories = 2–4, "the latest" feed = 5–9, most-read rail = 10–14, "more to chew on" = 15–17 (only the ticker repeats the latest — it's chrome, not content). Sections disappear gracefully when the site doesn't have enough posts to fill their slice.
- **Dev builds raise `--limit_posts` from 15 to 18** so a fully-populated newsflash front page (17 distinct posts) is visible during development (`--all-posts` still disables the cap entirely).
- **Footer appearance picker is now icon-only.** The toggle button in classy's and newsflash's footers shows just the mode icon (`data-appearance-icon` spans) — the `data-appearance-current` text label was removed from the button (the mode words remain in the dropdown items). Pure HTML change; the framework `data-appearance-*` logic is untouched. Docs updated in [docs/themes.md](docs/themes.md#the-appearance-picker-is-required-in-every-footer) + [docs/appearance.md](docs/appearance.md).
- **newsflash homepage desk cards link to their category pages.** Each desk card is now a story-card link (`href` per item, falling back to the slugified title → `/blog/categories/<slug>`) with a "Read the desk" affordance.
- **newsflash testimonials moved from the homepage to the about page.** The "From our readers" quote-card section (universal `testimonials` key) now lives on about between the principles and the team CTA; the `.quote-card` styles moved from the homepage page CSS to the about page CSS.
- **newsflash nav + footer include forks deleted — chrome now inherits from classy.** The nav fork was a verbatim copy of classy's (the fallback regenerates an identical file); the footer's editorial look (oversized serif wordmark, hidden avatar, 24em description measure, panel-color repaints of the `.link-muted`/`.text-body` utilities, weight-800 volt column heads) was ported into the theme's `_general.scss` footer rules, so classy's inherited markup renders the same ink-slab design in both modes.
- **Classy footer language icon is now theme-adaptive.** The language dropdown button's hardcoded multicolor inline SVG (fixed fills that ignored `currentColor` and clashed on dark surfaces like newsflash's ink-slab footer) is replaced with `{% uj_icon "language" %}`, which inherits the button's color in every theme and mode.
- **`docs/project-structure.md` renamed `docs/directory-structure.md`** (H1 `# Project Structure` → `# Directory Structure`) for cross-framework doc-file parity — BEM names the same concept `docs/directory-structure.md`, and mirrored docs must match down to the file name. All references updated (`CLAUDE.md`, historical CHANGELOG links). Also normalized `docs/test-boot-layer.md`'s H1 to `# Test Framework — Boot Layer` (matches BXM; EM normalized likewise).

### Added

- **Docs parity — new `docs/build-system.md`, `docs/templating.md`, `docs/logging.md`, `docs/common-mistakes.md`.** `build-system.md` makes CLAUDE.md's existing pipeline-reference link real (was a dead link) — gulp task list, config flow, build modes, pure helpers; `templating.md` graduates from "(planned)" — node-powertools bracket conventions + Liquid coexistence; `logging.md` is now the SSOT for the log-file tee (extracted from local-development.md, which keeps a pointer — mirrors EM/BXM); `common-mistakes.md` extracts the canonical anti-pattern list into the repo (BEM already had one). All indexed in CLAUDE.md → Documentation.
- **Test coverage convention (docs).** New mirrored "Test coverage" sections in `CLAUDE.md`, `docs/test-framework.md`, `src/defaults/CLAUDE.md`, and `src/defaults/test/README.md` — every feature ships with tests at every layer it has a surface in (logic `build`/`page`, UI `page`, end-to-end `boot`); a layer is skipped only when the feature genuinely has no surface there. Mirrored across EM/BXM/BEM.
- **New `newsflash` theme — editorial news site.** Paper + ink + vermilion design language with volt highlights: Fraunces serif headlines over Schibsted Grotesk, a live news-ticker marquee above the sticky blurred masthead, framed editorial images, hard-offset "lift" pill buttons, film-grain overlay, and first-class dark mode (deep warm near-black paper, cream ink). Ships custom layouts for base (fonts + ticker), homepage (cover-story hero + top-story tiles + "the latest" editorial post feed with sticky most-read/newsletter rails + numbered rundown playbook + "more to chew on" story tiles + dark big-read CTA band), blog index (lead-story splash + editorial tiles), blog post (reading-progress bar, drop cap, serif crossheads, pullquotes, author card), blog category archives (desk directory with stroked story-count numerals + per-desk fronts), blog tag archives (topics wall + per-topic fronts), pricing (membership tiers with "Editor's pick" + flash-sale promo banner), about (newsroom timeline), contact ("contact the desk" + tips line), team ("the masthead" byline cards + ink-slab charter + newsroom principles), team member (reporter profile with beat facts strip), and a 404 "correction notice". Functional pages (download, feedback, updates, auth, account) intentionally inherit classy markup restyled. Select with `theme.id: "newsflash"`. See [docs/themes.md](docs/themes.md).
- **Theme-authoring convention: genre-native frontmatter defaults.** A theme's layout frontmatter defaults are part of its identity and must be written for the theme's genre (newsflash ships news copy + news-purposed `rundown`/`desks` homepage sections), never copied from classy's SaaS demo data. Universal section keys (`hero`, `cta`, `stats`, `faqs`, `pricing.plans`, …) stay shared so consumer overrides survive theme swaps. Documented in [docs/themes.md](docs/themes.md#frontmatter-defaults-are-part-of-the-themes-identity) + the Path A authoring checklist.
- **Appearance picker in every footer.** Classy's footer now ships the appearance (light/dark/system) dropdown next to the language dropdown — a pure drop-in block driven by the framework's `data-appearance-*` attributes. Every theme inherits it via the footer fallback; themes with custom footers (newsflash) include it themselves. Documented as required footer furniture in [docs/themes.md](docs/themes.md) + [docs/appearance.md](docs/appearance.md).
- **Theme-authoring convention: inherit classy's nav + footer chrome, restyle via CSS.** Themes do NOT fork the chrome includes — `copyFallbackThemeFiles()` supplies classy's nav/footer (with paths rewritten into the theme's namespace) and the chrome's identity comes from theme CSS (newsflash's serif masthead + editorial ink-slab footer are pure `css/layout/` restyles of classy's markup). Fork an include only when the structure genuinely diverges — a re-skin fork is a copy that silently drifts (newsflash's nav fork had diverged from classy by nothing but a comment, and the icon-only picker fix had to be applied twice). Documented in [docs/themes.md](docs/themes.md) + the Path A authoring checklist.
- **Theme-contract build test.** New `mgr:build/theme-contract` suite turns the docs/themes.md conventions into executable assertions, globbing every shipped theme (`_template` included) so a new theme is covered the moment it lands: entry files + `$avatar-sizes` + shared bootstrap-overrides import, `[ site.theme.id ]` bracket parents (swappability), no theme-prefixed classes in markup, no inline `<script>` bodies, the pricing JS-contract markers, `blog-post-content` in post layouts, and page-asset files matching a layout-declared `asset_path` shape (wrong shape = silent bundle skip). It caught neobrutalism's missing promo banner + `.card-title` on its first run.
- **Shared plan-pricing include — `core/pricing/resolve-plan.html`.** The plan price-resolution Liquid (product lookup from `site.web_manager.payment.products`, frontmatter-over-config monthly/annual precedence, per-unit math) was copy-pasted across all three themes' pricing layouts; it's now a single shared "logic include" (Jekyll includes share caller scope) that every theme calls per plan and renders the assigned variables from. Also guards the per-unit `divided_by` against nil/zero unit values, which previously crashed the build when the per-unit feature value couldn't resolve.
- **Theme-authoring convention: develop in ONE appearance mode, ship with BOTH.** Build against a primary mode (the consumer's `theme.appearance` default), then validate light AND dark before declaring the theme done — including a live click-through of the footer appearance picker. Documented in [docs/themes.md](docs/themes.md) authoring conventions + validation checklist.
- **Theme-authoring gotchas documented:** theme page bundles re-emit Bootstrap after the main bundle (use doubled selectors — `:root:root`, `[data-bs-theme="dark"][data-bs-theme="dark"]`, `.btn.btn`), and `.bg-body-*`/`.text-body-*` utilities paint from the `--bs-*-rgb` companion variables, which must be remapped alongside the hex vars. See [docs/themes.md](docs/themes.md).
- **`npx mgr blogify --count=<n>`.** The blogify command now accepts a post count (default 12, matching the old hardcoded behavior) — e.g. `--count=18` fills every deduplicated post slot on the newsflash homepage. Documented in README + the CLAUDE.md CLI table.
- **`npx mgr test` tees output to `logs/test.log`.** All test-runner output is now duplicated (ANSI-stripped) to `<projectRoot>/logs/test.log`, truncated fresh on each run, via the existing `attach-log-file` util (skipped on CI through `isServer()`) — mirrors EM's and BEM's `test.log` pattern. Grep the file after a run instead of scrolling terminal scrollback.
- **`TEST_EXTENDED_MODE` — extended test mode (`--extended`).** `npx mgr test --extended` (or `TEST_EXTENDED_MODE=true npx mgr test`) opts in tests that hit REAL external services (network fetches, Firebase via web-manager, live APIs); off by default so `npx mgr test` stays fast and offline-safe. The signal is the unprefixed `TEST_EXTENDED_MODE` env var — the SAME name across BEM/BXM/UJM/EM (cross-framework parity) — and once set it propagates to every spawned child (the Jekyll build, the boot HTTP server / Puppeteer browsers) via inherited `process.env`. A warning prints (and is teed to `logs/test.log`) when on. Gate live tests on `process.env.TEST_EXTENDED_MODE`. New `src/test/utils/extended-mode-warning.js` is the SSOT for the warning copy. Documented in [docs/test-framework.md](docs/test-framework.md#extended-mode-test_extended_mode) + the env-vars table.

### Changed

- **Test command standardizes on `TEST_EXTENDED_MODE`, replacing `--integration` / `UJ_TEST_INTEGRATION`** (no backwards compat — the old flag/env are gone). Mirrors the canonical unprefixed `TEST_EXTENDED_MODE` shared across BEM/BXM/EM.

### Fixed

- **`attach-log-file` no longer truncates `logs/test.log` mid-run.** The tee state is now wrapped in a `createTee()` factory (independent, stackable instances) with the process-wide singleton built on top. A later `attach()` captures the CURRENT `process.stdout.write` (which may already be an outer tee) and restores that exact reference on `detach()`, so stacked tees fan out and unwind in LIFO order. The new build-layer `attach-log-file` test uses its OWN `createTee()` instance, so exercising attach/detach no longer detaches the live singleton tee that's capturing the actual run (which previously cut `logs/test.log` to ~9 lines). UJM's name-based signature (`attachLogFile('test')`) and synchronous `detach()` are preserved. Mirrors EM's `createTee()` refactor.

- **neobrutalism pricing page now satisfies the full framework JS contract.** Same two gaps newsflash had: the flash-sale promo banner block (`#pricing-promo-banner` + badge/text/countdown/code ids, shipped `hidden`) was missing entirely, and plan names lacked the `.card-title` class the pricing JS reads for analytics. Both caught by the new theme-contract test on its first run.
- **Classy admin minimal layouts use bracket parents.** `admin/core/minimal.html` + `minimal-viewport-locked.html` hardcoded `layout: themes/classy/backend/...` instead of the `themes/[ site.theme.id ]/...` convention (the fallback's path rewrite masked it for non-classy themes). Normalized to brackets; now enforced by the theme-contract test.
- **newsflash nav + dropdown hover text is readable again.** The hover fill (ink pill) left the label ink-on-ink: the shared nav/account includes put Bootstrap's `.text-body` utility (`!important`) on every link and dropdown item, which beat the theme's hover `color`. The hover/active colors now carry `!important`, and dropdown-item child spans with text utilities flip to `inherit` on hover (fixes the blacked-out account-dropdown rows too).
- **newsflash dropdown item pills no longer press edge-to-edge against the panel.** Bootstrap's re-emitted `.dropdown-menu` rule (`--bs-dropdown-padding-x: 0`) was stripping the theme's panel inset on pages with page CSS — the highlighted pill touched the panel edges. The theme's dropdown rule now uses the doubled selector (`.dropdown-menu.dropdown-menu`), the established page-bundle-gotcha pattern.
- **newsflash headings no longer go thin on pages with page CSS.** Bootstrap's re-emitted `.display-*` / `.lead` rules (stock weights 300) were clobbering the theme's main-bundle typography on every page that ships a page bundle (post + about read spindly; contact — no page bundle — looked right). Type metrics now ship as Bootstrap variables in the config `@forward with (...)` block (`$display-font-weight: 550`, `$display-line-height: 1.04`, `$lead-font-weight: 400`, `$headings-line-height: 1.1`, `$line-height-base: 1.55`) so every Bootstrap copy compiles them natively. Documented as an extension of the page-bundle gotcha in [docs/themes.md](docs/themes.md).
- **newsflash post hero image fills its frame.** Two stacked causes: `uj_post` image-tags render as `<picture><img>`, so the img's percentage height resolved against the auto-height picture wrapper (the base `.art-frame` now makes `picture` fill the frame), and the framework's generic `.blog-post-image { max-height: 480px }` capped the image inside the 21/10 frame (the article-hero rule now lifts it with `max-height: none`).
- **Footer brand description no longer disappears when its data value liquifies to empty.** Both classy's and newsflash's footers resolve the brand blurb via `data.logo.description | default: site.brand.description`, but `default:` only sees the RAW string — a footer.json value like `'{{ site.meta.description }}'` with no `meta.description` set passed the default check and then liquified to nothing, hiding the description even when `brand.description` was set. The footers now re-check after liquification and fall back to `site.brand.description`.
- **newsflash dark mode no longer stomps consumer brand colors.** The dark-mode `--bs-primary`/`--bs-link-color` remaps were hardcoded to the brightened vermilion, so a consumer's `$primary` override (via `main.scss` `with (...)`) held in light mode but snapped back to vermilion in dark. The remap now derives from the compile-time `$primary` (stock vermilion keeps its hand-tuned brightening; other brand colors get a generic white-mix lift). Documented as a theme-authoring gotcha in [docs/themes.md](docs/themes.md#derive-dark-mode-brand-remaps-from-primary-gotcha).
- **newsflash pricing page now satisfies the full framework JS contract.** Added the flash-sale promo banner (`#pricing-promo-banner` + badge/text/countdown/code ids, shipped `hidden` — the framework pricing JS reveals it, fills the rotating sale name + countdown, and offsets the masthead) and the `.card-title` class on plan names (read for add-to-cart analytics). The pricing JS contract — billing radios, `.amount`/`.billing-info`/`.price-per-unit` data attributes, `button[data-plan-id]`, plan-name selector, promo banner ids — is now documented as a required cross-theme contract in [docs/themes.md](docs/themes.md#the-pricing-page-has-a-js-contract-too).
- **`npx mgr test <target>` now correctly scopes by source.** The positional test target was previously ignored — every run executed all suites regardless of the argument. It now selects which test FILES run: `project:` runs project tests only, `mgr:` / `ujm:` / `framework:` run framework tests only (`mgr:` is the universal cross-framework alias, equivalent to the UJM-specific `ujm:` / `framework:`), and a bare path (no prefix) matches both sources. The `--filter=<substring>` flag stays orthogonal — it matches test NAMES within the already-selected files and composes with the target. See [docs/test-framework.md](docs/test-framework.md#filtering-tests).

---
## [1.7.2] - 2026-06-09

### Added

- **Push notification subscribe on payment confirmation CTA click** — hooks `subscribe()` onto CTA button clicks on the payment confirmation page. Requires a user gesture for the browser permission prompt, so uses `{ once: true }` click listeners.

### Fixed

- **FormManager spinner layout in icon-only buttons** — `_showSpinner()` no longer adds `me-2` margin when `submittingText` is empty. Previously, the unnecessary right margin squished the spinner off-center in small round buttons (e.g. chat send).

---
## [1.7.1] - 2026-06-09

### Added

- **Auto-subscribe push notifications on authenticated page load** — calls `webManager.notifications().subscribe()` in the core auth listener after the consent guard passes. Fires for both fresh signups and returning sign-ins. Failure logs a warning and never blocks navigation.

---
## [1.7.0] - 2026-06-09

### Added

- **Animation Studio admin page** (`/admin/studio`). New default admin page for creating screen-recording-ready product demo animation clips. Framework provides all boilerplate: sidebar, FormManager controls, resolution picker (540p–4K), aspect ratio toggle (16:9/9:16), playback loop with speed/pause controls, and 60fps tab recording via `getDisplayMedia` + `CropTarget`.
- **Clip builder helpers** — `flowClip`, `cardClip`, `chatClip` passed alongside `animate`/`el` to clip `build()` functions. Consumers declare data, not structure.
- **Studio CSS partial** (`_studio.scss`) — importable via `@use 'studio'` in consumer page CSS. Includes boilerplate layout + generic animation primitives (`.s-hidden`, `.s-step-bg`, `.s-bar-fill`).
- **`docs/animation-studio.md`** — full reference for the clip contract, helpers, recording, resolution, aspect ratios.
- **Admin sidebar entry** for Animation Studio under new "Content" section.

---
## [1.6.9] - 2026-06-08

### Added

- **Bootstrap-first theming convention.** Added comprehensive guidance to `docs/themes.md` and the default consumer `CLAUDE.md` — themes must restyle Bootstrap classes, not create parallel design systems.
- **Dev workflow documentation.** Added explicit instructions to `CLAUDE.md` and consumer defaults to check `logs/dev.log` instead of running `npm start`/`npm test` in consumer projects.

### Fixed

- **Signup metadata failure notification timeout.** Changed dev-only notification from permanent (`timeout: 0`) to 1 second (`timeout: 1000`) so it doesn't block the screen during development.

---
## [1.6.8] - 2026-06-07

### Fixed

- **Lazy loading animation flash.** Elements with `data-lazy="@class animation-*"` were briefly visible before the IntersectionObserver fired, causing a jarring flash (visible → disappear → fade-in). Added CSS rule to hide these elements from initial paint so they smoothly animate in.

---
## [1.6.5] - 2026-06-04

### Added

- **Dynamic event fitting in month view.** Calendar cells now show as many events as physically fit instead of a hardcoded max of 3; "+N more" only appears when events genuinely overflow.
- **Local time display on calendar events.** Event pills show local time (data layer remains UTC). Editor modal shows a local date+time badge below the UTC inputs.
- **Hover states on event pills.** Brightness + box-shadow effect on hover for month, week, and day views.
- **Now line on month view.** Red progress line shows current time of day in today's cell, with dot rendered above cell borders.
- **Left tab accent on all event pills.** Consistent dark left border matches week/day view style.
- **Monthly-weekday (Nth weekday) recurrence pattern.** Calendar supports "2nd Wednesday of every month" style recurring campaigns with calendar-relative date stepping.

### Changed

- **Per-string translation caching replaces all-or-nothing page caching.** Each page's cache is now a `hash→translation` map (`es/pages/index.html.json`). Only strings whose content hash changed are sent to the API — unchanged strings are served from cache. Dramatically reduces API calls and cost on incremental builds.
- **Prompt hash mismatch now wipes page cache files** (not just meta entries) for a clean slate.
- **Translation stats now track cached vs new strings** instead of whole-page hit/miss.
- **Outside-month calendar cells** now fade only content (date number + events), keeping borders at full opacity for consistent grid lines.
- **Imagemin constants renamed** (`MAX_SOURCE_DIMENSION` → `IMAGE_MAX_DIMENSION`) and default max dimension lowered from 4096 to 2048.

### Removed

- **`RECHECK_DAYS`** — per-string content hashes make age-based invalidation unnecessary.
- **All-day row** removed from week view (no all-day event concept in marketing calendar).

---
## [1.6.4] - 2026-06-03

### Fixed

- **Workflow template `{ github.secrets }` clobbered `{ github.workflows.build.schedule }`.** Renamed to flat `{ githubSecrets }` key to avoid namespace collision in the template spread.

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

- **`docs/<topic>.md` deep references** — 17 new files referenced by the v1.2.0 CLAUDE.md reorg that hadn't been committed yet: `ads.md`, `analytics.md`, `appearance.md`, `assets.md`, `audit.md`, `css.md`, `icons.md`, `images.md`, `javascript-libraries.md`, `jekyll-plugin.md`, `layouts-and-pages.md`, `lazy-loading.md`, `local-development.md`, `page-loading.md`, `directory-structure.md`, `seo.md`, `xss-prevention.md`. Restores parity with the cross-links already shipped in [CLAUDE.md](CLAUDE.md).
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
