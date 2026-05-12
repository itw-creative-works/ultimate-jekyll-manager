// Verify the page-layer harness provides the globals UJM's frontend Manager
// reads at runtime: window.Configuration with brand/theme/web_manager, plus
// document.documentElement.dataset.{pagePath,assetPath}.
//
// These are what Jekyll-rendered consumer pages provide. The harness stubs
// them so we can test frontend Manager logic without a full Jekyll build.

module.exports = {
  layer: 'page',
  description: 'harness globals (window.Configuration + dataset)',
  type: 'group',
  tests: [
    {
      name: 'window.Configuration has brand + theme + web_manager',
      run: async (ctx) => {
        ctx.expect(typeof window.Configuration).toBe('object');
        ctx.expect(window.Configuration.brand.id).toBeTruthy();
        ctx.expect(window.Configuration.theme.id).toBeTruthy();
        ctx.expect(window.Configuration.web_manager).toBeTruthy();
      },
    },
    {
      name: 'document.documentElement.dataset.pagePath is set',
      run: async (ctx) => {
        ctx.expect(typeof document.documentElement.dataset.pagePath).toBe('string');
        // No leading slash (Manager.initialize strips before using).
        // Harness sets it to '/' so the assertion just checks shape.
        ctx.expect(document.documentElement.dataset.pagePath).toBe('/');
      },
    },
    {
      name: 'UJ_TEST_MODE is signalled on globalThis',
      run: async (ctx) => {
        ctx.expect(globalThis.UJ_TEST_MODE).toBe(true);
      },
    },
  ],
};
