// Smoke-test the expect() implementation itself. Mirrors EM/BXM's expect.test.js.
// If this breaks, every other test reports nonsense — verify the matchers
// directly so the framework's own foundation can't silently rot.

module.exports = {
  layer: 'build',
  description: 'expect() matcher set',
  type: 'group',
  tests: [
    {
      name: 'toBe + toEqual basics',
      run: async (ctx) => {
        ctx.expect(1).toBe(1);
        ctx.expect({ a: 1 }).toEqual({ a: 1 });
        ctx.expect([1, 2]).toEqual([1, 2]);
      },
    },
    {
      name: '.not negates',
      run: async (ctx) => {
        ctx.expect(1).not.toBe(2);
        ctx.expect({ a: 1 }).not.toEqual({ a: 2 });
      },
    },
    {
      name: 'toContain works on arrays and strings',
      run: async (ctx) => {
        ctx.expect([1, 2, 3]).toContain(2);
        ctx.expect('hello world').toContain('world');
      },
    },
    {
      name: 'toThrow catches sync + async throws',
      run: async (ctx) => {
        await ctx.expect(() => { throw new Error('boom'); }).toThrow('boom');
        await ctx.expect(async () => { throw new Error('async boom'); }).toThrow(/async/);
      },
    },
    {
      name: 'toBeGreaterThan / toBeLessThan',
      run: async (ctx) => {
        ctx.expect(5).toBeGreaterThan(3);
        ctx.expect(3).toBeLessThan(5);
      },
    },
    {
      name: 'failing assertions throw AssertionError',
      run: async (ctx) => {
        try {
          ctx.expect(1).toBe(2);
        } catch (e) {
          ctx.expect(e.name).toBe('AssertionError');
          return;
        }
        throw new Error('expected assertion to throw');
      },
    },
  ],
};
