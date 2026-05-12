// Libraries
const path    = require('path');
const fs      = require('fs');
const Manager = require('../build.js');
const mgr     = new Manager();
const logger  = mgr.logger('test');
const { run } = require('../test/runner.js');

module.exports = async function (options) {
  const layer       = options.layer    || 'all';
  const filter      = options.filter   || null;
  const reporter    = options.reporter || 'pretty';
  const integration = options.integration === true || options.integration === 'true';

  if (integration) {
    process.env.UJ_TEST_INTEGRATION = '1';
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
    logger.log(`Running tests (layer=${layer}${filter ? ` filter="${filter}"` : ''}${integration ? ' +integration' : ''})`);
  }

  const result = await run({ layer, filter, reporter });

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
    throw new Error(`${result.failed} test(s) failed`);
  }
};
