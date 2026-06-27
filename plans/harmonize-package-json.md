# Harmonize package.json across OMEGA frameworks

Cross-framework audit of package.json fields (UJM, BEM, BXM, EM, WM).

## Completed

### `files` field (allowlist replaces `.npmignore`)

All five frameworks now use `files` allowlists. `.npmignore` deleted from UJM and WM (the only two that had them). BEM, BXM, EM never had `.npmignore`.

| Framework | `files` |
|---|---|
| **UJM** | `dist/`, `bin/`, `docs/`, `assets/`, `CLAUDE.md` |
| **BEM** | `src/`, `dist/`, `bin/`, `docs/`, `CLAUDE.md` |
| **BXM** | `dist/`, `bin/`, `docs/`, `CLAUDE.md` |
| **EM** | `dist/`, `bin/`, `docs/`, `CLAUDE.md` |
| **WM** | `dist/`, `src/`, `docs/`, `CLAUDE.md` |

Notes:
- npm auto-includes `package.json`, `README.md`, `LICENSE`, `CHANGELOG.md`
- `CLAUDE.md` must be listed explicitly (not auto-included by npm)
- BEM includes `src/` because it has no compile step (`main` points to `src/manager/index.js`)
- WM includes `src/` because `"module": "src/index.js"` (ESM entry for bundlers)
- `scripts/` intentionally excluded everywhere (BEM's `scripts/.temp/` has sensitive data)

### Cross-reference with old `.npmignore`

- **UJM** `.npmignore` excluded: `.codeclimate.yml`, `/src/`, `/test/`, `/examples/`, `/old/`, `/_backup/`, `/_logos/`, `firebase-debug.log` — all still excluded by allowlist
- **WM** `.npmignore` excluded: `.codeclimate.yml`, `/src/`, `/test/`, `/examples/`, `/old/` — all still excluded except `src/` which is now intentionally included for the `module` field

## Issues to address

### 1. `private` field not set (all five)

None of the five frameworks have `"private": false` in package.json. All are published npm packages. Should explicitly set `"private": false` so tooling knows they're intentionally public. Currently the `/general:ship` skill's publish safety check flags missing `private` as an error.

### 2. `license` inconsistency

| Framework | License |
|---|---|
| UJM | MIT |
| BEM | ISC |
| BXM | MIT |
| EM | MIT |
| WM | CC-BY-4.0 |

BEM's `ISC` may be a leftover npm-init default. WM's `CC-BY-4.0` is intentional (attribution-required). Decide if BEM should be MIT for consistency.

### 3. `engines.node` inconsistency

| Framework | `engines.node` |
|---|---|
| UJM | `22` |
| BEM | `22` |
| BXM | `22` |
| EM | `24` |
| WM | `>=12` |

- WM's `>=12` is very loose — should probably be `22` to match the others
- EM's `24` is ahead of the rest — intentional? (Electron bundles its own Node)

### 4. BEM has no `exports` field

All other frameworks have `exports` for clean subpath resolution. BEM only has `main: "src/manager/index.js"`. Low priority since BEM consumers typically `require('backend-manager')` without subpaths, but adding `exports` would future-proof it.

### 5. `module` field

Only WM has `"module": "src/index.js"`. The others don't need it — WM is the only browser library consumed via bundlers where tree-shaking matters. The `module` field is legacy (modern tooling uses `exports` with conditional imports), but it works and doesn't hurt.
