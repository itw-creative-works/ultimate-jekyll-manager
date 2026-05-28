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
// Idempotent: calling twice with the same path just returns the existing fd.
//
// Uses synchronous fs.writeSync(fd, ...) rather than createWriteStream(). Reason: gulp tasks
// crash via thrown errors that propagate to process.exit, and createWriteStream's internal
// buffer was being dropped before the kernel could flush it — so the very lines describing
// the crash (the most important ones) never made it to disk. Synchronous writes incur a
// per-line syscall but guarantee the tail of the log survives an immediate exit.

const fs = require('fs');
const path = require('path');

const ANSI_PATTERN = /\x1B\[[0-9;]*[a-zA-Z]/g;

let activeFd       = null;
let activePath     = null;
let originalStdoutWrite = null;
let originalStderrWrite = null;

function attachLogFile(name) {
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

function stripAnsi(s) {
  return String(s).replace(ANSI_PATTERN, '');
}

module.exports = attachLogFile;
module.exports.detach    = detach;
module.exports.stripAnsi = stripAnsi;
