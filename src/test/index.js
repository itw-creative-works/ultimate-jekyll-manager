// Public test API — what consumers see.
//
// Test files export a test definition. Three forms:
//
// Standalone:
//   module.exports = {
//     layer: 'build',                  // 'build' | 'page' | 'boot'
//     description: 'config has brand.id',
//     timeout: 5000,
//     run: async (ctx) => {
//       const cfg = Manager.getConfig('project');
//       ctx.expect(cfg.brand.id).toBeTruthy();
//     },
//     cleanup: async (ctx) => { ... },
//   };
//
// Boot layer — spawns Chromium with the consumer's actually-built `_site/` and
// serves it from an embedded local HTTP server, then runs `inspect` against the
// live site. Replaces shell-level smoke tests with deterministic, signal-driven
// pass/fail. Use this to verify the WHOLE integration: site builds, SW registers,
// pages render, no console errors.
//
//   module.exports = {
//     layer: 'boot',
//     description: 'home renders + SW registers',
//     timeout: 20000,
//     inspect: async ({ site, page, expect, projectRoot }) => {
//       await page.goto(site.baseUrl + '/');
//       expect(await page.title()).toBeTruthy();
//     },
//   };
//
// Suite (sequential, shared state, stop on first failure):
//   module.exports = {
//     type: 'suite',
//     layer: 'page',
//     description: 'manager init',
//     tests: [
//       { name: 'step 1', run: async (ctx) => { ctx.state.mgr = new Manager(); } },
//       { name: 'step 2', run: async (ctx) => { ctx.expect(ctx.state.mgr).toBeTruthy(); } },
//     ],
//   };
//
// Group (sequential, shared state, runs ALL tests even if some fail):
//   module.exports = {
//     type: 'group',
//     layer: 'build',
//     tests: [ ... ],
//   };
//
// Array form (treated as group):
//   module.exports = [ { name, run }, ... ];
//
// The ctx (context) provided to every run/cleanup includes:
//   - ctx.expect       — Jest-compatible assertion library
//   - ctx.state        — shared object across tests in a suite/group
//   - ctx.skip(reason) — throw to skip the current test at runtime
//   - ctx.layer        — current layer name
//   - ctx.page         — Puppeteer Page (page layer only)

module.exports = {
  expect: require('./assert.js'),
};
