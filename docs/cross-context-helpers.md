# Cross-context Helpers

`src/utils/mode-helpers.js` exposes four shared helpers mixed into every UJM Manager via `attachTo(Manager)`. Mirrors the same pattern in EM and BXM. Used when behavior should differ by *what kind of process* you're in — short-circuit network probes in tests, suppress dev-only banners in production, etc.

## API

| Method | Returns | Purpose |
|---|---|---|
| `Manager.isTesting()` | `boolean` | True when UJM's test framework is running this process. Set by `npx mgr test` (`UJ_TEST_MODE=true`) and consumer test setups that want the same signal. |
| `Manager.isDevelopment()` | `boolean` | True when running in dev mode (not a production build). Reads `UJ_BUILD_MODE` / `NODE_ENV` / `UJ_IS_SERVER` / `window.Configuration.uj.environment` depending on context. |
| `Manager.isProduction()` | `boolean` | Inverse of `isDevelopment()`. |
| `Manager.getVersion()` | `string \| null` | UJM's version from `<cwd>/package.json#version`. Null if no `package.json` (e.g. shipped browser bundle). |

All four are available both **statically** on the Manager constructor and on **`Manager.prototype`**, so these all work:

```js
const Manager = require('ultimate-jekyll-manager/build');
Manager.isTesting();                  // static
new Manager().isTesting();            // instance
```

## When to use

```js
// In a build helper that fetches Firebase auth files:
async function fetchFirebaseAuthFiles() {
  if (Manager.isTesting()) {
    return;  // short-circuit — tests provide their own stubs
  }
  // ...real fetch
}

// In a gulp task that opens the dev browser:
function maybeOpenBrowser() {
  if (Manager.isBuildMode() || Manager.isTesting()) return;
  // ...exec `open` etc.
}

// In a frontend module that logs verbose debug info:
if (manager.isDevelopment()) {
  console.log('[dev] webManager loaded with', cfg);
}
```

**Don't use these for "should I hit dev or prod backends"** — that's a config concern. Use `Manager.getEnvironment()` (returns `'development'` or `'production'` strings) for that distinction.

## How `isDevelopment` is detected

Order of checks:

1. **Build-time Node**: `process.env.UJ_BUILD_MODE === 'true'` → production. `process.env.NODE_ENV === 'development'` → development. `process.env.UJ_IS_SERVER === 'true'` → production.
2. **Browser**: `window.Configuration.uj.environment` if present (`'development'` or `'production'`).
3. Default → `false`.

## How `isTesting` is detected

Two checks (either is sufficient):

1. **Node**: `process.env.UJ_TEST_MODE === 'true'`. Set automatically by `npx mgr test`.
2. **Browser**: `globalThis.UJ_TEST_MODE === true`. Set automatically by UJM's `page`-layer harness HTML before any consumer code runs.

This means consumer code that calls `Manager.isTesting()` from a tab context gets the right answer — Node-only check would always return false in a browser.

## Adding new helpers

If you find yourself writing the same `if (process.env.UJ_FOO === 'true') ...` check more than twice, factor it into `mode-helpers.js`. Things to consider:

- Does the helper need to work in **all** contexts (Node build-time + browser page + service worker)? If yes, gate every check with `typeof process !== 'undefined'` / `typeof window !== 'undefined'` so the same code runs everywhere.
- Should it be mixed into static AND prototype? Almost always yes — the static form is for build-time CLI usage, the instance form for runtime use.
- Add a test in `src/test/suites/build/mode-helpers.test.js` that toggles the underlying env var and asserts both states.

## See also

- [test-framework.md](test-framework.md) — the test harness that sets `UJ_TEST_MODE`
- [cli.md](cli.md) — full env-var matrix
