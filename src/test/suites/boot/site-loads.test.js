// Boot test: fixture _site/ loads end-to-end. Asserts:
//   - / serves a 200, has a <title>, has expected content
//   - /about resolves (Jekyll-style suffix fallback)
//   - /build.json is present + parseable + has expected brand
//   - /assets/css/main.bundle.css served as text/css
//   - /assets/js/main.bundle.js loads without throwing
//   - no console.error fires during page load
//
// When a consumer (not UJM itself) runs `npx mgr test`, this suite is excluded
// — it asserts on UJM's fixture site, not the consumer's.

module.exports = {
  layer: 'boot',
  description: 'fixture _site/ renders + serves assets',
  type: 'group',
  tests: [
    {
      description: 'home page renders with title + body content',
      inspect: async ({ site, page, expect }) => {
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

        const res = await page.goto(site.baseUrl + '/', { waitUntil: 'load' });
        expect(res.status()).toBe(200);
        expect(await page.title()).toBe('UJM Fixture Consumer');

        const h1 = await page.$eval('h1', (el) => el.textContent);
        expect(h1).toBe('UJM Fixture Consumer');

        // Wait a tick so any console.error from late-resolving promises arrives.
        await new Promise((r) => setTimeout(r, 100));
        expect(errors).toEqual([]);
      },
    },
    {
      description: '/about resolves via Jekyll-style .html fallback',
      inspect: async ({ site, page, expect }) => {
        const res = await page.goto(site.baseUrl + '/about', { waitUntil: 'domcontentloaded' });
        expect(res.status()).toBe(200);
        const title = await page.title();
        expect(title).toContain('About');
      },
    },
    {
      description: 'build.json is served with brand metadata',
      inspect: async ({ site, page, expect }) => {
        const res = await page.goto(site.baseUrl + '/build.json', { waitUntil: 'domcontentloaded' });
        expect(res.status()).toBe(200);
        const body = await page.evaluate(() => document.body.innerText);
        const data = JSON.parse(body);
        expect(data.config.brand.id).toBe('ujm-fixture');
      },
    },
    {
      description: 'CSS bundle served with text/css content type',
      inspect: async ({ site, page, expect }) => {
        const res = await page.goto(site.baseUrl + '/assets/css/main.bundle.css', { waitUntil: 'domcontentloaded' });
        expect(res.status()).toBe(200);
        const ct = res.headers()['content-type'];
        expect(ct).toContain('text/css');
      },
    },
  ],
};
