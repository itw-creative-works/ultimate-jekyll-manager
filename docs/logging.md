# Logging

UJM tees every line of CLI/pipeline output to log files in the consumer project root, so you can `tail -f` or `grep` a run instead of scrolling terminal scrollback. Frontend runtime logs live in the browser console — this doc covers the file logs UJM itself writes.

## Log files

All in `<projectRoot>/logs/`:

| File | Source | Lifetime |
|---|---|---|
| `dev.log` | Gulp pipeline output on `npm start` | Truncated each run |
| `build.log` | Gulp pipeline output on `npm run build` (`UJ_BUILD_MODE=true`) | Truncated each run |
| `test.log` | `npx mgr test` runner output (suite names, pass/fail states, timings) | Truncated each run |

`dev.log` and `build.log` are the same gulp tee — which one it writes is chosen by `UJ_BUILD_MODE`, so they never both fill up in one run.

## What gets captured

Everything that flows through stdout/stderr: `Manager.logger(...)` output, raw `console.log` calls, gulp task names, jekyll's child output, webpack output, the works. ANSI color codes are stripped from the file (grep-friendly); the terminal continues to receive colored output unchanged.

## Controls

**Skipped on CI/cloud.** When `UJ_IS_SERVER=true` (set by GitHub Actions workflows and other server contexts), the tee is bypassed entirely — no `logs/` directory is written.

Implementation: [src/utils/attach-log-file.js](../src/utils/attach-log-file.js), attached at the top of [src/gulp/main.js](../src/gulp/main.js) — same pattern as EM's `dev.log`/`build.log` and BXM's.

## See also

- [local-development.md](local-development.md) — dev server URL, emulator connection, PurgeCSS
- [test-framework.md](test-framework.md) — the test runner that feeds `test.log`
