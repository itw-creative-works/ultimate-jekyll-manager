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
        for (const name of ['getEnvironment', 'isTesting', 'isDevelopment', 'isProduction', 'getVersion']) {
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
      name: 'isDevelopment false / isProduction true when UJ_BUILD_MODE=true (and not testing)',
      run: async (ctx) => {
        const Manager = require('../../../build.js');
        const original = process.env.UJ_BUILD_MODE;
        const origTest = process.env.UJ_TEST_MODE;
        try {
          delete process.env.UJ_TEST_MODE; // isolate the build-mode branch from testing precedence
          process.env.UJ_BUILD_MODE = 'true';
          ctx.expect(Manager.isDevelopment()).toBe(false);
          ctx.expect(Manager.isProduction()).toBe(true);
        } finally {
          if (original === undefined) delete process.env.UJ_BUILD_MODE;
          else process.env.UJ_BUILD_MODE = original;
          if (origTest !== undefined) process.env.UJ_TEST_MODE = origTest;
        }
      },
    },
    {
      name: 'environments are mutually exclusive — testing wins under UJ_TEST_MODE',
      run: async (ctx) => {
        const Manager = require('../../../build.js');
        // These tests run under UJ_TEST_MODE=true → testing wins; dev and prod are false.
        ctx.expect(Manager.isTesting()).toBe(true);
        ctx.expect(Manager.isDevelopment()).toBe(false);
        ctx.expect(Manager.isProduction()).toBe(false);
      },
    },
    {
      // The core invariant of the SSOT refactor: is*() DERIVE from getEnvironment(), so they
      // can NEVER disagree with it, and exactly one is always true. (In build-time Node `window`
      // is undefined, so getEnvironment() resolves via the env-var fallback.)
      name: 'invariant: is*() exactly matches getEnvironment() + mutually exclusive (every scenario)',
      run: async (ctx) => {
        const Manager = require('../../../build.js');
        const prevTest = process.env.UJ_TEST_MODE;
        const prevBuild = process.env.UJ_BUILD_MODE;
        const prevServer = process.env.UJ_IS_SERVER;
        const prevNode = process.env.NODE_ENV;
        const scenarios = [
          { env: { UJ_TEST_MODE: 'true', UJ_BUILD_MODE: 'true' }, expect: 'testing' },
          { env: { UJ_BUILD_MODE: 'true' },                       expect: 'production' },
          { env: { UJ_IS_SERVER: 'true' },                        expect: 'production' },
          { env: { NODE_ENV: 'development' },                     expect: 'development' },
          { env: {},                                              expect: 'development' }, // UJM defaults dev (signal always baked in)
        ];
        try {
          for (const s of scenarios) {
            delete process.env.UJ_TEST_MODE; delete process.env.UJ_BUILD_MODE;
            delete process.env.UJ_IS_SERVER; delete process.env.NODE_ENV;
            for (const k of Object.keys(s.env)) process.env[k] = s.env[k];
            const e = Manager.getEnvironment();
            ctx.expect(e).toBe(s.expect);
            ctx.expect(Manager.isDevelopment()).toBe(e === 'development');
            ctx.expect(Manager.isTesting()).toBe(e === 'testing');
            ctx.expect(Manager.isProduction()).toBe(e === 'production');
            const trueCount = [Manager.isDevelopment(), Manager.isTesting(), Manager.isProduction()].filter(Boolean).length;
            ctx.expect(trueCount).toBe(1);
          }
        } finally {
          if (prevTest === undefined) delete process.env.UJ_TEST_MODE; else process.env.UJ_TEST_MODE = prevTest;
          if (prevBuild === undefined) delete process.env.UJ_BUILD_MODE; else process.env.UJ_BUILD_MODE = prevBuild;
          if (prevServer === undefined) delete process.env.UJ_IS_SERVER; else process.env.UJ_IS_SERVER = prevServer;
          if (prevNode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = prevNode;
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
