# ========== Default Values ==========
# Ultimate Jekyll Manager (UJM) — consumer project

## Framework

This project consumes **Ultimate Jekyll Manager** (UJM) — a comprehensive framework for building modern Jekyll-powered static sites. UJM provides one-line bootstrap per context (build / frontend / service-worker), a multi-stage gulp pipeline (defaults / distribute / webpack / sass / imagemin / jekyll / audit / translation / minifyHtml / serve), default Jekyll layouts + themes, a frontend ES-module Manager with dynamic per-page module loading, a service worker with Firebase Messaging + cache management, and a built-in three-layer test framework.

## 🚨 READ THE FRAMEWORK DOCS FIRST

**Before doing ANY work on this codebase, Claude MUST read the framework documentation — that is where the architecture, conventions, APIs, and gotchas live. Skipping these will result in solutions that conflict with framework patterns.**

**Required reading:**
- **`node_modules/ultimate-jekyll-manager/CLAUDE.md`** — top-level overview + index
- **`node_modules/ultimate-jekyll-manager/docs/`** — subsystem deep references (read the relevant ones for the task at hand)

## 🚨 READ WEB-MANAGER TOO

**UJM ships `web-manager` as a runtime singleton on every page** — it powers auth, Firebase, reactive `data-wm-bind` directives, analytics, error tracking, and utilities (`escapeHTML`, etc.). Any task that touches auth flows, Firestore reads/writes, subscription resolution, push notifications, or DOM bindings means you are working with web-manager as much as with UJM.

**Required reading:**
- **`node_modules/web-manager/CLAUDE.md`** — top-level overview + index
- **`node_modules/web-manager/docs/`** — module deep references (Auth, Bindings, Firestore, Notifications, etc.)

## Quick start

```bash
npm start           # dev: clean → setup → bundle exec gulp serve (Jekyll + BrowserSync + livereload)
npm run build       # production build (UJ_BUILD_MODE=true): clean → setup → full gulp pipeline → _site/
npm run deploy      # build → `npu sync --message='Deploy'` (publishes _site/)
npx mgr test        # run framework + project test suites (build / page / boot layers)
npx mgr test pages/home           # run a specific test by path (relative to test/, both sources)
npx mgr test project:             # run ONLY your project tests (project:custom-test for one path)
npx mgr test mgr:                 # run ONLY framework tests (ujm: / framework: are equivalent)
npx mgr test --filter=foo         # match test NAMES within the selected files (composes with target)
npx mgr test --extended           # also run tests that hit real external services (or TEST_EXTENDED_MODE=true; off by default)
# (output is teed to logs/ — dev.log on `npm start`, build.log on `npm run build`, test.log on `npx mgr test`; cat instead of scrolling scrollback)
npx mgr audit       # HTML validation + spellcheck + optional Lighthouse
npx mgr install dev  # use LOCAL ultimate-jekyll-manager source (to test framework edits)
npx mgr install live # restore the published ultimate-jekyll-manager from npm
```

> Editing the UJM framework source while working here? Run `npx mgr install dev` so this project picks up your uncommitted framework changes (it otherwise uses its installed `node_modules/ultimate-jekyll-manager`). Run `npx mgr install live` to switch back.

## 🚨 BOOTSTRAP-FIRST — NEVER reinvent the wheel

**UJM is built on Bootstrap 5.** Every page MUST use Bootstrap classes for layout, spacing, typography, buttons, cards, grid, flex, and all standard components. Custom CSS exists ONLY to override how Bootstrap classes LOOK (via theme SCSS), NOT to replace them with parallel classes.

- **DO:** Use `.btn .btn-primary`, `.container`, `.row`, `.col-*`, `.d-flex`, `.gap-*`, `.py-5`, `.text-center`, `.card`, `.lead`, `.shadow`, `.rounded-*`, etc.
- **DO NOT:** Create custom `.my-btn`, `.my-wrap`, `.my-section` classes when Bootstrap already has equivalents. Don't write `padding`, `display: flex`, `gap`, `margin`, `text-align`, `font-weight` in custom CSS when a Bootstrap utility does the same thing.
- **Theme SCSS overrides appearance:** `.btn { border-radius: 50px; box-shadow: ... }` changes ALL buttons site-wide. You don't need `.lm-btn` — just restyle `.btn`.
- **Custom CSS is for genuinely novel components only:** animated hero illustrations, grain overlays, marquee strips — things with no Bootstrap equivalent.

See `node_modules/ultimate-jekyll-manager/docs/themes.md` for the full "Bootstrap-first" convention.

## 🚨 Development workflow — MUST follow

- **🚫 NEVER run `npm start`** — the user runs the dev server; running it again kills theirs. Assume it's already running; if it isn't, instruct the user to run it rather than running it yourself. Running `npx mgr test` is fine.
- **✅ ALWAYS check `logs/dev.log`** after editing source files (SCSS, JS, HTML, config) to confirm the build succeeded. The dev server's gulp watcher recompiles on file change — check the log for errors.
  - Success: `Reloading Browsers...`
  - Failure: `'sass' errored`, `'webpack' errored`, `'build-error'`, `'jekyll' errored`
- If editing multiple files in a batch, check the log once after the last edit. Wait a few seconds for the watcher to recompile before reading the log.
- **If the log shows an error, fix it immediately.** A change that breaks the build is not a completed change.

## Where things live

- `src/_config.yml` — Jekyll config: brand, theme, meta, web_manager (Firebase). `Manager.getConfig('project')` reads this. **`brand.id` + `theme.id` are required.**
- `config/ultimate-jekyll-manager.json` — UJM-specific config (JSON5): purgecss safelist, webpack target, imagemin options, distribute glob patterns. `Manager.getUJMConfig()` reads this.
- `src/pages/<name>.html` — your custom pages. May contain frontmatter only (and use a UJM `blueprint/*` layout) to customize a default page without writing HTML.
- `src/_layouts/`, `src/_includes/` — custom layouts / includes that override UJM's defaults.
- `src/assets/css/main.scss` — shared SCSS. Theme load paths resolve via `__theme__` webpack alias.
- `src/assets/css/pages/<page>/index.scss` — page-specific styles (compile to `dist/assets/css/pages/<page>/...bundle.css`).
- `src/assets/js/main.js` — main JS entry.
- `src/assets/js/pages/<page>/index.js` — page-specific JS. UJM's frontend Manager loads these dynamically based on `data-page-path`.
- `src/_includes/frontend/sections/{nav,footer}.json` — JSON-driven nav/footer config. UJM renders these into HTML at build time.
- `hooks/build/{pre,post}.js`, `hooks/middleware/request.js` — optional lifecycle hooks.
- `_site/` — Jekyll output (the deployable site). Not committed.
- `dist/` — intermediate compile output (webpack bundles, sass, processed images) before Jekyll merges them into `_site/`.
- `test/**/*.js` — your project test suites (framework auto-runs them alongside its own).

## Animation Studio

UJM ships a default Animation Studio admin page at `/admin/studio` for creating screen-recording-ready product demo clips. The framework provides all boilerplate (sidebar, controls, canvas, clip runner engine). Consumer projects only supply clip definitions and clip-specific CSS:

- **Clips:** Set `window.STUDIO_CLIPS` in `src/assets/js/pages/admin/studio/index.js` — each clip has a `label`, `duration`, and `build($canvas, helpers)` function. Helpers include `animate`, `el`, and reusable builders: `flowClip`, `cardClip`, `chatClip`.
- **Clip CSS:** Put animation primitives in `src/assets/css/pages/admin/studio/index.scss` (must include `@use 'studio'` to pull in boilerplate)
- **No page file needed** — the framework default provides the page

See `node_modules/ultimate-jekyll-manager/docs/animation-studio.md` for the full reference (clip contract, helpers, aspect ratios, playback controls).

## Per-context imports

```js
// Frontend (browser ES module) — every consumer page gets one
import Manager from 'ultimate-jekyll-manager';
new Manager().initialize();

// Service worker — at the top of src/service-worker.js
importScripts('/build.js');   // exposes UJ_BUILD_JSON
// ...then construct your service-worker Manager

// Build-time / gulp / commands
const Manager = require('ultimate-jekyll-manager/build');
```

## Available APIs at runtime

After `new Manager().initialize()`, the frontend Manager exposes:
- `manager.webManager` — Web Manager singleton (Firebase, auth, analytics, reactive `data-wm-bind` directives)
- `manager.isDevelopment()` / `isProduction()` / `isTesting()` / `getVersion()` — cross-context helpers

At build time, `require('ultimate-jekyll-manager/build')` exposes:
- `Manager.getConfig(type)` — read `_config.yml` (`'project'` or `'main'`)
- `Manager.getPackage(type)` — read `package.json` (`'project'` or `'main'`)
- `Manager.getUJMConfig()` — read `config/ultimate-jekyll-manager.json`
- `Manager.getEnvironment()` — `'development' | 'testing' | 'production'` (mutually exclusive; testing wins). Gate side effects on the intentional check (`isProduction()` for prod-only; `isDevelopment() || isTesting()` for local-or-test) — never `!isDevelopment()`.
- `Manager.isBuildMode()` / `isQuickMode()` / `isServer()` / `actLikeProduction()` — env-gated flags
- `Manager.logger(name)` — timestamped logger instance
- `Manager.require(path)` — escape hatch for UJM transitive deps (use sparingly)

## Dependency resolution

- **Do NOT install framework dependencies directly** (`firebase`, `web-manager`, etc.). UJM's webpack config resolves them through the framework's own `node_modules/`. If something doesn't resolve, the issue is in UJM's webpack config — not your `package.json`.
- **web-manager owns Firebase.** Never `import firebase from 'firebase/app'`. Use `import webManager from 'web-manager'` → `webManager.auth()`, `webManager.firestore()`.
- **`Manager.require(name)`** resolves from UJM's module context at runtime for unbundled code (gulp tasks, test fixtures).

## Testing

Every feature ships with tests at every layer it has a surface in: **logic** (`test/build/`, or `test/page/` for frontend module logic), **UI** (`test/page/` — real events on the real DOM), and **end-to-end** (`test/boot/`). Skip a layer only when the feature genuinely has no surface there — "the logic test covers it" does not excuse the UI test. See `test/README.md` and `node_modules/ultimate-jekyll-manager/docs/test-framework.md`.

<!-- Everything above this marker is owned by the framework and rewritten on every `npx mgr setup`. Add your project-specific notes below — they are preserved across setups. -->

# ========== Custom Values ==========

## Project-specific notes

Add anything specific to THIS project here. Edits below this line are preserved across `npx mgr setup` runs.
