# Audit Workflow

Auditing a UJM site runs in two stages: an AI-powered content pass over the source files, then the automated `npx mgr audit` tool with a systematic fix loop.

## Stage 1: Content Audit (source files)

1. **Locate all page source files** — `src/pages/**` and `src/_posts/**` (`.html` + `.md`).
2. **Enforce content conventions** — headings start with action verbs, sentence case, headline/accent structure (see [seo.md](seo.md#content-writing-rules-applies-to-all-pages)). Skip front matter (`meta.title` etc. are controlled by blueprints/layouts), test pages, and blog posts.
3. **Fix spelling and grammar** in body text — skip code blocks, attributes, URLs.
4. **XSS / HTML escaping audit** — flag unsafe `innerHTML` assignments; fix with `webManager.utilities().escapeHTML()` (+ `sanitizeURL` for URL sinks). See [xss-prevention.md](xss-prevention.md).
5. **Inline `<script>` audit (HARD RULE)** — scan all HTML under `src/` for inline script bodies and move them per the playbook in [no-inline-scripts.md](no-inline-scripts.md).
6. **Summarize** — list files scanned and fixes applied before moving to stage 2.

## Stage 2: Automated Audit (`npx mgr audit`)

1. **Ask the user** whether to run the audit or whether they've already run it; run `npx mgr audit` if needed.
2. **Locate results** in `.temp/audit/` and read every file COMPLETELY — audit files are large; don't plan from a skim.
3. **Create a TODO list** — break fixes into atomic tasks, organized by category and priority.
4. **Fix systematically** — one issue at a time: mark in-progress → navigate → understand root cause → fix → verify → mark complete. Work one category at a time; do NOT attempt to fix everything at once.
5. **Re-run `npx mgr audit`** after each batch — confirm fixed issues are resolved and no new issues appeared.

## Source

- Audit task implementation: [`src/gulp/tasks/audit.js`](../src/gulp/tasks/audit.js)
- Results land in `<projectRoot>/.temp/audit/`

## See also

- [seo.md](seo.md) — the content conventions stage 1 enforces
- [xss-prevention.md](xss-prevention.md) — escaping rules
- [no-inline-scripts.md](no-inline-scripts.md) — the inline-script migration playbook
