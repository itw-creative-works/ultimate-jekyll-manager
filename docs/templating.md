# Templating

UJM uses node-powertools' `template()` for build-time token replacement, alongside (and deliberately distinct from) Jekyll's own Liquid templating.

## How it works

Two bracket conventions, chosen per call site so node-powertools tokens never collide with Liquid:

| Brackets | Used by | Files |
|---|---|---|
| `{ x }` (node-powertools default) | Any `template()` call without a `brackets:` option — e.g. `defaults.js` Gemfile templating | Gemfile, scaffolded defaults |
| `[ x ]` | `distribute.js` theme fallback + [template-transform.js](../src/gulp/tasks/utils/template-transform.js) | `.html` / `.md` / `.liquid` / `.json` |

## Liquid coexistence

Jekyll's Liquid `{{ }}` / `{% %}` is processed by **Jekyll itself**, NOT by node-powertools — those placeholders pass through node-powertools untouched. The square-bracket convention exists precisely so the two engines can template the same file without fighting.

Corollary for consumer JS: Jekyll does NOT process `src/assets/js/**/*.js` — never leave Liquid tokens inside JS modules; bridge values via `data-*` attributes or `<template>` elements instead. See [common-mistakes.md](common-mistakes.md).

## See also

- [build-system.md](build-system.md) — where the templating passes run in the pipeline
- [layouts-and-pages.md](layouts-and-pages.md) — Liquid-side layout/frontmatter reference
