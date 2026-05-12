// src/lib/logger.js — the only file under src/lib/ currently. Used everywhere
// in UJM's gulp pipeline as `Manager.logger('task-name')`. Output shape matters
// because dev.log parsers (and humans grepping logs) depend on the `[time]
// name: message` prefix.

module.exports = {
  layer: 'build',
  description: 'Logger (src/lib/logger.js)',
  type: 'group',
  tests: [
    {
      name: 'Logger constructor stores name',
      run: async (ctx) => {
        const Logger = require('../../../lib/logger.js');
        const log = new Logger('my-task');
        ctx.expect(log.name).toBe('my-task');
      },
    },
    {
      name: 'Logger exposes log/error/warn/info methods',
      run: async (ctx) => {
        const Logger = require('../../../lib/logger.js');
        const log = new Logger('x');
        for (const m of ['log', 'error', 'warn', 'info']) {
          ctx.expect(typeof log[m]).toBe('function');
        }
      },
    },
    {
      name: 'Logger.format is chalk',
      run: async (ctx) => {
        const Logger = require('../../../lib/logger.js');
        const log = new Logger('x');
        // chalk-with-default-export exposes `red`, `green`, `cyan` etc. as functions.
        ctx.expect(typeof log.format.red).toBe('function');
        ctx.expect(typeof log.format.green).toBe('function');
      },
    },
    {
      name: 'Logger output goes through console with prefix',
      run: async (ctx) => {
        const Logger = require('../../../lib/logger.js');
        const log = new Logger('prefix-test');

        const captured = [];
        const orig = console.log;
        console.log = (...args) => captured.push(args);
        try {
          log.log('hello world');
        } finally {
          console.log = orig;
        }

        ctx.expect(captured.length).toBe(1);
        const first = captured[0][0];
        // Strip ANSI for stable assertion.
        const plain = first.replace(/\[[0-9;]*m/g, '');
        ctx.expect(plain).toMatch(/\[\d\d:\d\d:\d\d\] 'prefix-test':/);
      },
    },
  ],
};
