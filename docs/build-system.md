# Build System

UJM's build is a multi-stage gulp pipeline orchestrated by `src/gulp/main.js`, run from the consumer project (`npm start` for dev, `npm run build` for production).

## Pipeline overview

Build sequence:

```
defaults → distribute → parallel(webpack, sass, imagemin) → jsonToHtml → jekyll → audit → translation → minifyHtml
```

Dev sequence:

```
serve → build → developmentRebuild
```

## Gulp tasks

15 tasks live in `src/gulp/tasks/`: `defaults` / `distribute` / `webpack` / `sass` / `imagemin` / `jekyll` / `jsonToHtml` / `preprocess` / `audit` / `translation` / `minifyHtml` / `serve` / `setup` / `developmentRebuild`.

Pure helpers are exposed under [src/gulp/tasks/utils/](../src/gulp/tasks/utils/) (`merge-jekyll-configs`, `_validate-yaml`, `template-transform`, `collectTextNodes`, `dictionary`, `github-cache`, `formatDocument`) — these are the highest-value test targets (zero I/O, callable directly in `build`-layer tests).

## Config flow

Three config files in the consumer project feed the build:

1. **`src/_config.yml`** — Jekyll config (brand, theme, meta, web_manager). Read by `Manager.getConfig('project')`.
2. **`config/ultimate-jekyll-manager.json`** — UJM-specific config (purgecss safelist, webpack target, imagemin opts, distribute glob patterns). JSON5.
3. **`package.json`** — read by `Manager.getPackage('project')`.

UJM ships defaults via `_config_default.yml` + `_config_development.yml` at `src/config/` — merged at Jekyll build time via the `--config` chain by [merge-jekyll-configs.js](../src/gulp/tasks/utils/merge-jekyll-configs.js).

## Build modes

| Mode | Trigger | Effect |
|---|---|---|
| Development | `npm start` (default) | Serve + watch + incremental rebuild via `developmentRebuild` |
| Production | `npm run build` (`UJ_BUILD_MODE=true`) | Full pipeline incl. minifyHtml; PurgeCSS runs automatically |

PurgeCSS can be enabled locally with `UJ_PURGECSS=true`; consumer safelist patterns live in `config/ultimate-jekyll-manager.json` under `sass.purgecss.safelist`. See [local-development.md](local-development.md).

## Serve / live reload

The dev server URL is stored in `.temp/_config_browsersync.yml` in the consuming project root — read it to determine the correct URL for browsing/testing. See [local-development.md](local-development.md) for emulator connection (`FIREBASE_EMULATOR_CONNECT=true`).

## Log files

The gulp pipeline tees all output to `logs/dev.log` (`npm start`) / `logs/build.log` (`npm run build`). Full reference: [logging.md](logging.md).

## See also

- [templating.md](templating.md) — node-powertools bracket conventions in the pipeline
- [css.md](css.md) — SCSS structure + PurgeCSS
- [local-development.md](local-development.md) — dev server, emulators, PurgeCSS toggles
- [test-framework.md](test-framework.md) — testing the pipeline's pure helpers
