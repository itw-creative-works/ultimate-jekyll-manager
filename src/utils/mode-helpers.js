// Runtime mode helpers (BEM/EM/BXM-pattern), shared across UJM's Managers
// (build-time `src/build.js`, frontend ES module `src/index.js`, service worker
// `src/service-worker.js`).
//
// Three orthogonal concepts:
//   isDevelopment() — true when running in dev mode (jekyll dev server, not a
//                     production build). Detected via NODE_ENV / UJ_BUILD_MODE /
//                     site config.
//   isProduction()  — inverse. Running a production-built `_site/`.
//   isTesting()     — true when UJM's test framework is running this process. Set
//                     by UJM's test runners (UJ_TEST_MODE=true) and consumer test
//                     setups that want the same signal.
//
// Use these whenever behavior should differ by *what kind of process* you're in —
// shorter timeouts in tests, prompts suppressed in tests, dev-only banners.
// Don't use them for "should we hit dev or prod backends" — that's a config
// concern; use `getEnvironment()` for that (in build.js).
//
// Context caveat: in build-time Node (gulp / CLI), `window` is undefined. We
// detect via `typeof window` so the same code works in every context. In test
// mode the browser-side check is short-circuited via UJ_TEST_MODE / global so
// `isTesting()` returns a stable value regardless of which test layer is running.

function isDevelopment() {
  // Build-time Node fallback.
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.UJ_BUILD_MODE === 'true') return false;
    if (process.env.NODE_ENV === 'development') return true;
    if (process.env.UJ_IS_SERVER === 'true') return false;
  }
  // Browser-side: look at window.Configuration if present.
  if (typeof window !== 'undefined' && window.Configuration && window.Configuration.uj) {
    if (window.Configuration.uj.environment === 'development') return true;
    if (window.Configuration.uj.environment === 'production') return false;
  }
  return false;
}

function isProduction() {
  return !this.isDevelopment();
}

function isTesting() {
  // Canonical signal — set by UJM's test runners and consumer test setups alike.
  // Works in Node (process.env) AND in browser contexts (the harness preload sets
  // globalThis.UJ_TEST_MODE before any consumer code runs).
  if (typeof process !== 'undefined' && process.env && process.env.UJ_TEST_MODE === 'true') return true;
  if (typeof globalThis !== 'undefined' && globalThis.UJ_TEST_MODE === true) return true;
  return false;
}

// `getVersion()` — returns UJM's own version string.
//   1. `<cwd>/package.json#version` for build-time scripts.
//   2. null when nothing resolves (e.g. shipped browser bundle with no package.json).
function getVersion() {
  try {
    const path = require('path');
    const pkg = require(path.join(process.cwd(), 'package.json'));
    return pkg.version || null;
  } catch (_) {
    return null;
  }
}

// Mix the helpers into a Manager constructor's prototype + the constructor itself
// (so `Manager.isTesting()` works statically too, matching BEM/EM/BXM pattern).
function attachTo(Manager) {
  Manager.prototype.isDevelopment = isDevelopment;
  Manager.prototype.isProduction  = isProduction;
  Manager.prototype.isTesting     = isTesting;
  Manager.prototype.getVersion    = getVersion;
  Manager.isDevelopment = isDevelopment;
  Manager.isProduction  = isProduction;
  Manager.isTesting     = isTesting;
  Manager.getVersion    = getVersion;
}

module.exports = {
  attachTo,
  isDevelopment,
  isProduction,
  isTesting,
  getVersion,
};
