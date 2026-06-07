# Test Framework

UJM ships a built-in three-layer test harness. `npx mgr test` discovers framework suites from `<ujm>/dist/test/suites/**/*.js` and consumer suites from `<cwd>/test/**/*.js`, partitions by `layer`, and runs each layer in the right environment. Same shape as the sister harnesses in EM (electron-manager) and BXM (browser-extension-manager).

## 🚫 NEVER mock — test against the real harness (HARD RULE)

**Do NOT hand-roll fake/stub/mock objects.** Every test runs against a real environment, and the harness hands the test the real thing — use it:

- **`build` layer** gets the **real** `Manager` from `require('ultimate-jekyll-manager/build')` — call its real API (`getConfig`, `getUJMConfig`, `getPackage`, `isTesting`, the gulp pure helpers). Never fake a `Manager` whose `getConfig()` returns canned data.
- **`page` layer** runs in a **real** headless Chromium tab with real `window`/`document` and the harness-provided `window.Configuration`. Drive the real frontend Manager surface; don't stub DOM globals in your test.
- **`boot` layer** runs against the **real** built `_site/` served over a **real** HTTP origin — exercise the actually-shipped site through Puppeteer.
- **Pure functions (zero I/O) are the ONLY thing you call directly** — e.g. `mergeJekyllConfigs`, `validateYAMLFrontMatter`, `createTemplateTransform`, `collectTextNodes`. `require()` them and pass plain inputs. That is NOT mocking — there is nothing to mock. The moment a function touches real I/O (config files, the DOM, the HTTP server, an external API), it MUST run against the real harness/build, not a stub.

If you find yourself writing `const mockX = {...}` to satisfy code under test, STOP — use the real context the layer already provides, or (if it's genuinely pure) call it with plain data.

### The ONLY two exceptions where a narrow stub is allowed

Mock **nothing** by default. There are exactly two cases where the real dependency genuinely cannot run in the test environment — and even then, stub the *smallest possible seam* (one method / one object), restore it immediately, and comment *why*:

1. **A side effect that would destroy the test run itself.** If the real call would kill or corrupt the harness — a process-exit, a destructive `_site/` wipe, a recursive re-invocation of the build/test command — stub *that one call* to a no-op, assert the surrounding logic, then restore. You are preventing the harness from terminating mid-assertion, not faking behavior.
2. **A real dependency the test environment can't provide.** When the real thing only exists from infra you can't stand up in the current layer (an external service with no local equivalent, a second running instance), a unit test may hand minimal inputs to exercise the logic in isolation — but a real-harness test (`page`/`boot`) MUST still cover the wired path where one exists.

If you can run it for real, you must. These exceptions are not a license to unit-test in isolation when a real-harness layer would work.

**External APIs are skipped in-source, NOT mocked.** UJM build/gulp code that would hit the network (e.g. fetching Firebase auth files) short-circuits in its own source when `Manager.isTesting()` is true — it returns early, it does not return canned/mocked data. See [environment-detection.md](environment-detection.md). If a suite has slower live-integration tests, gate them behind the `--integration` flag (`UJ_TEST_INTEGRATION=1`) and run the real path; anything such a test creates externally MUST be cleaned up by the test (`cleanup`/`inspect` teardown) — the runner does not clean external systems.

## Quick start

```bash
npx mgr test                   # all layers
npx mgr test --layer build     # plain Node, fast
npx mgr test --layer page      # headless Chromium tab against harness HTML
npx mgr test --layer boot      # headless Chromium against built _site/
npx mgr test --filter foo      # filter tests by name substring
npx mgr test --reporter json   # machine-readable __UJM_TEST__ events
```

`npm test` works too — added to consumer `package.json#scripts.test` on `npx mgr setup`.

### Filtering tests

Pass a path (relative to `test/`) as a positional argument to run specific tests:

```bash
# Run a single test file
npx mgr test pages/home

# Run only UJM framework tests
npx mgr test ujm:pages/home

# Run only consumer project tests
npx mgr test project:custom-test

# Combine with extended mode
TEST_EXTENDED_MODE=true npx mgr test pages/boot-test
```

The filter matches against the test file path. `ujm:` and `project:` prefixes scope the filter to framework-only or project-only tests respectively. Without a prefix, both are searched.

## Layers

| Layer | Runs in | Use for |
|---|---|---|
| `build` | Plain Node, ~ms | `Manager.getConfig/getPackage/getUJMConfig`, CLI alias resolution, gulp pure helpers (`mergeJekyllConfigs`, `validateYAMLFrontMatter`, `createTemplateTransform`, `collectTextNodes`), mode-helpers env gating, templating brackets |
| `page` | Headless Chromium tab via Puppeteer | Frontend Manager lifecycle, `window.Configuration` plumbing, DOM assertions, prerendered icons template, anything that needs real `window`/`document` |
| `boot` | Headless Chromium loading the consumer's built `_site/` via a tiny local HTTP server | End-to-end smoke: site builds + serves, pages render, service worker registers + activates + responds, no console errors |

There is no `main`/`background` layer (EM/BXM have those because they own long-running runtime processes; UJM does not).

## Writing a test

Every test file is a CommonJS module exporting one of three forms:

```js
// Standalone
module.exports = {
  layer: 'build',
  description: 'config has brand.id',
  timeout: 5000,
  run: async (ctx) => {
    const Manager = require('ultimate-jekyll-manager/build');
    const cfg = Manager.getConfig('project');
    ctx.expect(cfg.brand.id).toBeTruthy();
  },
  cleanup: async (ctx) => { /* optional */ },
};

// Suite — sequential, stops on first failure, shares `ctx.state`
module.exports = {
  type: 'suite',
  layer: 'build',
  description: 'config flow',
  tests: [
    { name: 'load',  run: async (ctx) => { ctx.state.cfg = Manager.getConfig('project'); } },
    { name: 'check', run: async (ctx) => { ctx.expect(ctx.state.cfg.brand.id).toBe('foo'); } },
  ],
};

// Group — runs ALL tests even if some fail
module.exports = {
  type: 'group',
  layer: 'build',
  tests: [ /* ... */ ],
};

// Array form → implicit group
module.exports = [
  { name: 'a', run: async (ctx) => { /* ... */ } },
  { name: 'b', run: async (ctx) => { /* ... */ } },
];
```

### The `ctx` (test context)

Every `run(ctx)` and `cleanup(ctx)` callback receives:

| Property | Description |
|---|---|
| `ctx.expect`     | Jest-compatible assertion (`toBe`, `toEqual`, `toBeTruthy`, `toContain`, `toMatch`, `toThrow`, `toBeGreaterThan`, etc. + `.not.` negation) |
| `ctx.state`      | Plain object shared across tests in a suite/group |
| `ctx.layer`      | Current layer name |
| `ctx.skip(reason)` | Throws SkipError — the runner records as skipped |

### Boot-layer test shape

Boot tests use `inspect` instead of `run`. The callback receives `{ site, page, expect, projectRoot }`:

```js
module.exports = {
  layer: 'boot',
  description: 'home renders + SW registers',
  timeout: 15000,
  inspect: async ({ site, page, expect, projectRoot }) => {
    const res = await page.goto(site.baseUrl + '/');
    expect(res.status()).toBe(200);
    expect(await page.title()).toBeTruthy();
  },
};
```

| Property | Description |
|---|---|
| `site.baseUrl`    | `http://127.0.0.1:<port>` — the harness HTTP server root |
| `site.port`       | Ephemeral port the local server bound to |
| `site.root`       | Absolute path to the served `_site/` |
| `page`            | Puppeteer Page (fresh per test) |
| `expect`          | Same Jest-compatible matchers |
| `projectRoot`     | Absolute path to the consumer project |

## Consumer pattern — use the public Manager API

When writing consumer tests, **use the public Manager API** — don't reach into UJM's transitive deps:

```js
// Good — uses the public API
const Manager = require('ultimate-jekyll-manager/build');
const cfg = Manager.getUJMConfig();
const pkg = Manager.getPackage('project');

// Bad — reaches into UJM's transitive deps. Brittle: if UJM swaps json5 for
// jsonc-parser, your test breaks even though UJM's public API hasn't changed.
const json5 = require('json5');
const fs = require('fs');
const cfg = json5.parse(fs.readFileSync('config/ultimate-jekyll-manager.json', 'utf8'));
```

The public surface exposed by `require('ultimate-jekyll-manager/build')` includes:

- `Manager.getConfig(type)` — reads `_config.yml` (type: `'project'` or `'main'`)
- `Manager.getPackage(type)` — reads `package.json` (type: `'project'` or `'main'`)
- `Manager.getUJMConfig()` — reads `config/ultimate-jekyll-manager.json` (JSON5)
- `Manager.getRootPath(type)` — project cwd or UJM package root
- `Manager.getEnvironment()` — `'development'` or `'production'`
- `Manager.isBuildMode()` / `isQuickMode()` / `isServer()` / `actLikeProduction()`
- `Manager.isTesting()` / `isDevelopment()` / `isProduction()` / `getVersion()` (from `mode-helpers.js`)
- `Manager.getMemoryUsage()` / `Manager.logMemory(logger, label)` / `Manager.processBatches(items, size, fn, logger)`
- `Manager.logger(name)` — returns a `Logger` instance
- `Manager.require(path)` — escape hatch when you really need a UJM transitive dep

See [docs/environment-detection.md](environment-detection.md) for `isTesting`/`isDevelopment` semantics.

## Reporter contract — `__UJM_TEST__` JSON-line events

`--reporter json` emits one JSON line per event for external tools (CI dashboards, IDE plugins):

```
__UJM_TEST__{"event":"result","name":"my-test","passed":true,"duration":12}
__UJM_TEST__{"event":"result","name":"other-test","passed":false,"duration":34,"error":"expected 1 to be 2"}
__UJM_TEST__{"event":"skip","name":"x","reason":"manual"}
```

Then a final summary line:

```json
{"event":"summary","passed":42,"failed":1,"skipped":0,"total":43}
```

Same protocol as EM (`__EM_TEST__`) and BXM (`__BXM_TEST__`). One marker per framework; same JSON shape.

## Discovery

- **Framework suites**: glob `<ujm>/dist/test/suites/**/*.js` (resolved from `__dirname/suites` in `runner.js`).
- **Consumer suites**: glob `<cwd>/test/**/*.js`.
- **Excluded**: any directory starting with `_` (handy for shared helpers).
- **Framework boot suites** are excluded when the cwd's `package.json#name` is not `ultimate-jekyll-manager` — they target UJM's fixture site, not the consumer's. Consumers write their own boot tests in `<cwd>/test/boot/`.

## `test/_init.js` — pre-test lifecycle hook

The runner loads an optional `test/_init.js` from **both** test roots — the framework (`<UJM>/test/_init.js`) and the consumer project (`<cwd>/test/_init.js`) — and runs it **once, before any suite** (it is NOT itself run as a test; the `_`-prefix keeps it out of discovery). Mirrors the same hook in BEM/EM/BXM so all four frameworks share one shape.

The module **must export a function** — `module.exports = (ctx) => ({ ... })` — called with `{ projectRoot }` and returning the hook object. It may declare:

- `async setup({ projectRoot })` — runs once before the suites, e.g. to scaffold a fixture file the boot layer needs.

There is **no `cleanup` hook** and **no `accounts` field** (unlike BEM — these frameworks have no auth/user system): tests clean up after themselves, so there is nothing project-level to tear down.

```javascript
// <cwd>/test/_init.js
const fs = require('fs');
const path = require('path');

module.exports = ({ projectRoot }) => ({
  async setup() {
    // Seed any fixture a suite needs before it runs.
    fs.mkdirSync(path.join(projectRoot, '.temp'), { recursive: true });
  },
});
```

## Env vars

| Env | Set by | Purpose |
|---|---|---|
| `UJ_TEST_MODE=true`         | `npx mgr test` always | Canonical test signal. `Manager.isTesting()` reads this. Use it to short-circuit network calls / prompts / long timers in code that runs during tests. |
| `UJ_TEST_INTEGRATION=1`     | `--integration` flag | Opt-in flag for slower live-integration tests if your suite has them. These run the **real** external path (NOT mocked); anything they create externally MUST be cleaned up by the test. |
| `UJ_TEST_BOOT_PROJECT`      | Auto-set when UJM tests itself; else manual | Project root the boot runner uses (its `_site/` is the boot target) |
| `UJ_TEST_BOOT_DIR`          | Manual | Absolute override for the `_site/` directory. Wins over `UJ_TEST_BOOT_PROJECT/_site` and `<cwd>/_site` |
| `UJ_TEST_DEBUG=1`           | Manual | Verbose Puppeteer console output piped to the parent stdout |

## Puppeteer as a peer-optional dep

Puppeteer is a `devDependency` of UJM itself. Consumers don't get it unless they write `page` or `boot` tests. If a consumer tries to run `page`/`boot` tests without puppeteer installed, those layers report as skipped with a clear message — build-layer tests still run.

## See also

- [test-boot-layer.md](test-boot-layer.md) — deep dive on boot layer (`_site/` discovery, HTTP server, fixture vs consumer)
- [environment-detection.md](environment-detection.md) — `Manager.isTesting()` / `isDevelopment()` semantics
- [cli.md](cli.md) — CLI surface, env-var conventions
