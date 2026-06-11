// Libraries
const path    = require('path');
const fs      = require('fs');
const Manager = require('../build.js');
const mgr     = new Manager();
const logger  = mgr.logger('test');
const { run } = require('../test/runner.js');
const attachLogFile = require('../utils/attach-log-file.js');
const { EXTENDED_MODE_WARNING } = require('../test/utils/extended-mode-warning.js');

module.exports = async function (options) {
  // Tee all test output to <projectRoot>/logs/test.log (ANSI-stripped) — mirrors
  // the dev/build log pattern and EM/BEM's test.log. Skipped on CI via isServer().
  attachLogFile('test');

  const layer       = options.layer    || 'all';
  // Positional target: `npx mgr test <target>` where target supports source
  // prefixes — `project:`, `project:<path>`, `mgr:`, `ujm:`, or a bare `<path>`.
  const target      = (options._ && options._[1]) || null;
  // `--filter` flag: substring match on test NAMES/descriptions (orthogonal to target).
  const filter      = options.filter   || null;
  const reporter    = options.reporter || 'pretty';
  // Extended mode — opt into tests that hit REAL external services (network fetches, Firebase
  // via web-manager, live APIs) instead of skipping them. Off by default so `npx mgr test`
  // stays fast and offline-safe. The canonical signal is the unprefixed `TEST_EXTENDED_MODE`
  // env var — the SAME name across BEM/BXM/UJM/EM (cross-framework parity); `--extended` is the
  // CLI shorthand. Once set on process.env it propagates to every spawned child (the Jekyll
  // build, the boot HTTP server / Puppeteer browsers) automatically via inherited `process.env`.
  const extended    = options.extended === true
    || options.extended === 'true'
    || process.env.TEST_EXTENDED_MODE === 'true'
    || process.env.TEST_EXTENDED_MODE === '1';

  if (extended) {
    process.env.TEST_EXTENDED_MODE = 'true';
  }

  // Canonical signal — every Manager picks this up via isTesting().
  process.env.UJ_TEST_MODE = 'true';

  // When UJM itself runs its own boot-layer tests (the cwd's package.json is
  // UJM's package.json), there's no real consumer site to target. Point the
  // boot runner at the fixture under dist/test/fixtures/consumer-site unless
  // the caller has already set UJ_TEST_BOOT_PROJECT explicitly.
  if (!process.env.UJ_TEST_BOOT_PROJECT) {
    try {
      const cwdPkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
      if (cwdPkg.name === 'ultimate-jekyll-manager') {
        process.env.UJ_TEST_BOOT_PROJECT = path.join(__dirname, '..', 'test', 'fixtures', 'consumer-site');
      }
    } catch (_) { /* no package.json — leave unset */ }
  }

  if (reporter !== 'json') {
    logger.log(`Running tests (layer=${layer}${target ? ` target="${target}"` : ''}${filter ? ` filter="${filter}"` : ''}${extended ? ' +extended' : ''})`);
    logger.log(`Test mode: ${extended ? 'extended (real external APIs)' : 'normal (external APIs skipped)'}`);
    if (extended) {
      logger.warn(EXTENDED_MODE_WARNING[0]);
      EXTENDED_MODE_WARNING.slice(1).forEach((line) => logger.warn(line));
    }
  }

  const result = await run({ layer, target, filter, reporter });

  if (reporter === 'json') {
    // Final machine-readable summary.
    process.stdout.write(JSON.stringify({
      event:   'summary',
      passed:  result.passed,
      failed:  result.failed,
      skipped: result.skipped,
      total:   result.passed + result.failed + result.skipped,
    }) + '\n');
  }

  if (result.failed > 0) {
    process.exitCode = 1;
    attachLogFile.detach();
    throw new Error(`${result.failed} test(s) failed`);
  }

  // Restore stdout/stderr and close the log file. UJM's util writes synchronously,
  // so the tail is already on disk — this just cleans up the handle.
  attachLogFile.detach();
};
