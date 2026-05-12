# Ultimate Jekyll Manager (UJM)

> **Note for contributors and Claude:** This file is the architectural overview — identity, top-level conventions, and a map to deep references. The **meat** (per-subsystem APIs, page customization recipes, theming, behavior tables, defaults lists) lives in `docs/<topic>.md`. When extending or adding content, write it in the matching `docs/*.md` file and cross-link from here — do NOT inline it. If a topic doesn't have a doc yet, create one. Goal: keep this file under 300 lines. Long-form content that hasn't been migrated yet lives in `docs/_legacy-claude-md.md` — a holding pen for material to be split into proper `docs/<topic>.md` files over time.

## Identity

Ultimate Jekyll Manager (UJM) is a comprehensive framework for building modern Jekyll-powered static sites. Sister project to Electron Manager (EM) and Browser Extension Manager (BXM). Provides:

- One-line bootstrap per context (build / frontend / service-worker)
- Multi-stage gulp pipeline (15 tasks: defaults / distribute / webpack / sass / imagemin / jekyll / jsonToHtml / preprocess / audit / translation / minifyHtml / serve / setup / developmentRebuild)
- Default Jekyll layouts + themes (`classy` shipped; per-theme SCSS load paths)
- Frontend ES-module Manager with dynamic per-page module loading
- Service worker with Firebase Messaging + cache management
- A built-in **three-layer test framework** (build / page / boot)

**Important:** UJM is NOT a standalone project. You cannot `npm start` here directly — UJM is consumed by a Jekyll site (e.g. Chatsy) and runs inside that consumer's working directory. **DO NOT run `npm start`, `npm run build`, or any dev server commands inside the UJM repository** — they'll fail or duplicate a running consumer dev server.

The only things that ARE safe to run inside UJM itself:
- `npm install` — install UJM's own deps
- `npm run prepare` — copies `src/` → `dist/` via prepare-package
- `npm test` (aka `npx mgr test`) — runs UJM's own three-layer test suite

## Quick Start

### For Consuming Projects

1. `npm install ultimate-jekyll-manager --save-dev`
2. `npx mgr setup` — checks versions (Node / Ruby / bundler), scaffolds project, fetches Firebase auth, writes `projectScripts` into your `package.json`, deduplicates posts
3. `npm start` — dev (clean → setup → gulp serve)
4. `npm run build` — production build (`UJ_BUILD_MODE=true`)
5. `npm run deploy` — build + `npu sync --message='Deploy'`
6. `npm test` (or `npx mgr test`) — runs framework + project test suites

### For Framework Development (This Repository)

1. `npm install` — install UJM's own deps
2. `npm start` (≡ `npm run prepare:watch`) — copies `src/` → `dist/` on file change
3. Test in a consumer project: `npm install --save-dev /Users/ian/.../ultimate-jekyll-manager`
4. `npm test` — runs UJM's own 60 test suites

## Architecture

### Per-process Managers

UJM exposes three Manager entry points:

| Context | Entry | Bootstrap |
|---|---|---|
| Build-time (Node) | `require('ultimate-jekyll-manager/build')` | CJS class with static + instance methods (see `src/build.js`) |
| Frontend (browser ES module) | `import Manager from 'ultimate-jekyll-manager'` | `new Manager().initialize()` → wires webManager + loads page module |
| Service worker | `importScripts('/build.js')` then construct `Manager` | Manages cache + Firebase Messaging |

All three Managers mix in shared helpers via `attachTo(Manager)` from [src/utils/mode-helpers.js](src/utils/mode-helpers.js): `isDevelopment()`, `isProduction()`, `isTesting()`, `getVersion()`. See [docs/cross-context-helpers.md](docs/cross-context-helpers.md).

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

Jekyll's Liquid `{{ }}` is processed by Jekyll itself, NOT by node-powertools — those placeholders pass through node-powertools untouched. See [docs/templating.md](docs/templating.md) (planned).

### Frontend Manager (`src/index.js`)

ES module class. Constructor stores `this.webManager`. `initialize()`:

1. Calls `webManager.initialize(window.Configuration)`
2. Reads `document.documentElement.dataset.pagePath` + `.assetPath`
3. Loads (in parallel) `__main_assets__/js/ultimate-jekyll-manager.js` + page-specific modules from both `__main_assets__/js/pages/<path>/index.js` (UJM defaults) AND `__project_assets__/js/pages/<path>/index.js` (consumer overrides)
4. Sequentially executes loaded modules (stops on first error)

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
| `blogify` | generate test blog posts from Unsplash |
| `cloudflare-purge` | purge Cloudflare cache |
| `test` | run framework + project test suites (three layers) |

Note: `-t` short alias belongs to `translation`. The `test` command uses `--test` flag + `test` positional only. See [docs/cli.md](docs/cli.md) (planned).

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

## Doc-update parity

Whenever you make a behavioral change (new command, new flag, new pattern, removed feature), update:

1. **`README.md`** — user-facing summary
2. **`CLAUDE.md`** (this file) — architecture overview, one paragraph or cross-link
3. **`docs/<topic>.md`** — the meat. If a topic doesn't have a doc yet, create one.
4. **`CHANGELOG.md`** — if the project keeps one

Don't ship behavioral changes with stale docs. Validate first, then document — write docs that describe shipped reality, not intentions.

## Documentation

Deep references live in `docs/`. Treat docs as a first-class deliverable.

- [docs/test-framework.md](docs/test-framework.md) — three-layer test harness reference (build / page / boot)
- [docs/test-boot-layer.md](docs/test-boot-layer.md) — boot layer deep-dive (_site/ discovery, HTTP server, fixture vs consumer)
- [docs/cross-context-helpers.md](docs/cross-context-helpers.md) — `isTesting`/`isDevelopment`/`isProduction`/`getVersion`
- [docs/_legacy-claude-md.md](docs/_legacy-claude-md.md) — holding pen for content not yet split into proper subsystem docs. Anything still in here should be migrated to the appropriate `docs/<topic>.md` when touched.

Planned/expected (create as needed, sourcing from `_legacy-claude-md.md`):
- `docs/build-system.md` — gulp pipeline, task graph, env-var matrix
- `docs/cli.md` — CLI command surface, env-var conventions
- `docs/templating.md` — `{ }` vs `[ ]` brackets, variable resolution
- `docs/defaults.md` — FILE_MAP routing, merge strategies, theme fallback
- `docs/webpack.md` — entry points, aliases, dev-block stripping
- `docs/sass.md` — page-specific bundles, purgecss safelist, theme load paths
- `docs/jekyll.md` — config merge chain, build.json, hooks
- `docs/audit.md` — HTML validation, spellcheck, Lighthouse
- `docs/translation.md` — AI translation pipeline, cache, ignored pages
- `docs/imagemin.md` — responsive variants, GitHub cache
- `docs/service-worker.md` — SW lifecycle, cache composition, Firebase messaging
- `docs/managers.md` — frontend Manager class, dynamic page module loading
- `docs/config-schema.md` — `_config.yml` fields, `ultimate-jekyll-manager.json` fields
- `docs/setup.md` — what `npx mgr setup` does (7+ phases)
- `docs/themes.md` — classy theme structure, custom themes, fallback
- `docs/components.md` — account dropdown, nav, footer JSON-driven sections
- `docs/page-customization.md` — frontmatter-driven page customization without HTML

`TODO.md` + `TODO-*.md` files at the repo root track pass-by-pass progress and decisions.
