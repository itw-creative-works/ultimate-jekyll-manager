# Project Structure

UJM is a template framework that consuming projects install as an NPM module to build Jekyll sites quickly and efficiently. It provides best-practice configurations, default components, themes, and build tools.

> **UJM is NOT a standalone project.** You cannot run `npm start` or `npm run build` directly in this repository. The user already has a development server running in a consuming project — running those commands here would either fail or create duplicate servers unnecessarily. See [the Identity section in CLAUDE.md](../CLAUDE.md#identity) for what IS safe to run inside UJM itself.

## Directory Organization (UJM repo)

| Path | Purpose |
|---|---|
| `src/gulp/tasks` | Gulp tasks for building Jekyll sites |
| `src/defaults/src` | Default source files (editable by users, copied to consuming project's `src/`) |
| `src/defaults/dist` | Default distribution files (not editable by users, copied to consuming project's `dist/`) |
| `src/assets/css` | Stylesheets (global, pages, themes) |
| `src/assets/js` | JavaScript modules (core, pages, libraries) |
| `src/assets/themes` | Theme SCSS and JS files |

## Consuming Project Structure

| Path | Purpose |
|---|---|
| `src/` | Compiled to `dist/` via npm |
| `dist/` | Compiled to `_site/` via Jekyll |
