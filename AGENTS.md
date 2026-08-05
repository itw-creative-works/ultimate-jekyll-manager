# Ultimate Jekyll Manager (UJM)

> **Note for contributors and Claude:** This file is the architectural overview — identity, top-level conventions, and a map to deep references. The **meat** (per-subsystem APIs, page customization recipes, theming, behavior tables, defaults lists) lives in `docs/<topic>.md`. When extending or adding content, write it in the matching `docs/*.md` file and cross-link from here — do NOT inline it. If a topic doesn't have a doc yet, create one. Goal: keep this file under 250 lines.

> **Mirrored structure:** BEM, UJM, BXM, and EM CLAUDE.md files mirror each other — shared sections (Supply-Chain Security, Development Workflow, File Conventions, etc.) appear in the **same order at the same position** across all four. When adding a section that applies to multiple frameworks, insert it in the same spot in all of them.

## Identity

Ultimate Jekyll Manager (UJM) is a comprehensive framework for building modern Jekyll-powered static sites. Sister project to Electron Manager (EM) and Browser Extension Manager (BXM). Provides:

- One-line bootstrap per context (build / frontend / service-worker)
- Multi-stage gulp pipeline (15 tasks: defaults / distribute / webpack / sass / imagemin / jekyll / jsonToHtml / preprocess / audit / translation / minifyHtml / serve / setup / developmentRebuild)
- Default Jekyll layouts + themes (`classy` + `neobrutalism` + `newsflash` shipped; new themes inherit classy's layouts AND nav/footer chrome via the build-time fallback — restyle chrome via theme CSS, fork an include only on real structural divergence — ship **genre-native frontmatter defaults**, and must validate **both appearance modes**; conventions are enforced by the build-layer **theme-contract test** — see [docs/themes.md](docs/themes.md))
- Frontend ES-module Manager with dynamic per-page module loading
- Service worker with Firebase Messaging + cache management
- A built-in **three-layer test framework** (build / page / boot)

**Important:** UJM is NOT a standalone project. You cannot `npm start` here directly — UJM is consumed by a Jekyll site (e.g. Chatsy) and runs inside that consumer's working directory. **DO NOT run `npm start`, `npm run build`, or any dev server commands inside the UJM repository** — they'll fail or duplicate a running consumer dev server.

The only things that ARE safe to run inside UJM itself:
- `npm install` — install UJM's own deps
- `npm run prepare` — copies `src/` → `dist/` via prepare-package
- `npm test` (aka `npx mgr test`) — runs UJM's own three-layer test suite

## Recommended skills

- **`omega:ujm`** — router skill. Auto-loads on UJM-specific keywords (`_config.yml`, `theme.id`, `uj_icon`, `page.resolved`, `npx mgr setup`, etc.) and points back to this CLAUDE.md + `docs/` (the SSOT), carrying only Claude-workflow hard rules and process checklists.
- **`js:patterns`** — JavaScript/Node.js conventions: file structure, JSDoc, defensive coding (`?.` usage), template literals, `package.json` conventions. Auto-loads when creating new `.js` files or touching JS module structure.

## 🚨 READ WEB-MANAGER TOO

**UJM ships `web-manager` as a runtime singleton on every page** — it powers auth, Firebase, reactive `data-wm-bind` directives, analytics, error tracking, and utilities (`escapeHTML`, etc.). Any task that touches auth flows, Firestore reads/writes, subscription resolution, push notifications, or DOM bindings means you are working with web-manager as much as with UJM.

**Required reading:**
- **`node_modules/web-manager/CLAUDE.md`** — top-level overview + index
- **`node_modules/web-manager/docs/`** — module deep references (Auth, Bindings, Firestore, Notifications, etc.)

## Quick Start

### For Consuming Projects

1. `npm install ultimate-jekyll-manager --save-dev`
2. `npx mgr setup` — checks versions (Node / Ruby / bundler), scaffolds project, fetches Firebase auth, writes `projectScripts` into your `package.json`, deduplicates posts
3. `npm start` — dev (clean → setup → gulp serve)
4. `npm run build` — production build (`UJ_BUILD_MODE=true`)
5. `npm run deploy` — build + `npu sync --message='Deploy'`
6. `npm test` (or `npx mgr test`) — runs framework + project test suites
   - `npx mgr test pages/home` — run a specific test by path (relative to `test/`, matches both sources)
   - `npx mgr test project:` — run ONLY consumer project tests (`project:custom-test` to match a path)
   - `npx mgr test mgr:` — run ONLY framework tests (`ujm:` / `framework:` are equivalent UJM aliases)
   - `npx mgr test ujm:pages/home` — run only framework tests matching a path
   - The `--filter=<substring>` flag matches test NAMES within the selected files (composes with the target); `--layer=build|page|boot` narrows to one layer
   - Output is teed (ANSI-stripped) to `<projectRoot>/logs/test.log`, truncated fresh each run (skipped on CI) — `cat logs/test.log` instead of scrolling scrollback
   - `--extended` (or `TEST_EXTENDED_MODE=true`) opts in tests that hit real external services — off by default, unprefixed name shared across BEM/BXM/UJM/EM, propagates to spawned envs (Jekyll/boot server); see [docs/test-framework.md](docs/test-framework.md#extended-mode-test_extended_mode)

### For Framework Development (This Repository)

> **🚫 NEVER use `npx mgr ...` from the framework repo.** `npx mgr` is for CONSUMER projects only (where the bin is linked in `node_modules/.bin/`). From the framework repo, use `npm test`, `npm start`, etc. — the `scripts` in `package.json` call the local `bin/` directly. This applies to ALL four OMEGA frameworks (BEM/UJM/BXM/EM).

1. `npm install` — install UJM's own deps
2. `npm start` (≡ `npm run prepare:watch`) — copies `src/` → `dist/` on file change
3. Test in the **designated test consumer** — `../ultimate-jekyll-website` is UJM's consumer for validating framework changes end-to-end (exercise any consumer-level flow there freely: builds, tests, runtime). From inside it, run `npx mgr install dev` to swap UJM to this local repo — required whenever you edit the framework source and want the consumer to pick up the changes (the consumer otherwise keeps its installed `node_modules/ultimate-jekyll-manager`). Reverse with `npx mgr install live`.
4. `npm test` — runs UJM's own 60 test suites

## Architecture

### Per-process Managers

UJM exposes three Manager entry points:

| Context | Entry | Bootstrap |
|---|---|---|
| Build-time (Node) | `require('ultimate-jekyll-manager/build')` | CJS class with static + instance methods (see `src/build.js`) |
| Frontend (browser ES module) | `import Manager from 'ultimate-jekyll-manager'` | `new Manager().initialize()` → wires webManager + loads page module |
| Service worker | `importScripts('/build.js')` then construct `Manager` | Manages cache + Firebase Messaging |

All three Managers mix in shared helpers via `attachTo(Manager)` from [src/utils/mode-helpers.js](src/utils/mode-helpers.js): `isDevelopment()`, `isProduction()`, `isTesting()`, `getVersion()`. `getEnvironment()` returns `'development' | 'testing' | 'production'` (mutually exclusive — testing wins over dev); gate side effects on the INTENTIONAL check (`isProduction()` for prod-only, `isDevelopment() || isTesting()` for local-or-test) — never `!isDevelopment()`. See [docs/environment-detection.md](docs/environment-detection.md).

### Gulp pipeline

15 tasks orchestrated in `src/gulp/main.js`. Build sequence:

```
defaults → distribute → parallel(webpack, sass, imagemin) → jsonToHtml → jekyll → audit → translation → minifyHtml
```

Dev sequence: `serve → build → developmentRebuild`. Pure helpers exposed under `src/gulp/tasks/utils/` (`merge-jekyll-configs`, `_validate-yaml`, `template-transform`, `collectTextNodes`, `dictionary`, `github-cache`, `formatDocument`) — these are the highest-value test targets. See [docs/build-system.md](docs/build-system.md) for the full pipeline reference.

### Config flow

Three config files in the consumer project:

1. **`src/_config.yml`** — Jekyll config (brand, theme, meta, web_manager). Read by `Manager.getConfig('project')`.
2. **`config/ultimate-jekyll-manager.json`** — UJM-specific config (purgecss safelist, webpack target, imagemin opts, distribute glob patterns). JSON5 format. Read by `Manager.getUJMConfig()`.
3. **`package.json`** — read by `Manager.getPackage('project')`.

UJM ships defaults via `_config_default.yml` + `_config_development.yml` at `src/config/` — merged in at Jekyll build time via the `--config` chain. The merged collections + defaults are produced by [src/gulp/tasks/utils/merge-jekyll-configs.js](src/gulp/tasks/utils/merge-jekyll-configs.js). See [docs/config-schema.md](docs/config-schema.md) (planned).

### Templating

UJM uses node-powertools' `template()` with two bracket conventions:

- `{ x }` (default) — used wherever `template()` is called without `brackets:` (e.g. defaults.js Gemfile templating)
- `[ x ]` — used by distribute.js theme fallback and [template-transform.js](src/gulp/tasks/utils/template-transform.js) (for `.html/.md/.liquid/.json`)

Jekyll's Liquid `{{ }}` is processed by Jekyll itself, NOT by node-powertools — those placeholders pass through node-powertools untouched. See [docs/templating.md](docs/templating.md).

### Frontend Manager (`src/index.js`)

ES module class. Constructor stores `this.webManager`. `initialize()`:

1. Calls `webManager.initialize(window.Configuration)`
2. Reads `document.documentElement.dataset.pagePath` + `.assetPath`
3. Loads (in parallel) `__main_assets__/js/ultimate-jekyll-manager.js` + page-specific modules from three layers: `__main_assets__/js/pages/<path>/index.js` (UJM default), `__theme__/pages/<path>/index.js` (active theme), and `__project_assets__/js/pages/<path>/index.js` (consumer). Missing at any layer is a no-op. See [docs/themes.md](docs/themes.md#5-page-specific-js-theme-aware-additive--mirrors-page-css).
4. Sequentially executes loaded modules in order **main → theme → project** (stops on first error)

Webpack aliases:
- `__main_assets__` → UJM's `dist/assets/`
- `__project_assets__` → consumer's `src/assets/`
- `__theme__` → project's theme (if exists) else UJM's theme

See [docs/managers.md](docs/managers.md) (planned) and [docs/webpack.md](docs/webpack.md) (planned).

### Service Worker

Ships at `_site/service-worker.js`. Imports Firebase Messaging at the top level via `importScripts`. Lifecycle:

- `install` → `skipWaiting()`
- `activate` → `clients.claim()`
- `notificationclick` (registered BEFORE Firebase imports to avoid override)
- `message` → handles `command: 'update-cache'`

Cache name is `${brand.id}-${cache_breaker}` from `UJ_BUILD_JSON.config`. See [docs/service-worker.md](docs/service-worker.md) (planned).

### Test framework

`npx mgr test` runs three layers:

- **build** — plain Node (~ms): Manager API, CLI aliases, gulp pure helpers, mode-helpers, templating, logger
- **page** — headless Chromium tab via Puppeteer: harness HTML, frontend Manager surface, DOM assertions
- **boot** — headless Chromium pointed at the consumer's built `_site/` via a tiny embedded HTTP server (no `file://` — service workers need a real origin)

Same `{ layer, description, run(ctx) }` contract as EM/BXM. JSON-line reporter protocol uses `__UJM_TEST__` marker. See [docs/test-framework.md](docs/test-framework.md) + [docs/test-boot-layer.md](docs/test-boot-layer.md).

### Test coverage

Every feature ships with tests at EVERY layer it has a surface in — logic (`build`, or `page` for frontend module logic), UI (`page` — real events on the real DOM), and end-to-end (`boot`). Skip a layer ONLY when the feature genuinely has no surface there (a pure build utility has no UI; a CSS-only tweak has no logic). "The logic test already covers it" is NOT a reason to skip the UI test — logic tests prove the logic, UI tests prove the wiring, boot tests prove the built site. See [docs/test-framework.md](docs/test-framework.md).

## CLI

`npx mgr <command>` (aliases `uj`, `ujm`, `ultimate-jekyll`):

| Command | Description |
|---|---|
| `setup` | scaffold consumer, check versions, ensure peer deps, write projectScripts, fetch Firebase auth |
| `clean` | remove `dist/`, `_site/`, `.temp/`, `.cache/` |
| `install` | swap UJM between `npm@latest` and local `file:` link |
| `version` | print version |
| `deploy` | build + `npu sync` |
| `audit` | HTML validation + spellcheck + (optional) Lighthouse |
| `translation` | AI-translate `_site/` pages |
| `imagemin` | optimize images with responsive variants |
| `minify-html` | minify HTML (preserves JSON-LD + inline scripts + IE conditional comments) |
| `optimize` | AI-optimize pages via OpenAI |
| `migrate` | migrate consumer project layout (legacy → current) |
| `blogify` | generate test blog posts from Unsplash (`--count=<n>`, default 12) |
| `cloudflare-purge` | purge Cloudflare cache |
| `test` | run framework + project test suites (three layers) |

Note: `-t` short alias belongs to `translation`. The `test` command uses `--test` flag + `test` positional only. See [docs/cli.md](docs/cli.md) (planned).

## Dependency Resolution

- **Consumer code can `import`/`require()` any UJM dependency** — webpack's `resolve.modules` includes the framework's own `node_modules/`. Consumer projects do NOT need to `npm install firebase`, `web-manager`, or any other UJM transitive dep. If a dep doesn't resolve, the fix is in UJM's webpack config — not the consumer's `package.json`.
- **web-manager owns Firebase.** Consumer code NEVER imports Firebase directly (`import firebase from 'firebase/app'`). Use `import webManager from 'web-manager'` → `webManager.auth()`, `webManager.firestore()`. Same rule in EM and BXM.
- **`Manager.require(name)`** resolves from UJM's module context at runtime (static + prototype). Use in gulp tasks or unbundled code (e.g. test fixtures). Webpack `resolve.modules` handles the bundled case.

## Development Workflow

- **🚫 NEVER use `npx mgr ...` from the framework repo** — `npx mgr` is for CONSUMER projects only (where the bin lives in `node_modules/.bin/`). From the framework repo, use `npm test`, `npm start`, etc. — the `scripts` in `package.json` call `node bin/ultimate-jekyll-manager` directly. This applies to ALL four OMEGA frameworks (BEM/UJM/BXM/EM).
- **🚫 NEVER run `npm start` in a consumer project** — the user runs the dev server; running it again kills theirs. Assume it's already running; if it isn't, **instruct the user to run it** rather than running it yourself. Instead, **check `logs/dev.log`** after editing files to confirm the watcher recompiled successfully (`Reloading Browsers...` = success; `errored` = fix the error) — never tail/attach to the process. If editing multiple files, check the log once after the last edit. A change that breaks the build is not a completed change. Running `npx mgr test` is fine.
- **Live-test UI changes via CDP.** After code changes compile, use the `chrome-devtools` MCP tools (screenshots, click, evaluate JS, console logs) to verify the change works in the running browser — your session auto-launches its own private Chrome on the first tool call (no setup, no ports). This is the primary way to confirm UI changes — type-checking and test suites verify code correctness, not feature correctness. The dev server URL is **`https://localhost:4000`** (port from the consumer's `.temp/_config_browsersync.yml` when multiple sites run) — **NEVER the LAN IP** (`https://192.168.x.x:...`). See [docs/cdp-debugging.md](docs/cdp-debugging.md) + `~/.claude/mcp-server/servers/chrome-devtools/CLAUDE.md`.

## Supply-Chain Security

All `npm install` calls in CLI commands (`npx mgr i`, `npx mgr setup`) route through the `safeInstall()` helper (`src/lib/safe-install.js`). It prefixes `sfw` (Socket Firewall) when installed — blocking confirmed malware at the network level before packages reach disk. Falls back to plain npm if sfw isn't available. CI workflows install sfw globally and run `sfw npm install`. Installs will **fail if sfw detects confirmed malware** in any package in the dependency tree; non-critical CVEs and quality warnings pass through.

## File Conventions

- **CommonJS** in build-time / Node files (gulp tasks, commands, lib/). **ESM** in `src/index.js` (frontend Manager — webpack-bundled).
- **prepare-package** copies `src/` → `dist/` 1:1 (no transforms). Bin entry points reference `dist/cli.js`.
- **`fs-jetpack`** over `fs-extra` / raw `fs`.
- One `module.exports = ...` per file.
- Short-circuit early returns rather than nested ifs.
- Logical operators at the **start** of continuation lines.
- **No backwards compatibility** unless explicitly requested.
- **Don't add `?.` paranoia.** Framework internals (`manager.config`, `manager.webManager`) deref directly. `?.` belongs only on user-supplied config sub-fields, optional return values from regex matches, caught exceptions, and pre-init state.
- **Use `process.cwd()` (not hardcoded paths) for consumer-project resolution** in gulp tasks + commands. UJM runs inside the consumer's working directory.
- **All `<img src>` tags MUST have a cachebreaker** — append `?cb={{ site.uj.cache_breaker }}` to image `src` attributes in includes and layouts. This applies to logos, brandmarks, rating images, and any other image rendered via Liquid variables. External third-party URLs (YouTube embeds, analytics pixels, placeholder services) are exempt. `data-lazy="@src"` is handled at the JS layer, not here. See [docs/common-mistakes.md](docs/common-mistakes.md).

## Doc-update parity

Whenever you make a behavioral change (new command, new flag, new pattern, removed feature), update:

1. **`README.md`** — user-facing summary
2. **`CLAUDE.md`** (this file) — architecture overview, one paragraph or cross-link
3. **`docs/<topic>.md`** — the meat. If a topic doesn't have a doc yet, create one.
4. **`CHANGELOG.md`** — if the project keeps one

Don't ship behavioral changes with stale docs. Validate first, then document — write docs that describe shipped reality, not intentions.

**The OMEGA docs are structurally MIRRORED.** This file's section skeleton, the consumer template (`src/defaults/CLAUDE.md`), shared-concept `docs/*.md` filenames, and the `omega:*` skills are identical in structure and order across the sister frameworks (UJM / BEM / BXM / EM / MAM — WM mirrors the library subset). Never add, rename, or reorder a section here without making the SAME change in every sister repo in the same pass. The canonical skeletons + omission rules live in the `omega:main` skill's `mirror-spec.md` resource.

## Documentation

Deep references live in `docs/`. Treat docs as a first-class deliverable. **Whenever you make a behavioral change, update both this overview AND the relevant `docs/*.md` deep reference.**

### Framework reference

- [docs/test-framework.md](docs/test-framework.md) — three-layer test harness reference (build / page / boot)
- [docs/test-boot-layer.md](docs/test-boot-layer.md) — boot layer deep-dive (_site/ discovery, HTTP server, fixture vs consumer)
- [docs/environment-detection.md](docs/environment-detection.md) — `isTesting`/`isDevelopment`/`isProduction`/`getVersion`
- [docs/jekyll-plugin.md](docs/jekyll-plugin.md) — UJ Powertools gem: filters, tags, page variables (`page.resolved`, `uj_icon`, `uj_hash`, `iftruthy`, etc.)
- [docs/audit.md](docs/audit.md) — full-audit check catalog (U-xx universal / UJM-xx / F-xx IDs with severity + scope), protocol + fix loop, `npx mgr audit` automated stage
- [docs/migration.md](docs/migration.md) — full migration (old UJ → latest UJM base), `_config.yml` quick-fix schema, revert-posts procedure

### Project & dev environment

- [docs/directory-structure.md](docs/directory-structure.md) — UJM repo layout and consuming-project layout
- [docs/build-system.md](docs/build-system.md) — gulp pipeline (15 tasks), config flow, build modes, pure helpers
- [docs/templating.md](docs/templating.md) — node-powertools bracket conventions, Liquid coexistence
- [docs/local-development.md](docs/local-development.md) — browsersync URL, Firebase emulator connect, PurgeCSS safelist
- [docs/cdp-debugging.md](docs/cdp-debugging.md) — launching a controllable Chrome (CDP) at the dev server, persistent agent profile (one-time logins), driving via MCP/CDP (screenshots, clicks, network)
- [docs/logging.md](docs/logging.md) — `dev.log` / `build.log` / `test.log` tee, CI skip
- [docs/common-mistakes.md](docs/common-mistakes.md) — the canonical "don't do this" list
- [docs/assets.md](docs/assets.md) — UJM vs consumer file layout, section config (nav/footer/account), frontmatter-driven page customization, webpack aliases, page module pattern

### Pages, layouts, content

- [docs/animation-studio.md](docs/animation-studio.md) — Animation Studio admin page: clip registration via `window.STUDIO_CLIPS`, helpers (`animate`, `el`, `flowClip`, `cardClip`, `chatClip`), resolution picker, recording, aspect ratio modes
- [docs/themes.md](docs/themes.md) — theme system: selection + resolution (SCSS loadPaths, `__theme__`, classy layout fallback), shared vs per-theme layers, authoring a theme inside UJM OR in a consumer project, live validation
- [docs/layouts-and-pages.md](docs/layouts-and-pages.md) — page types, layout chain, `asset_path` frontmatter, default-page customization rules + per-page levels, dashboard list/detail/edit pattern, custom page creation
- [docs/images.md](docs/images.md) — `@post/` shortcut for blog post images, BEM admin/post image handling, imagemin pipeline + source-size constraints + `UJ_IMAGEMIN_REWRITE_SOURCES` cleanup flag
- [docs/icons.md](docs/icons.md) — Font Awesome conventions, `{% uj_icon %}` vs prerendered icons in JS, size reference, country flag SVGs (`assets/icons/flags/modern-square/`)
- [docs/seo.md](docs/seo.md) — content writing rules (headlines, sentence case, accents), Services/Solutions page strategies, Alternatives collection (competitor comparison pages), Schema/JSON-LD (`SoftwareApplication`, `FAQPage`)

### Frontend behavior

- [docs/css.md](docs/css.md) — section padding rule, theme-adaptive classes, cards in colored sections, `<html>` data attributes
- [docs/purgecss.md](docs/purgecss.md) — PurgeCSS safelist playbook: two safelist locations, RegExp anchoring, gotchas (`variables: false`, per-file processing), current UJM safelist
- [docs/appearance.md](docs/appearance.md) — dark/light/system mode switching: JS API, HTML attributes
- [docs/page-loading.md](docs/page-loading.md) — page-loading protection, `.btn-action`, layered form-protection strategy
- [docs/lazy-loading.md](docs/lazy-loading.md) — `data-lazy="@type value"` syntax and supported types
- [docs/ads.md](docs/ads.md) — Vert units: AdSense include + Promo Server fallback, size presets

### JS libraries & security

- [docs/javascript-libraries.md](docs/javascript-libraries.md) — WebManager singleton + UJM libs at `src/assets/js/libs/` (prerendered icons, authorizedFetch, usage bindings, payment-config, FormManager), reads-vs-writes rule (Firestore SDK for reads, Cloud Functions for writes)
- [docs/no-inline-scripts.md](docs/no-inline-scripts.md) — HARD RULE: no inline `<script>` bodies; full migration playbook incl. Liquid `data-*`/`<template>` bridges
- [docs/xss-prevention.md](docs/xss-prevention.md) — zero-trust DOM injection rules, `escapeHTML`, postMessage origin checks, redirect validation

### Analytics

- [docs/analytics.md](docs/analytics.md) — ITM tracking, gtag/fbq/ttq guidelines, TikTok-specific rules

`TODO.md` + `TODO-*.md` files at the repo root track pass-by-pass progress and decisions.
