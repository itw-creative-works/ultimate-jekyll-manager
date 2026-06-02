// Runtime mode helpers (BEM/EM/BXM-pattern), shared across UJM's Managers
// (build-time `src/build.js`, frontend ES module `src/index.js`, service worker
// `src/service-worker.js`).
//
// `getEnvironment()` is the SINGLE SOURCE OF TRUTH: it is the ONLY function that reads the
// raw signals (UJ_TEST_MODE / window.Configuration.uj.environment / UJ_BUILD_MODE /
// UJ_IS_SERVER / NODE_ENV) and resolves them to exactly ONE of three mutually-exclusive
// values. The three is*() checks DERIVE from it — they never read raw signals themselves,
// so they can never disagree with getEnvironment().
//
//   isDevelopment() — `getEnvironment() === 'development'`: running in dev mode (jekyll dev
//                     server, not a production build), and NOT testing.
//   isTesting()     — `getEnvironment() === 'testing'`: UJM's test framework is running this
//                     process (UJ_TEST_MODE=true). TAKES PRECEDENCE — a test run is not dev.
//   isProduction()  — `getEnvironment() === 'production'`: running a production-built `_site/`,
//                     and NOT testing. A real positive check — NOT `!isDevelopment()`.
//
// To gate "anything non-production" use `!isProduction()` or `isDevelopment() ||
// isTesting()` intentionally — never assume two values.
//
// Context caveat: in build-time Node (gulp / CLI), `window` is undefined. getEnvironment()
// detects via `typeof window` so the same code works in every context. Browser detection
// reads `window.Configuration.uj.environment` (baked into the page at build time).

// getEnvironment() — the SINGLE SOURCE OF TRUTH. Reads every raw signal and resolves to
// exactly ONE of 'development' | 'testing' | 'production' (mutually exclusive; testing wins).
// Precedence: testing → production → development.
function getEnvironment() {
  // 1. Testing wins — set by UJM's test runners / harness, or a testing-baked build.
  //    Works in Node (process.env), browser (globalThis set before consumer JS), and
  //    config-baked builds (window.Configuration.uj.environment === 'testing').
  if (typeof process !== 'undefined' && process.env && process.env.UJ_TEST_MODE === 'true') return 'testing';
  if (typeof globalThis !== 'undefined' && globalThis.UJ_TEST_MODE === true) return 'testing';
  if (typeof window !== 'undefined' && window.Configuration && window.Configuration.uj
    && window.Configuration.uj.environment === 'testing') return 'testing';

  // 2. Build-time Node signals (a production build or the running dev server).
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.UJ_BUILD_MODE === 'true') return 'production';
    if (process.env.UJ_IS_SERVER === 'true') return 'production';
    if (process.env.NODE_ENV === 'development') return 'development';
  }

  // 3. Browser-side: the environment baked into the page at build time.
  if (typeof window !== 'undefined' && window.Configuration && window.Configuration.uj) {
    if (window.Configuration.uj.environment === 'development') return 'development';
    if (window.Configuration.uj.environment === 'production') return 'production';
  }

  // 4. Default: development. UJM's deployed artifacts ALWAYS carry their signal — the
  //    browser has `window.Configuration.uj.environment` baked in, and build-time Node
  //    always sets UJ_BUILD_MODE / UJ_IS_SERVER. So reaching here means a bare tooling /
  //    local-script context, where development is the sensible answer. (Contrast BEM/EM,
  //    whose deployed RUNTIME can legitimately lack a signal, so they default to production.)
  return 'development';
}

// The three checks DERIVE from getEnvironment() — they never read raw signals, so they can
// never disagree with it. isDevelopment() is NOT true in testing; isProduction() is a real
// positive check (never `!isDevelopment()`).
function isDevelopment() {
  return getEnvironment() === 'development';
}

function isProduction() {
  return getEnvironment() === 'production';
}

function isTesting() {
  return getEnvironment() === 'testing';
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
// getEnvironment() is the SSOT and is attached here too — build.js no longer defines it.
function attachTo(Manager) {
  Manager.prototype.getEnvironment = getEnvironment;
  Manager.prototype.isDevelopment  = isDevelopment;
  Manager.prototype.isProduction   = isProduction;
  Manager.prototype.isTesting      = isTesting;
  Manager.prototype.getVersion     = getVersion;
  Manager.getEnvironment = getEnvironment;
  Manager.isDevelopment  = isDevelopment;
  Manager.isProduction   = isProduction;
  Manager.isTesting      = isTesting;
  Manager.getVersion     = getVersion;
}

module.exports = {
  attachTo,
  getEnvironment,
  isDevelopment,
  isProduction,
  isTesting,
  getVersion,
};
