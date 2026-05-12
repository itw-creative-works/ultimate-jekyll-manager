// Chromium-runner — launches Puppeteer, serves the harness HTML page from a
// tiny embedded HTTP server, runs page-layer suites in the tab via
// `page.evaluate(payload)`. Mirrors BXM's runners/chromium.js shape but UJM
// has no extension/SW layer — only a `page` layer.
//
// Communication channel: each injected test wraps its events as
//   console.log('__UJM_TEST__' + JSON.stringify(evt))
// from inside the tab. The runner subscribes to Puppeteer's `page.on('console')`
// and parses those lines exactly like EM/BXM parse stdout/SW console. Same
// JSON-line protocol — different transport.
//
// Test source is shipped as a string. Each test's `run` function body is
// extracted at load-time and wrapped as `(async (ctx) => { <body> })(ctx)`
// inside an outer harness that constructs `ctx` + `expect` from inline
// assert.js source. The body has no closure to its file — it must `require`
// nothing and rely only on `ctx` + globals (`window`, `document`, etc.).

const path = require('path');
const fs   = require('fs');
const chalk = require('chalk').default;

const { startServer } = require('../server.js');

// Inline the source of assert.js so we can build it into the injected harness
// payload. The runner reads it from disk once at module-load time.
const ASSERT_SRC = fs.readFileSync(path.join(__dirname, '..', 'assert.js'), 'utf8');

async function runChromiumTests({ pageSuiteFiles, filter, projectRoot, ujmDistRoot }) {
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch (e) {
    console.log(chalk.yellow(`    ○ page tests skipped (puppeteer not installed)`));
    return { passed: 0, failed: 0, skipped: pageSuiteFiles.length };
  }

  const harnessDir = path.join(ujmDistRoot, 'test', 'harness', 'page');
  if (!fs.existsSync(path.join(harnessDir, 'index.html'))) {
    console.log(chalk.yellow(`    ○ page tests skipped (harness not built at ${harnessDir})`));
    return { passed: 0, failed: 0, skipped: pageSuiteFiles.length };
  }

  const counts = { passed: 0, failed: 0, skipped: 0 };

  const server = await startServer({ root: harnessDir });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  try {
    for (const file of pageSuiteFiles) {
      let mod;
      try {
        delete require.cache[require.resolve(file)];
        mod = require(file);
      } catch (e) {
        console.log(chalk.red(`    ✗ ${file}: Failed to load: ${e.message}`));
        counts.failed += 1;
        continue;
      }
      if (Array.isArray(mod)) mod = { type: 'group', tests: mod };
      if (mod.layer !== 'page') continue;

      const suiteName = mod.description || path.basename(file);
      console.log(chalk.cyan(`    ⤷ ${suiteName}`));

      if (mod.skip) {
        const count = Array.isArray(mod.tests) ? mod.tests.length : 1;
        console.log(chalk.yellow(`      ○ ${suiteName}`) + chalk.gray(` (skipped)`));
        counts.skipped += count;
        continue;
      }

      const isSuite = mod.type === 'suite' || mod.type === 'group' || Array.isArray(mod.tests);
      const tests   = isSuite ? (mod.tests || []) : [{ name: suiteName, run: mod.run, timeout: mod.timeout }];
      const isGroup = mod.type === 'group';
      const stopOnFailure = !isGroup && isSuite && mod.stopOnFailure !== false;

      const page = await browser.newPage();
      const consoleHandler = (msg) => {
        const text = msg.text();
        if (text.startsWith('__UJM_TEST__')) {
          handleConsoleLine(text, counts);
        } else if (process.env.UJ_TEST_DEBUG) {
          process.stdout.write(chalk.gray(`      [tab:${msg.type()}] ${text}\n`));
        }
      };
      page.on('console', consoleHandler);

      try {
        await page.goto(server.baseUrl + '/', { waitUntil: 'domcontentloaded' });
        const payload = buildSuitePayload({ suiteName, tests, filter, stopOnFailure, timeout: mod.timeout });
        await page.evaluate(payload);
      } catch (e) {
        console.log(chalk.red(`      ✗ ${suiteName}: harness threw: ${e.message}`));
        counts.failed += tests.length;
      } finally {
        page.off('console', consoleHandler);
        try { await page.close(); } catch (_) { /* ignore */ }
      }
    }
  } finally {
    try { await browser.close(); } catch (_) { /* ignore */ }
    try { await server.close(); } catch (_) { /* ignore */ }
  }

  return counts;
}

// ─── Suite payload builder ────────────────────────────────────────────────────

// Build a single string of JavaScript that, when evaluated inside the tab,
// runs all `tests` sequentially and emits __UJM_TEST__ events per result.
//
// Why string-payload vs function-passing? Puppeteer can pass functions, but
// `page.evaluate(fn, ...args)` serializes args via JSON (no functions). So
// every test function body must be string-ified and rebuilt inside the target
// context. We do that here, baking each body as a literal async-function
// expression at runner build-time. (Same pattern BXM uses to satisfy MV3 CSP;
// in plain pages CSP is laxer, but the pattern is portable and avoids any
// eval/Function-constructor surprises if a consumer adds CSP later.)
function buildSuitePayload({ suiteName, tests, filter, stopOnFailure, timeout: suiteTimeout }) {
  const inlinedTests = tests
    .filter((t) => !filter || (t.name && t.name.includes(filter)) || suiteName.includes(filter))
    .map((t) => {
      const body  = extractFnBody(t.run);
      const skip  = t.skip ? JSON.stringify(t.skip) : 'false';
      const tout  = t.timeout || suiteTimeout || 30000;
      return `  { name: ${JSON.stringify(t.name || suiteName)}, skip: ${skip}, timeout: ${tout}, fn: async (ctx, expect, state) => {\n${body}\n} },`;
    })
    .join('\n');

  // assert.js declares `function expect(...) { ... }` at the top level. We strip its
  // `module.exports = expect` line (no `module` in the browser) and keep the function
  // declaration available as the local `expect`.
  return `
(async function () {
  'use strict';
  ${ASSERT_SRC.replace(/module\.exports\s*=\s*expect;?/, '')}

  function emit(evt) {
    console.log('__UJM_TEST__' + JSON.stringify(evt));
  }

  class SkipError extends Error { constructor(reason) { super(reason); this.name = 'SkipError'; } }

  const suiteName  = ${JSON.stringify(suiteName)};
  const stopOnFail = ${JSON.stringify(!!stopOnFailure)};
  const tests = [
${inlinedTests}
  ];

  emit({ event: 'suite-start', name: suiteName });

  const state = {};
  let passed = 0, failed = 0, skipped = 0;

  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
    if (t.skip) {
      const reason = typeof t.skip === 'string' ? t.skip : 'skipped';
      emit({ event: 'skip', name: suiteName + ' → ' + t.name, reason });
      skipped += 1;
      continue;
    }

    const ctx = {
      expect,
      state,
      layer: 'page',
      skip(reason) { throw new SkipError(reason || 'skipped at runtime'); },
    };

    const start = Date.now();
    try {
      await Promise.race([
        t.fn(ctx, expect, state),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Test timeout')), t.timeout)),
      ]);
      const duration = Date.now() - start;
      emit({ event: 'result', name: t.name, passed: true, duration });
      passed += 1;
    } catch (e) {
      const duration = Date.now() - start;
      if (e && e.name === 'SkipError') {
        emit({ event: 'skip', name: suiteName + ' → ' + t.name, reason: e.message });
        skipped += 1;
        continue;
      }
      emit({ event: 'result', name: t.name, passed: false, duration, error: (e && e.message) || String(e) });
      failed += 1;
      if (stopOnFail) {
        const rem = tests.length - i - 1;
        if (rem > 0) { emit({ event: 'suite-stopped', name: suiteName, remaining: rem }); skipped += rem; }
        break;
      }
    }
  }

  emit({ event: 'suite-end', name: suiteName, passed, failed, skipped });
})();
`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function handleConsoleLine(text, counts) {
  let evt;
  try { evt = JSON.parse(text.slice('__UJM_TEST__'.length)); } catch (_) { return; }
  if (evt.event === 'result') {
    if (evt.passed) {
      console.log(chalk.green(`      ✓ ${evt.name}`) + chalk.gray(` (${evt.duration}ms)`));
      counts.passed += 1;
    } else {
      console.log(chalk.red(`      ✗ ${evt.name}`) + chalk.gray(` (${evt.duration}ms)`));
      if (evt.error) console.log(chalk.red(`        ${evt.error}`));
      counts.failed += 1;
    }
  } else if (evt.event === 'skip') {
    console.log(chalk.yellow(`      ○ ${evt.name}`) + chalk.gray(` (skipped: ${evt.reason})`));
    counts.skipped += 1;
  } else if (evt.event === 'suite-stopped') {
    console.log(chalk.yellow(`        Skipping ${evt.remaining} remaining test(s) in suite`));
  } else if (evt.event === 'suite-end' || evt.event === 'suite-start') {
    // No-op — suite framing already printed by the parent before evaluate().
  }
}

// Extract the body of a function as a string. Handles arrow / async arrow /
// named function / async named function forms. Used to ship test bodies into
// the tab via page.evaluate.
function extractFnBody(fn) {
  if (typeof fn !== 'function') return 'throw new Error("test has no run() function");';
  const src = fn.toString();
  // Arrow with block body
  let m = src.match(/^\s*(?:async\s+)?\([^)]*\)\s*=>\s*\{([\s\S]*)\}\s*$/);
  if (m) return m[1];
  // Arrow with expression body
  m = src.match(/^\s*(?:async\s+)?\([^)]*\)\s*=>\s*([\s\S]+)$/);
  if (m) return `return ${m[1].trim()};`;
  // Named / anonymous function
  m = src.match(/^\s*(?:async\s+)?function\s*[a-zA-Z0-9_]*\s*\([^)]*\)\s*\{([\s\S]*)\}\s*$/);
  if (m) return m[1];
  // Method shorthand
  m = src.match(/^[^(]*\([^)]*\)\s*\{([\s\S]*)\}\s*$/);
  if (m) return m[1];
  return `return (${src}).call(null, ctx);`;
}

module.exports = { runChromiumTests };
