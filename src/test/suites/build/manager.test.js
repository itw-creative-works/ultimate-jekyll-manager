// Manager static/prototype methods exposed by src/build.js.
//
// These are the public surface consumer projects consume through
// `require('ultimate-jekyll-manager/build')`. Tests assert that:
//   - Static + instance forms match (Manager.foo === Manager.prototype.foo)
//   - Env-gated boolean checks reflect process.env correctly
//   - getArguments + getMemoryUsage return well-shaped objects
//   - getRootPath/getEnvironment short-circuit checks don't throw
//
// We DO NOT assert getConfig/getPackage/getUJMConfig here because those
// require a Jekyll project on disk; consumer tests verify those against
// their own project.

module.exports = {
  layer: 'build',
  description: 'Manager (build.js) public surface',
  type: 'group',
  tests: [
    {
      name: 'Manager constructor is a function',
      run: async (ctx) => {
        const Manager = require('../../../build.js');
        ctx.expect(typeof Manager).toBe('function');
      },
    },
    {
      name: 'static methods match prototype methods',
      run: async (ctx) => {
        const Manager = require('../../../build.js');
        const names = ['getArguments', 'isServer', 'isBuildMode', 'isQuickMode', 'actLikeProduction', 'getEnvironment', 'getRootPath', 'getMemoryUsage', 'logger'];
        for (const name of names) {
          ctx.expect(typeof Manager[name]).toBe('function');
          ctx.expect(typeof Manager.prototype[name]).toBe('function');
          ctx.expect(Manager[name]).toBe(Manager.prototype[name]);
        }
      },
    },
    {
      name: 'isBuildMode reflects UJ_BUILD_MODE env',
      run: async (ctx) => {
        const Manager = require('../../../build.js');
        const original = process.env.UJ_BUILD_MODE;
        try {
          process.env.UJ_BUILD_MODE = 'true';
          ctx.expect(Manager.isBuildMode()).toBe(true);
          process.env.UJ_BUILD_MODE = 'false';
          ctx.expect(Manager.isBuildMode()).toBe(false);
          delete process.env.UJ_BUILD_MODE;
          ctx.expect(Manager.isBuildMode()).toBe(false);
        } finally {
          if (original === undefined) delete process.env.UJ_BUILD_MODE;
          else process.env.UJ_BUILD_MODE = original;
        }
      },
    },
    {
      name: 'isQuickMode reflects UJ_QUICK env',
      run: async (ctx) => {
        const Manager = require('../../../build.js');
        const original = process.env.UJ_QUICK;
        try {
          process.env.UJ_QUICK = 'true';
          ctx.expect(Manager.isQuickMode()).toBe(true);
          delete process.env.UJ_QUICK;
          ctx.expect(Manager.isQuickMode()).toBe(false);
        } finally {
          if (original === undefined) delete process.env.UJ_QUICK;
          else process.env.UJ_QUICK = original;
        }
      },
    },
    {
      name: 'isServer reflects UJ_IS_SERVER env',
      run: async (ctx) => {
        const Manager = require('../../../build.js');
        const original = process.env.UJ_IS_SERVER;
        try {
          process.env.UJ_IS_SERVER = 'true';
          ctx.expect(Manager.isServer()).toBe(true);
          delete process.env.UJ_IS_SERVER;
          ctx.expect(Manager.isServer()).toBe(false);
        } finally {
          if (original === undefined) delete process.env.UJ_IS_SERVER;
          else process.env.UJ_IS_SERVER = original;
        }
      },
    },
    {
      name: 'getEnvironment maps server flag to environment string',
      run: async (ctx) => {
        const Manager = require('../../../build.js');
        const original = process.env.UJ_IS_SERVER;
        try {
          process.env.UJ_IS_SERVER = 'true';
          ctx.expect(Manager.getEnvironment()).toBe('production');
          delete process.env.UJ_IS_SERVER;
          ctx.expect(Manager.getEnvironment()).toBe('development');
        } finally {
          if (original === undefined) delete process.env.UJ_IS_SERVER;
          else process.env.UJ_IS_SERVER = original;
        }
      },
    },
    {
      name: 'actLikeProduction is true when isBuildMode OR UJ_AUDIT_FORCE',
      run: async (ctx) => {
        const Manager = require('../../../build.js');
        const origBuild = process.env.UJ_BUILD_MODE;
        const origAudit = process.env.UJ_AUDIT_FORCE;
        try {
          delete process.env.UJ_BUILD_MODE;
          delete process.env.UJ_AUDIT_FORCE;
          ctx.expect(Manager.actLikeProduction()).toBe(false);

          process.env.UJ_BUILD_MODE = 'true';
          ctx.expect(Manager.actLikeProduction()).toBe(true);
          delete process.env.UJ_BUILD_MODE;

          process.env.UJ_AUDIT_FORCE = 'true';
          ctx.expect(Manager.actLikeProduction()).toBe(true);
        } finally {
          if (origBuild === undefined) delete process.env.UJ_BUILD_MODE; else process.env.UJ_BUILD_MODE = origBuild;
          if (origAudit === undefined) delete process.env.UJ_AUDIT_FORCE; else process.env.UJ_AUDIT_FORCE = origAudit;
        }
      },
    },
    {
      name: 'getRootPath("package") points at UJM root',
      run: async (ctx) => {
        const Manager = require('../../../build.js');
        const path = require('path');
        const root = Manager.getRootPath('package');
        ctx.expect(typeof root).toBe('string');
        // Should resolve to the directory containing src/build.js's parent.
        // dist/build.js → dist/ ; package root = parent.
        const fs = require('fs');
        ctx.expect(fs.existsSync(path.join(root, 'package.json'))).toBe(true);
      },
    },
    {
      name: 'getMemoryUsage returns shape with MB-sized numbers',
      run: async (ctx) => {
        const Manager = require('../../../build.js');
        const mem = Manager.getMemoryUsage();
        ctx.expect(typeof mem).toBe('object');
        for (const key of ['rss', 'heapTotal', 'heapUsed', 'external']) {
          ctx.expect(typeof mem[key]).toBe('number');
          ctx.expect(mem[key]).toBeGreaterThan(0);
        }
      },
    },
    {
      name: 'getArguments returns object with _ array + boolean defaults',
      run: async (ctx) => {
        const Manager = require('../../../build.js');
        const args = Manager.getArguments();
        ctx.expect(typeof args).toBe('object');
        ctx.expect(Array.isArray(args._)).toBe(true);
        ctx.expect(typeof args.browser).toBe('boolean');
        ctx.expect(typeof args.debug).toBe('boolean');
      },
    },
    {
      name: 'logger returns object with log/error/warn/info methods',
      run: async (ctx) => {
        const Manager = require('../../../build.js');
        const log = Manager.logger('test-logger');
        ctx.expect(typeof log.log).toBe('function');
        ctx.expect(typeof log.error).toBe('function');
        ctx.expect(typeof log.warn).toBe('function');
        ctx.expect(typeof log.info).toBe('function');
        ctx.expect(log.name).toBe('test-logger');
      },
    },
    {
      name: 'processBatches processes items in chunks and returns flat results',
      run: async (ctx) => {
        const Manager = require('../../../build.js');
        const log = { log: () => {} };
        const items = [1, 2, 3, 4, 5, 6, 7];
        const results = await Manager.processBatches(items, 3, async (n) => n * 2, log);
        ctx.expect(results).toEqual([2, 4, 6, 8, 10, 12, 14]);
      },
    },
  ],
};
