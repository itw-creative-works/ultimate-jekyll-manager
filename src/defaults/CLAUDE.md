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
npx mgr audit       # HTML validation + spellcheck + optional Lighthouse
```

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
- `Manager.getEnvironment()` — `'development'` or `'production'`
- `Manager.isBuildMode()` / `isQuickMode()` / `isServer()` / `actLikeProduction()` — env-gated flags
- `Manager.logger(name)` — timestamped logger instance
- `Manager.require(path)` — escape hatch for UJM transitive deps (use sparingly)

<!-- Everything above this marker is owned by the framework and rewritten on every `npx mgr setup`. Add your project-specific notes below — they are preserved across setups. -->

# ========== Custom Values ==========

## Project-specific notes

Add anything specific to THIS project here. Edits below this line are preserved across `npx mgr setup` runs.
