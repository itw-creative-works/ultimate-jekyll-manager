# PurgeCSS Safelist

PurgeCSS removes unused CSS in production builds. Classes added dynamically via JavaScript (e.g., `classList.add()`, `innerHTML` templates) won't be found in static HTML, so they get purged.

## IMPORTANT: Update Safelist When Writing Dynamic JS

**When writing JavaScript that dynamically adds CSS classes** (via `classList.add()`, `classList.toggle()`, `className =`, or `innerHTML` with class attributes), you MUST check if the class is already safelisted. If not, add it to the appropriate safelist:

- **UJM-internal classes** → `src/gulp/tasks/sass.js` safelist
- **Consuming project classes** → `config/ultimate-jekyll-manager.json` → `sass.purgecss.safelist`

**NEVER edit `dist/` or `node_modules/`.** Those are build outputs. Edit `src/` only.

## Two Safelist Locations

### 1. UJM Internal Safelist (sass.js)

**File:** `src/gulp/tasks/sass.js`

This is where UJM's own safelist lives — patterns for Bootstrap utilities, UJM core classes, and third-party injected elements. Uses native RegExp objects.

**Changes to sass.js require a dev server restart** — gulp tasks are loaded once at startup.

### 2. Consuming Project Safelist (JSON config)

**File:** `config/ultimate-jekyll-manager.json` → `sass.purgecss.safelist`

For consuming project-specific classes. Uses regex strings (converted to `new RegExp(s)` by UJM).

```json5
{
  sass: {
    purgecss: {
      safelist: {
        standard: [],  // Class names (converted to RegExp)
        deep: [],      // Pseudo-selector patterns
        greedy: [],    // Broader patterns (matches substrings)
        keyframes: [], // @keyframes animation names
      },
    },
  },
}
```

## PurgeCSS Gotchas

### `!` Negation patterns DON'T work in the content array

PurgeCSS passes each content pattern to `fast-glob` **individually** (not as a batch), so `!path/**` returns 0 files instead of excluding anything. Use `skippedContentGlobs` for exclusions instead.

### Option naming is counterintuitive

`true` = "yes, **purge** this category", `false` = "leave it alone":

| Option | `true` | `false` |
|--------|--------|---------|
| `variables` | Remove unused CSS variables | Don't touch variables |
| `keyframes` | Remove unused @keyframes | Don't touch keyframes |
| `fontFace` | Remove unused @font-face | Don't touch font-face |

### `variables` must stay `false`

PurgeCSS processes each CSS file independently. Page-specific CSS sets CSS custom properties (e.g., `--bs-btn-bg` in `.btn-paypal`) that are consumed by the base `.btn` class in the main bundle. With `variables: true`, these cross-file variable references are falsely flagged as unused and removed.

### PurgeCSS processes per-file, not per-bundle

Each CSS file is processed against the content files independently. A class defined in a page CSS file must be found in the content files on its own — it can't rely on being "seen" in the context of the main bundle.

## All Entries Are RegExp

Every entry in the consuming project safelist arrays is wrapped in `new RegExp(s)`. This means:

- `'dot'` becomes `/dot/` — matches ANY class containing "dot" (e.g., `dotted`, `polkadot`)
- **Always anchor exact class names** with `^...$`

### Correct Usage

```json5
{
  standard: ['^fw-semibold$'],             // Top-level exact matches
  deep: ['^dot$'],                         // Nested selectors (.chat-typing .dot)
  greedy: ['^chat-'],                      // Prefix match (all chat-* classes)
  keyframes: ['chat-typing-bounce'],       // Specific enough, no anchor needed
}
```

## Current UJM Safelist (sass.js)

Before adding classes, check what UJM already safelists in `src/gulp/tasks/sass.js`:

### Bootstrap Utilities
- `/^btn-/` — button variants
- `/^d-/` — display utilities
- `/^text-/` — text utilities
- `/^bg-/` — background utilities
- `/^flex-/` — flex utilities
- `/^justify-/`, `/^align-/` — alignment
- `/^position-/` — positioning
- `/^[mp][trblxy]?-[0-9]+$/` — margin/padding
- `/^w-/`, `/^h-/`, `/^mw-/`, `/^mh-/`, `/^min-/`, `/^max-/` — sizing
- `/^border-/`, `/^rounded-/`, `/^shadow-/` — borders/shadows
- `/^overflow-/`, `/^order-/` — overflow/order
- `/^fw-/` — font weight
- `/^ratio-/`, `/^object-/` — aspect ratio/object-fit
- `/^filter-/` — filter utilities

### Bootstrap Components
- `/^modal-/`, `/^carousel-/`, `/^dropdown-/`, `/^offcanvas-/`
- `/^tooltip-/`, `/^popover-/`, `/^toast-/`
- `/^accordion/`, `/^collapse/`, `/^collapsed$/`, `/^collapsing$/`
- `/^show$/`, `/^showing$/`, `/^hide$/`, `/^fade$/`, `/^active$/`, `/^disabled$/`
- `/^bs-/`, `/^data-bs-/`

### State & Dynamic Classes
- `/^is-/`, `/^has-/`, `/^was-/` — state classes
- `/^animation-/` — all animation-* classes

### Form & Validation
- `/^invalid-feedback$/` — form validation messages
- `/^spinner-/` — loading spinners
- `/^file-drop-/` — file drop zone states

### Libraries & Third-Party
- `/^fa-/` — Font Awesome
- `/^lazy-/` — lazy loading
- `/^cookie-consent-/` — cookie consent
- `/^social-share-/` — social sharing
- `/^grecaptcha/` — Google reCAPTCHA
- `/^adsbygoogle$/` — Google AdSense
- `/^uj-vert-unit$/` — UJM ad units
- `/^uptime-tooltip$/` — status page tooltip

### Also Safe: Classes in Static HTML

Classes that appear in any HTML file (includes, layouts, pages) are automatically found by PurgeCSS and won't be purged. Only classes created exclusively in JavaScript need safelisting.

## When to Use Each Category

| Category | Use For | Example |
|----------|---------|---------|
| `standard` | Top-level class selectors only in JS | `'^fw-semibold$'` or `/^fw-/` |
| `deep` | Classes used as **nested/descendant** selectors | `'^dot$'` (for `.chat-typing .dot`) |
| `greedy` | Prefix-based families of classes | `'^chat-'` (matches chat-row, chat-bubble, etc.) |
| `keyframes` | Custom @keyframes animation names | `'chat-typing-bounce'` |

### standard vs deep

- **standard**: Only preserves top-level selectors. If a class is ONLY used as a descendant (e.g., `.chat-typing .dot`), `standard` won't preserve the rule.
- **deep**: Preserves the entire rule tree when any part of the selector matches.

## Workflow

1. **Find dynamic classes**: Search JS files for `classList.add()`, `classList.toggle()`, `className =`, `innerHTML` with `class=`, template literals with classes
2. **Check safelist**: Cross-reference against the patterns above — don't add what's already covered
3. **Check static HTML**: If a class appears in any HTML file, it doesn't need safelisting
4. **Add to correct location**: UJM core classes → `sass.js`, consuming project classes → `config/ultimate-jekyll-manager.json`
5. **Group by prefix**: If multiple classes share a prefix, use a prefix pattern like `/^chat-/`
6. **Restart required**: Changes to `sass.js` require a dev server restart (gulp tasks load once at startup)

## See also

- [css.md](css.md) — CSS guidelines, theme-adaptive classes
- [build-system.md](build-system.md) — where the sass/purge task runs in the pipeline
- [themes.md](themes.md) — theme SCSS structure (theme classes ship in static CSS, not JS)
