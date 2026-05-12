# Boot Layer

The boot layer runs Puppeteer against a real built `_site/` served by a tiny embedded HTTP server. It's the integration smoke that catches "did my actually-shipped site boot?" regressions — things plain-Node build tests can't see.

## Why a real HTTP server (not `file://`)

Service workers refuse to register from `file://` URLs. Since SW registration / activation / cache-name composition is a key boot signal, the harness spins up a zero-dep HTTP server (`src/test/server.js`, ~100 lines of pure Node `http`) on an ephemeral loopback port and points Puppeteer at it.

The server also serves files with correct MIME types (text/html / text/javascript / text/css / application/json / image/png / etc.) and sets `Service-Worker-Allowed: /` so consumers can register a SW from any subdirectory.

## `_site/` discovery order

The runner picks the first of these that has an `index.html`:

1. `UJ_TEST_BOOT_DIR` — absolute path. Full override. Useful when your build pipeline writes elsewhere (`build/`, `public/`, custom dirs).
2. `UJ_TEST_BOOT_PROJECT/_site` — auto-set when UJM tests itself; points at the fixture site under `src/test/fixtures/consumer-site/`. Consumers can set this manually if they want to run boot tests against a sibling project.
3. `<cwd>/_site` — the default for UJM consumers. After `npm run build`, Jekyll writes here.

If none match, boot tests are reported as skipped with a clear "run `npm run build` first" message.

## Fixture site vs consumer site

UJM's own framework boot suites assert against a fixture `_site/` at `src/test/fixtures/consumer-site/_site/`. The fixture is hand-built (no real Jekyll run needed during framework self-tests) and contains the minimum surface needed to verify boot:

- `index.html` — renders title + h1
- `about.html` — proves Jekyll-style `/about` → `/about.html` suffix fallback works
- `service-worker.js` — registers + activates + responds to `get-cache-name` postMessage
- `build.json` — proves UJM-generated metadata is served as application/json
- `assets/css/main.bundle.css`, `assets/js/main.bundle.js` — prove MIME routing

When a real consumer runs `npx mgr test`, framework boot suites are **excluded** (their assertions reference fixture-only content like "UJM Fixture Consumer"). Consumers write their own boot tests under `test/boot/` against their real `_site/`.

## Single-Chromium-instance amortization

All boot tests run inside one Puppeteer browser instance. Per-test cost: ~150ms for the page navigation + assertions. Browser startup (~1s) is paid once per `npx mgr test --layer boot` invocation, not once per test.

## What to assert

Good boot-test targets (high-signal, low-flake):

| Assertion | Why it matters |
|---|---|
| Home page has expected title / h1 | Catches "template variable didn't resolve" + "Liquid build failed" silently |
| `/some-route` resolves with 200 | Catches Jekyll permalink regressions + suffix-fallback edge cases |
| `build.json` is present + parses + has expected `config.brand.id` | Catches `gulp/build-config` regressions where the runtime config injection broke |
| `service-worker.js` MIME is `text/javascript` | A `text/html` MIME means the SW route is wrong; SW registration silently fails |
| SW reaches `activated` state | Catches "skipWaiting / clients.claim never wired" |
| SW responds to a postMessage with expected cache name | Catches "UJ_BUILD_JSON injection broken" or "cache-name composition regressed" |
| No `console.error` events fire during page load | Catches broken bundles, malformed `window.Configuration`, webManager init crashes |

Avoid (high-flake):

- "Wait for a specific element to be visible" without `waitForSelector` — pages render asynchronously
- Animation-dependent assertions (CSS transition completes, etc.) — timing-sensitive
- Anything that hits production Firebase / external APIs — boot tests should be hermetic

## Example consumer boot test

From Chatsy's `test/boot/site.test.js`:

```js
module.exports = {
  layer: 'boot',
  description: 'Chatsy _site/ loads + SW registers',
  type: 'group',
  tests: [
    {
      description: 'home renders with title',
      inspect: async ({ site, page, expect }) => {
        const res = await page.goto(site.baseUrl + '/', { waitUntil: 'domcontentloaded' });
        expect(res.status()).toBe(200);
        expect((await page.title()).length).toBeGreaterThan(0);
      },
    },
    {
      description: 'service-worker.js has javascript content type',
      inspect: async ({ site, page, expect }) => {
        const res = await page.goto(site.baseUrl + '/service-worker.js');
        expect(/(text|application)\/javascript/.test(res.headers()['content-type'])).toBe(true);
      },
    },
  ],
};
```

## Build-then-test pattern

For local development:

```bash
npm run build          # gulp pipeline produces _site/
npx mgr test --layer boot
```

For CI: do the same. Don't try to share `_site/` between machines — Jekyll's incremental cache makes that brittle. Always build, then test.

## Debugging

Set `UJ_TEST_DEBUG=1` to see Puppeteer's console output piped to your terminal:

```bash
UJ_TEST_DEBUG=1 npx mgr test --layer boot
```

Useful when a boot test fails with an opaque error — you'll see the actual `console.error` that triggered the failure plus any other tab-side logging.

## See also

- [test-framework.md](test-framework.md) — overall harness reference
- [build-system.md](build-system.md) — the gulp pipeline that produces `_site/`
