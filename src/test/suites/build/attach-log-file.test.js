// Build-layer tests for src/utils/attach-log-file.js (shipped to dist/utils/attach-log-file.js)
// — tee process.stdout/stderr to logs/<name>.log with ANSI stripping. Each test attaches,
// writes, detaches, then inspects the file.
//
// CRITICAL: these tests run INSIDE a live `npx mgr test` process whose own output is being
// teed to logs/test.log by the singleton. So they must NOT touch the singleton — exercising
// attach()/detach() on it would detach the live tee mid-run and truncate logs/test.log. Each
// test uses its OWN `createTee()` instance, which stacks under the live singleton tee and
// restores it cleanly on detach.
//
// UJM's tee is NAME-based (attach('<name>') → <cwd>/logs/<name>.log) and SYNCHRONOUS (detach
// closes the fd immediately; writes are fs.writeSync so the tail is already on disk). The
// throwaway log files are cleaned up in each test's finally block.

const path = require('path');
const fs   = require('fs');

// Resolve the SAME path the tee writes to: <cwd>/logs/<name>.log.
function logPath(name) {
  return path.resolve(process.cwd(), 'logs', `${name}.log`);
}

module.exports = {
  type: 'suite',
  layer: 'build',
  description: 'attach-log-file — tee stdout/stderr to a file',
  tests: [
    {
      name: 'exports the expected surface',
      run: (ctx) => {
        const mod = require(path.join(__dirname, '..', '..', '..', 'utils', 'attach-log-file.js'));
        ctx.expect(typeof mod).toBe('function');
        ctx.expect(typeof mod.detach).toBe('function');
        ctx.expect(typeof mod.stripAnsi).toBe('function');
        ctx.expect(typeof mod.createTee).toBe('function');
      },
    },
    {
      name: 'stripAnsi removes color escape codes',
      run: (ctx) => {
        const { stripAnsi } = require(path.join(__dirname, '..', '..', '..', 'utils', 'attach-log-file.js'));
        const colored = '\x1B[31mred\x1B[0m and \x1B[32mgreen\x1B[0m';
        ctx.expect(stripAnsi(colored)).toBe('red and green');
      },
    },
    {
      name: 'attach + stdout.write + detach: file contains the writes',
      run: (ctx) => {
        const attach = require(path.join(__dirname, '..', '..', '..', 'utils', 'attach-log-file.js'));
        // Isolated instance — stacks under the live test.log tee, never clobbers it.
        const tee  = attach.createTee();
        const name = `ujm-log-${Date.now()}`;
        const file = logPath(name);
        try {
          const fd = tee.attach(name);
          // attach() returns null when skipped (isServer()) — guard so the test is meaningful.
          if (fd === null) return ctx.skip('attach skipped (isServer)');

          process.stdout.write('hello world\n');
          process.stdout.write('\x1B[31mcolored\x1B[0m line\n');
          // Synchronous writes — already flushed to disk. detach() just closes the fd.
          tee.detach();

          const contents = fs.readFileSync(file, 'utf8');
          ctx.expect(contents).toContain('hello world');
          ctx.expect(contents).toContain('colored line');
          ctx.expect(contents).not.toContain('\x1B[');
        } finally {
          tee.detach();
          try { fs.unlinkSync(file); } catch (e) {}
        }
      },
    },
    {
      name: 'idempotent: attaching twice with same name returns same fd',
      run: (ctx) => {
        const attach = require(path.join(__dirname, '..', '..', '..', 'utils', 'attach-log-file.js'));
        const tee  = attach.createTee();
        const name = `ujm-log-idem-${Date.now()}`;
        const file = logPath(name);
        try {
          const fd1 = tee.attach(name);
          if (fd1 === null) return ctx.skip('attach skipped (isServer)');
          const fd2 = tee.attach(name);
          ctx.expect(fd1).toBe(fd2);
        } finally {
          tee.detach();
          try { fs.unlinkSync(file); } catch (e) {}
        }
      },
    },
    {
      name: 'attach with falsy name returns null and does nothing',
      run: (ctx) => {
        const attach = require(path.join(__dirname, '..', '..', '..', 'utils', 'attach-log-file.js'));
        const tee = attach.createTee();
        ctx.expect(tee.attach(null)).toBe(null);
        ctx.expect(tee.attach('')).toBe(null);
      },
    },
  ],
};
