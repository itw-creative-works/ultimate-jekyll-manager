# Environment Detection

`getEnvironment()` returns exactly ONE of three mutually-exclusive, exhaustive values:

```javascript
Manager.getEnvironment()    // 'development' | 'testing' | 'production'

Manager.isDevelopment()     // true ONLY in development
Manager.isTesting()         // true ONLY in testing
Manager.isProduction()      // true ONLY in production
```

**The Manager is the single source of truth.** `getEnvironment()` is the ONLY function that reads the raw signals (`UJ_TEST_MODE` / `window.Configuration.uj.environment` / `UJ_BUILD_MODE` / `UJ_IS_SERVER` / `NODE_ENV`). The three `is*()` checks **derive** from it live on every call — they never read raw signals themselves, so they can never disagree with `getEnvironment()`.

**One implementation, mixed into every Manager.** UJM mixes the helpers into the build-time Manager and the frontend Manager via `attachTo(Manager)` from [src/utils/mode-helpers.js](../src/utils/mode-helpers.js), available as both prototype methods (`manager.isTesting()`) and statics (`Manager.isTesting()`).

```javascript
manager.getEnvironment()    // same answer build-time and in the browser
Manager.isTesting()         // static form, for build-time scripts
```

**Resolution order:** testing wins first, then production, else development. The three checks are mutually exclusive — exactly one is true. `isDevelopment()` is **false** during testing, and `isProduction()` is a real positive check (it is NOT `!isDevelopment()`).

## Available helpers

| Helper | Returns |
|---|---|
| `getEnvironment()` | `'development' \| 'testing' \| 'production'` — the SSOT resolver; the only reader of raw signals. |
| `isDevelopment()` | `true` ONLY in development (jekyll dev server, not a production build), and NOT testing. Derives from `getEnvironment()`. |
| `isTesting()` | `true` ONLY in testing (`UJ_TEST_MODE === 'true'`). **Takes precedence** — a test run is not development. |
| `isProduction()` | `true` ONLY in production (a production-built `_site/`). A **real positive check** — NOT `!isDevelopment()`. |

## Gating side effects — use the INTENTIONAL check

Because there are three environments, never gate a side effect on a two-value assumption. State what you mean:

```javascript
// Production-only (skip real telemetry / production behavior in dev AND testing):
if (isProduction())  { /* do the real thing */ }
if (!isProduction()) { /* skip / use the safe local behavior */ }

// Local-or-test (anything that should run in BOTH dev and testing):
if (isDevelopment() || isTesting()) { /* localhost URL, observable redirect delay, dev banners */ }
```

**Avoid** `if (!isDevelopment())` or `if (env !== 'development')` to gate production behavior — those wrongly include `testing` as production and leak real side effects during test runs. This is the bug class that motivated the 3-value model.

## URL helpers

UJM does **not** own backend URL helpers. Frontend page code resolves backend URLs through the `web-manager` runtime singleton:

```javascript
webManager.getApiUrl()  // the brand's API URL — from web-manager, not UJM
```

`web-manager`'s `getApiUrl()` follows the same convention as the sister frameworks — local in development/testing, production otherwise — so the rule "call the getter, never hardcode" still applies; the implementation just lives in `web-manager`. UJM's own URL helper is build-time only: `Manager.getWorkingUrl()` returns the BrowserSync dev-server URL (or the configured project URL) for the running dev server.

## Where they live

Source: [src/utils/mode-helpers.js](../src/utils/mode-helpers.js) for `getEnvironment()` + `is*()` + `getVersion()`. The module exposes the functions plus an `attachTo(Manager)` mixin. Attached at the bottom of the build-time Manager [src/build.js](../src/build.js) and the frontend Manager [src/index.js](../src/index.js) — so build-time scripts and browser code resolve the environment identically.

## How detection works

`getEnvironment()` resolves in this precedence order:

1. **Testing** — `process.env.UJ_TEST_MODE === 'true'`, `globalThis.UJ_TEST_MODE === true`, or a build baked with `window.Configuration.uj.environment === 'testing'` (set by the harness before any consumer JS runs). A test run is a test run regardless of any other signal.
2. **Build-time signals** — `UJ_BUILD_MODE === 'true'` → production; `UJ_IS_SERVER === 'true'` → production; `NODE_ENV === 'development'` → development.
3. **Browser signal** — `window.Configuration.uj.environment` (`'development'` / `'production'`), baked into the page at build time.
4. **Default** — development. UJM's deployed artifacts always carry their signal (the browser has `window.Configuration.uj.environment` baked in; build-time Node always sets `UJ_BUILD_MODE`/`UJ_IS_SERVER`), so reaching here means a bare tooling / local-script context where development is correct. (Contrast BEM/EM, whose deployed *runtime* can legitimately lack a signal, so they default to **production**.)

## Adding a new helper

Write the function in [src/utils/mode-helpers.js](../src/utils/mode-helpers.js) (or a new `src/utils/<topic>-helpers.js` module), expose it from `attachTo(Manager)`, and ensure both the build-time and frontend Managers call `attachTo`. For anything environment-derived, derive from `getEnvironment()` rather than reading `process.env` / `window.Configuration` directly, so there is one source of truth and no chance of drift.

## Why this matters

**One signal, used everywhere.** The test runner sets `UJ_TEST_MODE=true`; every piece of code that calls `isTesting()` (framework or consumer) then sees `true` — no need to invent a per-module env var.

**Sub-modules check the same signal.** When framework code (a network probe, a prompt) needs to skip side effects in tests, it checks `isTesting()` — the same answer the consumer's own code gets. No drift.

**`is*()` can never disagree with `getEnvironment()`.** Because the checks derive from the single resolver instead of reading raw signals (`window.Configuration` vs `UJ_BUILD_MODE`), there is exactly one definition of "what environment is this," and a wrong-but-confident gate is structurally impossible.

## See also

- [test-framework.md](test-framework.md) — `UJ_TEST_MODE` is set automatically by the test runners; `--extended` / `TEST_EXTENDED_MODE=true` gates real external APIs.
