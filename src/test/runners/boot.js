// Boot-runner — spawns Chromium pointed at the consumer's actually-built
// `_site/` via a tiny embedded HTTP server, runs `inspect` functions against
// the live site, then closes cleanly.
//
// Why a server (not file://)? Service workers don't register from file:// URLs
// — the whole point of boot tests is to catch SW registration / cache-name /
// activation regressions, so we serve over real http.
//
// `inspect` functions receive { site, page, expect, projectRoot } where:
//   site.baseUrl  — http://127.0.0.1:<port> root
//   site.port     — port the local server bound to
//   site.root     — absolute path to the served _site/ directory
//   page          — Puppeteer Page (fresh per test)
//   projectRoot   — absolute path to the consumer project root
//   expect        — same Jest-compatible expect() as build/page

const path  = require('path');
const fs    = require('fs');
const chalk = require('chalk').default;

const { startServer } = require('../server.js');

async function runBootTests({ tests, projectRoot, ujmDistRoot }) {
  if (tests.length === 0) return { passed: 0, failed: 0, skipped: 0 };

  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch (e) {
    console.log(chalk.yellow(`    ○ boot tests skipped (puppeteer not installed)`));
    return { passed: 0, failed: 0, skipped: tests.length };
  }

  // Locate the consumer's built `_site/`. Discovery order:
  //   1. UJ_TEST_BOOT_DIR (explicit absolute path) — full override
  //   2. UJ_TEST_BOOT_PROJECT/_site               — UJM self-test fixture path
  //   3. <projectRoot>/_site                       — default for UJM consumers
  const candidates = [];
  if (process.env.UJ_TEST_BOOT_DIR) candidates.push(path.resolve(process.env.UJ_TEST_BOOT_DIR));
  if (process.env.UJ_TEST_BOOT_PROJECT) candidates.push(path.join(path.resolve(process.env.UJ_TEST_BOOT_PROJECT), '_site'));
  candidates.push(path.join(projectRoot, '_site'));

  let siteRoot = null;
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'index.html'))) {
      siteRoot = dir;
      break;
    }
  }
  if (!siteRoot) {
    console.log(chalk.yellow(`    ○ boot tests skipped (no _site/index.html found in any of:`));
    for (const c of candidates) console.log(chalk.yellow(`        ${c}`));
    console.log(chalk.yellow(`      — run \`npm run build\` first to produce _site/)`));
    return { passed: 0, failed: 0, skipped: tests.length };
  }

  if (process.env.UJ_TEST_DEBUG) {
    console.log(chalk.gray(`      [boot] serving _site/ from ${siteRoot}`));
  }

  const expect = require('../assert.js');
  const counts = { passed: 0, failed: 0, skipped: 0 };

  const server = await startServer({ root: siteRoot });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  try {
    const site = {
      baseUrl: server.baseUrl,
      port:    server.port,
      root:    siteRoot,
    };

    for (const t of tests) {
      const start = Date.now();
      const page = await browser.newPage();
      try {
        await Promise.race([
          t.inspect({ site, page, expect, projectRoot }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Boot test timeout')), t.timeout || 20000)),
        ]);
        const duration = Date.now() - start;
        console.log(chalk.green(`      ✓ ${t.description}`) + chalk.gray(` (${duration}ms)`));
        counts.passed += 1;
      } catch (e) {
        const duration = Date.now() - start;
        console.log(chalk.red(`      ✗ ${t.description}`) + chalk.gray(` (${duration}ms)`));
        console.log(chalk.red(`        ${(e && e.message) || String(e)}`));
        counts.failed += 1;
      } finally {
        try { await page.close(); } catch (_) { /* ignore */ }
      }
    }
  } finally {
    try { await browser.close(); } catch (_) { /* ignore */ }
    try { await server.close(); } catch (_) { /* ignore */ }
  }

  return counts;
}

module.exports = { runBootTests };
