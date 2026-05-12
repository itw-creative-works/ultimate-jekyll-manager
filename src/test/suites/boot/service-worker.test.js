// Boot test: service-worker.js registers + activates + cache name matches
// the brand-id + cache-breaker pattern from UJ_BUILD_JSON. This catches the
// most common SW regressions:
//   - SW served as text/html (wrong MIME → registration silently fails)
//   - skipWaiting + clients.claim not wired → SW never activates
//   - cache name composition broken → wrong cache lookups in fetch handler
//
// We wait for `activated` state explicitly (rather than just `controller`)
// because registration can resolve before activation completes.

module.exports = {
  layer: 'boot',
  description: 'fixture service worker registers + activates',
  type: 'group',
  tests: [
    {
      description: '/service-worker.js served with javascript content type',
      inspect: async ({ site, page, expect }) => {
        const res = await page.goto(site.baseUrl + '/service-worker.js', { waitUntil: 'domcontentloaded' });
        expect(res.status()).toBe(200);
        const ct = res.headers()['content-type'];
        // Either text/javascript or application/javascript is acceptable.
        expect(/(text|application)\/javascript/.test(ct)).toBe(true);
      },
    },
    {
      description: 'index.html registers SW and reaches activated state',
      timeout: 15000,
      inspect: async ({ site, page, expect }) => {
        await page.goto(site.baseUrl + '/', { waitUntil: 'load' });

        // Poll for activation. `navigator.serviceWorker.ready` resolves when a
        // worker is registered + non-null, but the worker may still be in
        // `installing`/`activating` for a few ms. Wait up to 5s for activated.
        const result = await page.evaluate(async () => {
          if (!('serviceWorker' in navigator)) return { error: 'no-sw-api' };
          const reg = await navigator.serviceWorker.ready;
          const start = Date.now();
          while (Date.now() - start < 5000) {
            const worker = reg.active || reg.installing || reg.waiting;
            if (worker && worker.state === 'activated') {
              return { scope: reg.scope, state: worker.state };
            }
            await new Promise((r) => setTimeout(r, 50));
          }
          const worker = reg.active || reg.installing || reg.waiting;
          return { scope: reg.scope, state: (worker && worker.state) || 'unknown' };
        });

        expect(result.error).toBeUndefined();
        expect(result.state).toBe('activated');
        expect(result.scope).toMatch(/\/$/);
      },
    },
    {
      description: 'SW responds to get-cache-name message with brand-id pattern',
      timeout: 15000,
      inspect: async ({ site, page, expect }) => {
        await page.goto(site.baseUrl + '/', { waitUntil: 'load' });

        // Wait for SW to be activated AND controlling this page.
        await page.evaluate(async () => {
          await navigator.serviceWorker.ready;
          if (!navigator.serviceWorker.controller) {
            await new Promise((resolve) => {
              navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
            });
          }
        });

        const name = await page.evaluate(async () => {
          return new Promise((resolve) => {
            const channel = new MessageChannel();
            channel.port1.onmessage = (e) => resolve(e.data && e.data.name);
            navigator.serviceWorker.controller.postMessage({ command: 'get-cache-name' }, [channel.port2]);
            setTimeout(() => resolve(null), 5000);
          });
        });

        expect(name).toBe('ujm-fixture-fixture-1');
      },
    },
  ],
};
