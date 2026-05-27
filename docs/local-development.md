# Local Development

The local development server URL is stored in `.temp/_config_browsersync.yml` in the consuming project's root directory. Read this file to determine the correct URL for browsing and testing. By default, use `https://192.168.86.69:4000`.

## Log Files

UJM tees every line of stdout/stderr from the gulp pipeline into a log file in the consumer project root, so you can `tail -f` it or `grep` through it after a run:

- `npm start` → `logs/dev.log`
- `npm run build` (i.e. `UJ_BUILD_MODE=true`) → `logs/build.log`

Both files **truncate fresh on each run** — the most recent session only. ANSI color codes are stripped from the file (so it's grep-friendly); the terminal continues to receive colored output unchanged. Captures everything that flows through stdout/stderr: `Manager.logger(...)` output, raw `console.log` calls, gulp task names, jekyll's child output, webpack output, the works.

**Skipped on CI/cloud.** When `UJ_IS_SERVER=true` (set by GitHub Actions workflows and other server contexts), the tee is bypassed entirely — no `logs/` directory is written. Implementation: [src/utils/attach-log-file.js](../src/utils/attach-log-file.js), attached at the top of [src/gulp/main.js](../src/gulp/main.js).

## Connecting to Local Firebase Emulators

Set the `FIREBASE_EMULATOR_CONNECT` environment variable to `true` to connect the frontend to local Firebase services (Auth, Firestore, Functions, etc.):

```bash
FIREBASE_EMULATOR_CONNECT=true npm start
```

This value is written to `.temp/_config_browsersync.yml` under `web_manager.env.FIREBASE_EMULATOR_CONNECT` and made available to the frontend at build time.

## PurgeCSS

PurgeCSS runs automatically in production builds and can be enabled locally with `UJ_PURGECSS=true`. Consuming projects can add custom safelist patterns via `config/ultimate-jekyll-manager.json` under `sass.purgecss.safelist`:

```json5
{
  sass: {
    purgecss: {
      safelist: {
        standard: [],   // Matches against the full class name
        deep: [],       // Matches including child selectors (e.g., pseudo-selectors like :checked)
        greedy: [],     // Matches anywhere in the selector string
        keyframes: [],  // Preserves @keyframes animations by name
      },
    },
  },
}
```

**All entries are regex strings** — each gets converted to `new RegExp(entry)`. This means:

| Pattern | Matches | Does NOT match |
|---------|---------|----------------|
| `"^dot$"` | `dot` | `dotted`, `polkadot` |
| `"^chat-"` | `chat-bubble`, `chat-input` | `live-chat` |
| `"fw-semibold"` | `fw-semibold`, `fw-semibold-custom` | (matches loosely) |

**Use `^` and `$` anchors for exact matches.** Without them, the pattern matches any class *containing* the string.

**Example:**

```json5
{
  sass: {
    purgecss: {
      safelist: {
        standard: ["^dot$", "^fw-semibold$", "^chat-"],
        deep: [":focus-within"],
        greedy: ["^chat-"],
        keyframes: ["chat-typing-bounce"],
      },
    },
  },
}
```
