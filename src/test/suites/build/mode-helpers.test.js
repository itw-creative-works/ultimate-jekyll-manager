// Cross-context mode helpers (src/utils/mode-helpers.js) attached to the
// build.js Manager via attachTo(). These mirror EM/BXM's mode-helpers and
// are the canonical signal for "what kind of process am I in?".

module.exports = {
  layer: 'build',
  description: 'mode-helpers (isTesting / isDevelopment / isProduction / getVersion)',
  type: 'group',
  tests: [
    {
      name: 'helpers attach to Manager statically AND on prototype',
      run: async (ctx) => {
        const Manager = require('../../../build.js');
        for (const name of ['isTesting', 'isDevelopment', 'isProduction', 'getVersion']) {
          ctx.expect(typeof Manager[name]).toBe('function');
          ctx.expect(typeof Manager.prototype[name]).toBe('function');
        }
      },
    },
    {
      name: 'isTesting reflects UJ_TEST_MODE env',
      run: async (ctx) => {
        const Manager = require('../../../build.js');
        // UJ_TEST_MODE=true is set by `npx mgr test` — these tests run under it.
        ctx.expect(Manager.isTesting()).toBe(true);

        const original = process.env.UJ_TEST_MODE;
        try {
          delete process.env.UJ_TEST_MODE;
          ctx.expect(Manager.isTesting()).toBe(false);
        } finally {
          if (original === undefined) delete process.env.UJ_TEST_MODE;
          else process.env.UJ_TEST_MODE = original;
        }
      },
    },
    {
      name: 'isDevelopment false when UJ_BUILD_MODE=true',
      run: async (ctx) => {
        const Manager = require('../../../build.js');
        const original = process.env.UJ_BUILD_MODE;
        try {
          process.env.UJ_BUILD_MODE = 'true';
          ctx.expect(Manager.isDevelopment()).toBe(false);
          ctx.expect(Manager.isProduction()).toBe(true);
        } finally {
          if (original === undefined) delete process.env.UJ_BUILD_MODE;
          else process.env.UJ_BUILD_MODE = original;
        }
      },
    },
    {
      name: 'getVersion returns a non-empty string when run from a package',
      run: async (ctx) => {
        const Manager = require('../../../build.js');
        const v = Manager.getVersion();
        // May be null if cwd has no package.json; but in our test runs cwd is UJM root, so set.
        if (v !== null) {
          ctx.expect(typeof v).toBe('string');
          ctx.expect(v.length).toBeGreaterThan(0);
        }
      },
    },
  ],
};
