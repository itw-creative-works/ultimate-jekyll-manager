// Baseline page-layer sanity: the harness loads, DOM APIs work, fetch works
// against the local server. If THIS suite fails the harness is broken — no
// other page-layer test result is trustworthy.

module.exports = {
  layer: 'page',
  description: 'page-layer baseline (DOM + fetch + storage)',
  type: 'group',
  tests: [
    {
      name: 'document is interactive or complete',
      run: async (ctx) => {
        ctx.expect(['interactive', 'complete']).toContain(document.readyState);
      },
    },
    {
      name: 'fetch() works against the local harness server',
      run: async (ctx) => {
        const res = await fetch('/');
        ctx.expect(res.ok).toBe(true);
        const text = await res.text();
        ctx.expect(text).toContain('UJM Test Harness');
      },
    },
    {
      name: 'localStorage is available',
      run: async (ctx) => {
        localStorage.setItem('ujm-test-key', 'value');
        ctx.expect(localStorage.getItem('ujm-test-key')).toBe('value');
        localStorage.removeItem('ujm-test-key');
      },
    },
  ],
};
