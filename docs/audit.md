# Audit Workflow

Full-project audit for UJM — runs against a CONSUMER site or the FRAMEWORK repo itself (scope auto-detected). Invoked via the `omega:ujm` skill (`/omega:ujm audit`) or any "audit this site/project" request.

Every check has a stable ID, a severity, and a scope. Findings are reported as `ID @ file:line`, fixed one at a time, then re-verified. The tables below do NOT restate the rules — each check links to the doc that owns the rule and the fix.

## Protocol

1. **Detect scope** — read `package.json`: `name` is `ultimate-jekyll-manager` → **framework audit** (U + UJM + F checks); `ultimate-jekyll-manager` in (dev)dependencies → **consumer audit** (U + UJM checks).
2. **Run the catalog** — every check matching the scope. Search with Grep/Glob/Read over `src/` (+ `test/`, config files); ALWAYS exclude `dist/`, `node_modules/`, `_site/`, `_legacy/`, `_backup/`, `.temp/`, `.cache/`. Record each finding as `ID @ file:line` + a one-line description.
3. **Persist the report** — write the findings list to `.temp/audit/claude-audit.md` (the same scratch dir `npx mgr audit` uses) so a long fix loop survives session breaks. Summarize counts by severity in chat.
4. **Fix loop** — TodoWrite per finding, highest severity first, ONE at a time: mark in-progress → root cause → fix → verify → complete. Ask before structural or destructive fixes (file deletions, layout swaps, data changes).
5. **Re-verify** — re-run every check that produced findings until clean; finish with `npx mgr test` (must be green).
6. **Doc parity** — if fixes changed behavior, update README / CLAUDE.md / `docs/<topic>.md` / CHANGELOG in the same change set.

Severity: **CRIT** security or broken functionality · **HIGH** hard-rule violation · **MED** convention drift · **LOW** optional improvement.
Scope: **C** consumer · **F** framework repo · **B** both.

## Universal checks (U-xx)

Mirrored across all four OMEGA frameworks (UJM / BEM / BXM / EM) — same ID means the same check everywhere.

| ID | Sev | Scope | Check |
|----|-----|-------|-------|
| U-01 | HIGH | B | Every feature has tests at EVERY layer it surfaces (build / page / boot) — never mocked ([test-framework.md](test-framework.md)) |
| U-02 | HIGH | B | Test hygiene — real-external-API tests gated behind `TEST_EXTENDED_MODE` in-source (not mocked); no tests that assert nothing ([test-framework.md](test-framework.md)) |
| U-03 | CRIT | B | XSS — inline `webManager.utilities().escapeHTML(value)` at EVERY DOM sink, `sanitizeURL(url)` at executable URL sinks, zero local escape helpers ([xss-prevention.md](xss-prevention.md)) |
| U-04 | HIGH | B | web-manager owns Firebase — no direct `firebase` imports anywhere; `webManager.auth()` / `.firestore()` ([javascript-libraries.md](javascript-libraries.md)) |
| U-05 | HIGH | C | No UJM transitive deps installed in the consumer `package.json` (`firebase`, `web-manager`, …) — webpack `resolve.modules` resolves them ([common-mistakes.md](common-mistakes.md)) |
| U-06 | HIGH | B | Env behavior gated on the INTENTIONAL check — `isProduction()` or `isDevelopment() \|\| isTesting()`, never `!isDevelopment()`; no ad-hoc `process.env.UJ_*` reads where a helper exists ([environment-detection.md](environment-detection.md)) |
| U-07 | HIGH | B | Config canon — `src/_config.yml` + `config/ultimate-jekyll-manager.json` match the documented shapes; canonical cross-framework blocks (`brand`, flat 8-key `firebaseConfig`, …) not reinvented ([CLAUDE.md](../CLAUDE.md) §Config flow) |
| U-08 | CRIT | B | No private credentials committed — `.env`, tokens, secret keys; `.gitignore` covers them. (The Firebase WEB `apiKey` is public by design — do NOT flag it.) |
| U-09 | HIGH | B | Source discipline — nothing edited in `dist/` / `_site/`; no live code referencing `_legacy/` / `_backup/` ([common-mistakes.md](common-mistakes.md)) |
| U-10 | MED | B | Doc parity — README / CLAUDE.md / `docs/` / CHANGELOG match shipped behavior; CLAUDE.md < 250 lines; the docs index lists every `docs/*.md`; no stale names for renamed commands/patterns |
| U-11 | MED | B | SSOT/DRY — no duplicated constants/config/logic; one authoritative home per value, imported everywhere else |
| U-12 | MED | B | JS conventions — file structure, JSDoc, short-circuit returns, leading logical operators, `fs-jetpack`, one `module.exports` per file (global `js:patterns` skill + [CLAUDE.md](../CLAUDE.md) §File Conventions) |
| U-13 | MED | B | Dead code & stale patterns — no orphaned `src/` files nothing imports; no leftovers of migrated-away formats ([migration.md](migration.md)); inventory TODO/FIXME (report only) |
| U-14 | LOW | B | Dependency health — review `npm outdated` / `npm audit`; apply fixes via the `general:update-packages` workflow (includes supply-chain checks) |

## UJM-specific checks

| ID | Sev | Scope | Check |
|----|-----|-------|-------|
| UJM-01 | CRIT | B | ZERO inline `<script>` bodies in HTML under `src/` — JS belongs in page modules / `main.js`; migrate per the playbook ([no-inline-scripts.md](no-inline-scripts.md)) |
| UJM-02 | HIGH | B | Bootstrap-first markup; NO theme-prefixed (`<themeid>-*`) classes in pages/includes — theme SCSS restyles universal classes ([themes.md](themes.md), [css.md](css.md)) |
| UJM-03 | MED | C | Content writing rules — action-verb headings, sentence case, headline/accent structure; skip front matter, test pages, and blog posts ([seo.md](seo.md#content-writing-rules-applies-to-all-pages)) |
| UJM-04 | MED | C | Spelling and grammar in body text — skip code blocks, attributes, URLs |
| UJM-05 | HIGH | C | SEO meta — custom pages carry `meta.title` / `meta.description`; default pages customize via frontmatter per the per-page levels table ([layouts-and-pages.md](layouts-and-pages.md), [seo.md](seo.md)) |
| UJM-06 | HIGH | B | PurgeCSS — every dynamically-added JS class is safelisted ([purgecss.md](purgecss.md)) |
| UJM-07 | HIGH | C | Reads-vs-writes — Firestore SDK for dashboard READS only; all WRITES go through Cloud Functions ([javascript-libraries.md](javascript-libraries.md)) |
| UJM-08 | HIGH | B | Page JS pattern — modules at `src/assets/js/pages/<path>/index.js` with element-existence guards; forms via FormManager; no Liquid in JS (use `data-*` / `<template>` bridges) ([assets.md](assets.md), [page-loading.md](page-loading.md), [no-inline-scripts.md](no-inline-scripts.md)) |
| UJM-09 | MED | C | Images — imagemin source-size constraints respected, `data-lazy` lazy loading used, `@post/` shortcut in blog posts ([images.md](images.md), [lazy-loading.md](lazy-loading.md)) |
| UJM-10 | MED | B | Accessibility basics — meaningful `alt` text, labeled form fields, real `<button>`/`<a>` elements (no clickable `div`s) |

## Automated stage: `npx mgr audit`

After (or alongside) the catalog, run UJM's built-in audit tool — HTML validation + spellcheck + optional Lighthouse:

1. **Ask the user** whether to run it or whether they've already run it; run `npx mgr audit` if needed.
2. **Read EVERY file in `.temp/audit/` COMPLETELY** — audit outputs are large; don't plan from a skim.
3. **Fold the findings into the same TodoWrite fix loop** — one category at a time; do NOT attempt everything at once.
4. **Re-run `npx mgr audit` after each batch** — confirm fixed issues resolved and no new ones appeared.

Implementation: [`src/gulp/tasks/audit.js`](../src/gulp/tasks/audit.js); results land in `<projectRoot>/.temp/audit/`.

## Framework-repo checks (F-xx)

Only when auditing the UJM repo itself. Mirrored across the four frameworks.

| ID | Sev | Check |
|----|-----|-------|
| F-01 | MED | Sister parity — mirrored sections (config shapes, test contract, CLAUDE.md skeleton, shared env/test conventions) in sync with BEM / BXM / EM; deviations are deliberate and documented |
| F-02 | HIGH | Consumer-shipped defaults in sync — what `npx mgr setup` scaffolds matches current conventions and docs |
| F-03 | MED | Docs completeness — every `docs/*.md` indexed in CLAUDE.md; every subsystem has a doc; no "(planned)" links for things that have shipped |
| F-04 | HIGH | `npx mgr test mgr:` green before treating the audit as complete |

## See also

- [seo.md](seo.md) — the content conventions UJM-03 enforces
- [xss-prevention.md](xss-prevention.md) — the escaping rules behind U-03
- [no-inline-scripts.md](no-inline-scripts.md) — the UJM-01 migration playbook
- [test-framework.md](test-framework.md) — the layers behind U-01 / U-02
