// Test runner — discovers + runs suites, reports UJM-style.
//
// Discovery: globs for `test/**/*.js` (recursively, excluding directories starting with `_`)
// in two locations:
//   1. The framework itself (ultimate-jekyll-manager/dist/test/suites/...) — default suites.
//   2. The consumer project's CWD (./test/...) — consumer suites.
//
// Each test file is a CommonJS module that exports a test definition (see ./index.js).
// Three forms supported:
//
//   - Standalone:  module.exports = { layer, description, run, cleanup, timeout, skip };
//   - Suite:       module.exports = { type: 'suite', layer, description, tests: [...], cleanup, stopOnFailure };
//   - Group:       module.exports = { type: 'group', layer, description, tests: [...], cleanup };
//   - Array form:  module.exports = [ {name, run}, ... ];   // implicit group
//
// `tests[]` items are { name, run(ctx), cleanup?, skip?, timeout? }.
//
// Suites stop on first failure (sequential, share state). Groups run all tests regardless.
//
// Layers:
//   - 'build' runs in plain Node (this file).
//   - 'page'  spawns Chromium via runners/chromium.js, runs in a tab loading the harness HTML.
//   - 'boot'  spawns Chromium loading the consumer's actually-built `_site/` from a tiny
//             embedded HTTP server.

const path = require('path');
const glob = require('glob').globSync;
const jetpack = require('fs-jetpack');
const chalk = require('chalk').default;

const expect = require('./assert.js');

// Chromium / boot runners are lazy-loaded so a missing puppeteer doesn't prevent
// build-layer tests from running. The dispatch points below require() them only when
// those layers exist.

class SkipError extends Error {
  constructor(reason) { super(reason); this.name = 'SkipError'; }
}

async function run(options = {}) {
  options.layer    = options.layer    || 'all';
  options.filter   = options.filter   || null;
  options.reporter = options.reporter || 'pretty';

  const startTime = Date.now();

  const sources = discoverTestFiles();

  console.log('');
  console.log(chalk.bold('  Ultimate Jekyll Manager Tests'));

  const results = { passed: 0, failed: 0, skipped: 0, tests: [] };

  if (sources.framework.length > 0) {
    console.log('');
    console.log(chalk.bold('  Framework Tests'));
    await runSource(sources.framework, 'framework', options, results);
  }

  if (sources.project.length > 0) {
    console.log('');
    console.log(chalk.bold('  Project Tests'));
    await runSource(sources.project, 'project', options, results);
  }

  if (sources.framework.length === 0 && sources.project.length === 0) {
    console.log(chalk.gray('  No test files found.'));
  }

  reportResults(results, Date.now() - startTime);

  return results;
}

async function runSource(files, source, options, results) {
  // Partition by layer (peek at module.exports without invoking run functions).
  const byLayer = { build: [], page: [], boot: [] };
  for (const file of files) {
    const layer = peekLayer(file) || 'build';
    if (byLayer[layer]) byLayer[layer].push(file);
  }

  // Build layer — run inline.
  if ((options.layer === 'all' || options.layer === 'build') && byLayer.build.length > 0) {
    for (const file of byLayer.build) {
      await runBuildFile(file, source, options, results);
    }
  }

  // Page layer — share one Chromium instance for all page-layer suites.
  const wantsPage = (options.layer === 'all' || options.layer === 'page') && byLayer.page.length > 0;

  if (wantsPage) {
    let runChromiumTests;
    try {
      ({ runChromiumTests } = require('./runners/chromium.js'));
    } catch (e) {
      console.log(chalk.yellow(`    ○ page tests skipped (chromium runner not available: ${e.message})`));
      results.skipped += byLayer.page.length;
    }
    if (runChromiumTests) {
      const projectRoot = process.cwd();
      const counts = await runChromiumTests({
        pageSuiteFiles: byLayer.page,
        filter: options.filter,
        projectRoot,
        ujmDistRoot: path.resolve(__dirname, '..'),
      });
      results.passed  += counts.passed;
      results.failed  += counts.failed;
      results.skipped += counts.skipped;
    }
  }

  // Boot layer — spawn Chromium pointed at consumer's built `_site/`.
  if ((options.layer === 'all' || options.layer === 'boot') && byLayer.boot.length > 0) {
    await runBootLayer(byLayer.boot, source, options, results);
  }
}

async function runBootLayer(files, source, options, results) {
  // Aggregate every boot test (whether standalone or inside a suite) into one flat list.
  // The boot harness runs them sequentially in a single Chromium process to keep startup
  // cost amortized. State doesn't carry across boot tests — each runs against a single
  // shared `site` (the consumer's built `_site/`).
  const tests = [];

  for (const file of files) {
    let mod;
    try {
      delete require.cache[require.resolve(file)];
      mod = require(file);
    } catch (e) {
      const rel = relativizePath(file, source);
      console.log(chalk.red(`    ✗ ${rel}`));
      console.log(chalk.red(`      Failed to load: ${e.message}`));
      results.failed += 1;
      continue;
    }

    if (Array.isArray(mod))                      mod = { type: 'group', tests: mod };
    if (Array.isArray(mod.tests))                {/* multi-test */ }
    else if (typeof mod.inspect === 'function')  mod = { tests: [mod] };

    const baseDescription = mod.description || relativizePath(file, source);

    for (const t of (mod.tests || [])) {
      if (typeof t.inspect !== 'function') continue;
      if (options.filter && !(t.description || baseDescription).includes(options.filter)) continue;
      tests.push({
        description: t.description || baseDescription,
        timeout:     t.timeout || mod.timeout || 20000,
        inspect:     t.inspect,
      });
    }
  }

  if (tests.length === 0) return;

  let runBootTests;
  try {
    ({ runBootTests } = require('./runners/boot.js'));
  } catch (e) {
    console.log(chalk.yellow(`    ○ boot tests skipped (boot runner not available: ${e.message})`));
    results.skipped += tests.length;
    return;
  }

  console.log(chalk.cyan('    ⤷ boot tests (consumer _site/)'));

  const projectRoot = process.cwd();
  const counts = await runBootTests({
    tests,
    projectRoot,
    ujmDistRoot: path.resolve(__dirname, '..'),
  });
  results.passed  += counts.passed;
  results.failed  += counts.failed;
  results.skipped += counts.skipped;
}

function peekLayer(file) {
  try {
    delete require.cache[require.resolve(file)];
    const mod = require(file);
    if (Array.isArray(mod)) return 'build';
    return mod.layer || 'build';
  } catch (e) {
    return null;
  }
}

async function runBuildFile(file, source, options, results) {
  let mod;
  try {
    delete require.cache[require.resolve(file)];
    mod = require(file);
  } catch (e) {
    const rel = relativizePath(file, source);
    console.log(chalk.red(`    ✗ ${rel}`));
    console.log(chalk.red(`      Failed to load: ${e.message}`));
    results.failed += 1;
    return;
  }

  if (Array.isArray(mod)) {
    mod = { type: 'group', tests: mod };
  }

  const rel = relativizePath(file, source);

  if (mod.skip) {
    const reason = typeof mod.skip === 'string' ? mod.skip : '';
    console.log(chalk.yellow(`    ○ ${mod.description || rel}`) + chalk.gray(` (skipped${reason ? ': ' + reason : ''})`));
    const count = Array.isArray(mod.tests) ? mod.tests.length : 1;
    results.skipped += count;
    return;
  }

  if (mod.type === 'suite' || mod.type === 'group' || Array.isArray(mod.tests)) {
    await runSuite(mod, rel, options, results);
  } else {
    await runStandalone(mod, rel, options, results);
  }
}

async function runSuite(suite, rel, options, results) {
  const description = suite.description || rel;
  const isGroup = suite.type === 'group';
  const stopOnFailure = !isGroup && suite.stopOnFailure !== false;
  const tests = suite.tests || [];

  console.log(chalk.cyan(`    ⤷ ${description}`));

  const state = {};

  for (let i = 0; i < tests.length; i += 1) {
    const t = tests[i];
    const name = t.name || `step-${i + 1}`;

    if (options.filter && !name.includes(options.filter) && !description.includes(options.filter)) continue;

    if (t.skip) {
      const reason = typeof t.skip === 'string' ? t.skip : '';
      console.log(chalk.yellow(`      ○ ${name}`) + chalk.gray(` (skipped${reason ? ': ' + reason : ''})`));
      results.skipped += 1;
      continue;
    }

    const ctx = createContext({ state, layer: suite.layer || 'build' });
    const timeout = t.timeout || suite.timeout || 30000;

    const start = Date.now();
    try {
      await Promise.race([
        Promise.resolve(t.run(ctx)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Test timeout')), timeout)),
      ]);
      const duration = Date.now() - start;
      console.log(chalk.green(`      ✓ ${name}`) + chalk.gray(` (${duration}ms)`));
      results.passed += 1;

      if (t.cleanup) {
        try { await t.cleanup(ctx); } catch (e) {
          console.log(chalk.yellow(`        ⚠ Cleanup failed: ${e.message}`));
        }
      }
    } catch (e) {
      const duration = Date.now() - start;
      if (e.name === 'SkipError') {
        console.log(chalk.yellow(`      ○ ${name}`) + chalk.gray(` (skipped: ${e.message})`));
        results.skipped += 1;
        continue;
      }
      console.log(chalk.red(`      ✗ ${name}`) + chalk.gray(` (${duration}ms)`));
      console.log(chalk.red(`        ${e.message || e}`));
      results.failed += 1;

      if (stopOnFailure) {
        const remaining = tests.length - i - 1;
        if (remaining > 0) {
          console.log(chalk.yellow(`        Skipping ${remaining} remaining test(s) in suite`));
          results.skipped += remaining;
        }
        break;
      }
    }
  }

  if (suite.cleanup) {
    try {
      const ctx = createContext({ state, layer: suite.layer || 'build' });
      await suite.cleanup(ctx);
    } catch (e) {
      console.log(chalk.yellow(`      ⚠ Suite cleanup failed: ${e.message}`));
    }
  }
}

async function runStandalone(mod, rel, options, results) {
  const description = mod.description || rel;
  if (options.filter && !description.includes(options.filter)) return;

  const ctx = createContext({ state: {}, layer: mod.layer || 'build' });
  const timeout = mod.timeout || 30000;

  const start = Date.now();
  try {
    await Promise.race([
      Promise.resolve(mod.run(ctx)),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Test timeout')), timeout)),
    ]);
    const duration = Date.now() - start;
    console.log(chalk.green(`    ✓ ${description}`) + chalk.gray(` (${duration}ms)`));
    results.passed += 1;

    if (mod.cleanup) {
      try { await mod.cleanup(ctx); } catch (e) {
        console.log(chalk.yellow(`      ⚠ Cleanup failed: ${e.message}`));
      }
    }
  } catch (e) {
    const duration = Date.now() - start;
    if (e.name === 'SkipError') {
      console.log(chalk.yellow(`    ○ ${description}`) + chalk.gray(` (skipped: ${e.message})`));
      results.skipped += 1;
      return;
    }
    console.log(chalk.red(`    ✗ ${description}`) + chalk.gray(` (${duration}ms)`));
    console.log(chalk.red(`      ${e.message || e}`));
    results.failed += 1;
  }
}

function createContext({ state, layer }) {
  return {
    expect,
    state,
    layer,
    skip(reason) { throw new SkipError(reason || 'skipped at runtime'); },
  };
}

function reportResults(results, durationMs) {
  const total = results.passed + results.failed + results.skipped;
  console.log('');
  console.log('  ' + chalk.bold('Results'));
  console.log(`    ${chalk.green(`${results.passed} passing`)}`);
  if (results.failed > 0)  console.log(`    ${chalk.red(`${results.failed} failing`)}`);
  if (results.skipped > 0) console.log(`    ${chalk.yellow(`${results.skipped} skipped`)}`);
  console.log(chalk.gray(`\n    Total: ${total} tests in ${durationMs}ms\n`));
}

function discoverTestFiles() {
  const framework = [];
  const project = [];

  // Detect whether we're running UJM's own framework self-tests, vs a consumer
  // who installed UJM and is running their own tests. Used below to filter the
  // boot/ layer of framework suites — those target UJM's internal fixture
  // _site/, so they only make sense when UJM tests itself.
  const isFrameworkSelfTest = (() => {
    try {
      const cwdPkg = require(path.join(process.cwd(), 'package.json'));
      return cwdPkg.name === 'ultimate-jekyll-manager';
    } catch (_) { return false; }
  })();

  // Framework default suites (relative to this file: dist/test/runner.js).
  // For consumers, we exclude boot/ — those suites assert on UJM's own fixture
  // site and would fail noisily when run against a real consumer's _site/.
  // Consumers write their own boot tests under <cwd>/test/boot/.
  const frameworkSuitesDir = path.join(__dirname, 'suites');
  if (jetpack.exists(frameworkSuitesDir)) {
    const ignore = ['_**'];
    if (!isFrameworkSelfTest) ignore.push('boot/**');
    glob('**/*.js', { cwd: frameworkSuitesDir, ignore }).sort().forEach((rel) => {
      framework.push(path.join(frameworkSuitesDir, rel));
    });
  }

  // Consumer project suites — CWD/test/**/*.js. Skip when running from inside the
  // framework's own dist tree (where consumer-tests-dir === framework-tests-parent).
  const projectTestsDir = path.join(process.cwd(), 'test');
  if (jetpack.exists(projectTestsDir) && projectTestsDir !== path.dirname(frameworkSuitesDir)) {
    glob('**/*.js', { cwd: projectTestsDir, ignore: ['_**'] }).sort().forEach((rel) => {
      project.push(path.join(projectTestsDir, rel));
    });
  }

  return { framework, project };
}

function relativizePath(file, source) {
  if (source === 'framework') {
    return path.relative(path.join(__dirname, 'suites'), file);
  }
  return path.relative(path.join(process.cwd(), 'test'), file);
}

module.exports = { run, SkipError };
