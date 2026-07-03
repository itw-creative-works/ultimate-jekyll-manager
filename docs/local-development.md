# Local Development

The exact local dev server URL is written to `.temp/_config_browsersync.yml` in the consuming project's root directory — always read it, never guess. BrowserSync serves over HTTPS (self-signed cert). Prefer `https://localhost:4000`; fall back to the machine's local network IP (e.g. `https://192.168.x.x:4000`) if localhost doesn't connect. Port 4000 by default, increments to 4001+ when multiple sites run simultaneously.

## Log Files

The gulp pipeline tees all output to `logs/dev.log` (`npm start`) / `logs/build.log` (`npm run build`), and `npx mgr test` tees to `logs/test.log`. Full reference — file table, capture behavior, CI skip via `UJ_IS_SERVER`: [logging.md](logging.md).

## Connecting to Local Firebase Emulators

Set the `FIREBASE_EMULATOR_CONNECT` environment variable to `true` to connect the frontend to local Firebase services (Auth, Firestore, Functions, etc.):

```bash
FIREBASE_EMULATOR_CONNECT=true npm start
```

This value is written to `.temp/_config_browsersync.yml` under `web_manager.env.FIREBASE_EMULATOR_CONNECT` and made available to the frontend at build time.

## Dev Query Parameters (`_dev_*`)

Pages accept `_dev_` prefixed query parameters to simulate hard-to-reach states without real backend/OAuth interactions. These only affect frontend behavior — no data is written.

### Auth pages (`/signin`, `/signup`, `/reset`)

| Parameter | Values | Behavior |
|---|---|---|
| `_dev_simulateRedirect` | `true`, `success` | Simulates a successful OAuth redirect: 2s loading state → login tracking + success message. Auth state listener handles navigation. |
| | `signup` | Simulates a new-user OAuth redirect: 2s loading → signup tracking + success. On `/signin`, triggers `reverseAccidentalSignup` (the Google auto-creation reversal flow). |
| | `error` | Simulates an OAuth error (`auth/account-exists-with-different-credential`): 2s loading → error message → form re-enables. |

All three modes exercise the real `handleRedirectResult()` code paths — the simulation injects fake data into the same tracking, error handling, and form state transitions that a real OAuth redirect uses.

### Other pages

| Parameter | Page | Behavior |
|---|---|---|
| `_dev_prefill` | `/account/security`, `/account/referrals` | Pre-fills form with fake data |
| `_dev_trialEligible` | `/payment/checkout` | Overrides trial eligibility check |
| `_dev_preDelay` | `/payment/checkout` | Adds a delay before checkout init |
| `_dev_cardProcessor` | `/payment/checkout` | Forces a specific card processor |
| `_dev_recaptcha` | `/payment/checkout` | Overrides reCAPTCHA behavior |
| `_dev_subscription` | `/account` | Overrides subscription state |

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
