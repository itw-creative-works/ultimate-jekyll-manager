// attachLogFile(name) — duplicate process.stdout + process.stderr writes to logs/<name>.log
// in the consumer project root (process.cwd()).
//
// Mirrors EM's attach-log-file pattern so devs (and Claude) can `tail -f logs/dev.log` to see
// every line of output a UJM session produces — gulp tasks, jekyll child, webpack, SCSS, the
// works. ANSI color codes are stripped from the file output so it's grep-friendly; the
// console continues to receive the original colored output unchanged.
//
// Skipped entirely when Manager.isServer() returns true — CI/cloud runs don't need a logs/
// directory left behind in the workspace.
//
// Truncates fresh on each call (O_TRUNC), so a new `npm start` doesn't accumulate stale
// lines from the previous run.
//
// Idempotent: calling twice with the same name on one tee just returns the existing fd.
//
// Uses synchronous fs.writeSync(fd, ...) rather than createWriteStream(). Reason: gulp tasks
// crash via thrown errors that propagate to process.exit, and createWriteStream's internal
// buffer was being dropped before the kernel could flush it — so the very lines describing
// the crash (the most important ones) never made it to disk. Synchronous writes incur a
// per-line syscall but guarantee the tail of the log survives an immediate exit. (This is the
// key behavioral difference from EM, whose tee is async/stream-based with an awaited detach.)
//
// The default export is a process-wide SINGLETON (the common case: a CLI command tees its
// whole run to one file). `attachLogFile.createTee()` returns an INDEPENDENT tee with its own
// state. Tees STACK: a later attach() captures the CURRENT `process.stdout.write` (which may
// already be an outer tee) as its "original", so writes fan out through every layer and
// detach() restores the exact prior writer in LIFO order. That stacking is what lets the
// attach-log-file unit test exercise attach/detach on a throwaway instance WITHOUT killing
// the live singleton tee that's capturing the actual test run — the bug that previously
// truncated `logs/test.log` to ~9 lines (the test detached the live tee mid-run).

const fs = require('fs');
const path = require('path');

const ANSI_PATTERN = /\x1B\[[0-9;]*[a-zA-Z]/g;

function stripAnsi(s) {
  return String(s).replace(ANSI_PATTERN, '');
}

// Factory — each call returns an independent tee with its own closure state.
function createTee() {
  let activeFd            = null;
  let activePath          = null;
  let originalStdoutWrite = null;
  let originalStderrWrite = null;

  function attach(name) {
    // Skip on CI/cloud — controlled by UJ_IS_SERVER env var (set by workflows).
    const Manager = require('../build.js');
    if (Manager.isServer()) return null;

    if (!name) return null;

    const abs = path.resolve(process.cwd(), 'logs', `${name}.log`);

    if (activeFd !== null && activePath === abs) return activeFd;
    if (activeFd !== null) detach();

    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const fd = fs.openSync(abs, 'w');

    fs.writeSync(fd, `# ujm log — ${new Date().toISOString()} — pid=${process.pid}\n`);

    // Capture whatever the CURRENT writer is — could be the raw stream OR an outer tee.
    // Restoring this exact reference on detach() is what makes stacked tees safe.
    originalStdoutWrite = process.stdout.write.bind(process.stdout);
    originalStderrWrite = process.stderr.write.bind(process.stderr);

    process.stdout.write = function (chunk, ...rest) {
      try { fs.writeSync(fd, stripAnsi(String(chunk))); } catch (e) { /* ignore */ }
      return originalStdoutWrite(chunk, ...rest);
    };
    process.stderr.write = function (chunk, ...rest) {
      try { fs.writeSync(fd, stripAnsi(String(chunk))); } catch (e) { /* ignore */ }
      return originalStderrWrite(chunk, ...rest);
    };

    activeFd   = fd;
    activePath = abs;

    return fd;
  }

  // Restores stdout/stderr and closes the fd. Synchronous — UJM writes synchronously, so the
  // tail is already on disk by the time detach() runs; this just cleans up the handle.
  function detach() {
    if (originalStdoutWrite) process.stdout.write = originalStdoutWrite;
    if (originalStderrWrite) process.stderr.write = originalStderrWrite;
    if (activeFd !== null) {
      try { fs.closeSync(activeFd); } catch (e) { /* ignore */ }
    }
    activeFd   = null;
    activePath = null;
    originalStdoutWrite = null;
    originalStderrWrite = null;
  }

  return { attach, detach };
}

// Process-wide singleton — the production entry point.
const singleton = createTee();

function attachLogFile(name) {
  return singleton.attach(name);
}

module.exports = attachLogFile;
module.exports.detach    = singleton.detach;
module.exports.stripAnsi = stripAnsi;
module.exports.createTee = createTee;
