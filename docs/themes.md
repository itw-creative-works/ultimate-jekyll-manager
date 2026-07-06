# Themes

How UJM's theme system works, and how to author a theme — either **inside UJM**
(shipped to every consumer) or **in a consumer project** (that project only).

A theme controls the **visual language** (colors, type, borders, shadows,
component styling) and optionally the **markup** of specific pages. It does NOT
need to re-implement the framework's shared behavior — that is injected for every
theme automatically (see [Shared vs per-theme](#shared-vs-per-theme)).

Shipped themes live in [src/assets/themes/](../src/assets/themes/):

- **`bootstrap/`** — the base layer: Bootstrap 5 SCSS/JS + universal `overrides/`
  every theme inherits. Not selected directly.
- **`classy/`** — the default, full-featured frontend theme. Also the **layout
  fallback source** (see below).
- **`neobrutalism/`** — bold high-contrast theme (hard borders, offset shadows,
  zero radius). A worked example of a second theme.
- **`newsflash/`** — editorial news-site theme (paper + ink + vermilion, serif
  headlines, live ticker, reading progress). The worked example of a
  **genre-specific** theme: news-native frontmatter defaults, news-purposed
  homepage sections (`latest`, `rundown`, `desks`, `more_stories`), membership-tier pricing, desk/topic
  archives (blog categories + tags), and a newsroom masthead (team + reporter
  profile pages). Functional pages (download, feedback, updates, auth, account)
  intentionally ride the classy fallback — their structure is the feature, and
  the theme CSS restyles them.
- **`_template/`** — a copy-paste starter for new themes (the `_` prefix excludes
  it from selection).

---

## How a theme is selected and loaded

A consumer picks a theme with one field in `src/_config.yml`:

```yaml
theme:
  id: "neobrutalism"     # folder name under assets/themes/
  appearance: "light"    # light | dark | system  → sets <html data-bs-theme>
```

Three resolution mechanisms turn that id into a built site:

### 1. SCSS (`__theme__` via loadPaths)

The consumer's `src/assets/css/main.scss` does `@use 'ultimate-jekyll-manager' as *;`.
That entry point ([src/assets/css/ultimate-jekyll-manager.scss](../src/assets/css/ultimate-jekyll-manager.scss))
does `@forward 'theme'`. The SASS task resolves the bare `theme` import via
`loadPaths`, in priority order
([src/gulp/tasks/sass.js](../src/gulp/tasks/sass.js)):

1. `<project>/src/assets/themes/<id>/` ← **project shadows package**
2. `<package>/dist/assets/themes/<id>/` ← UJM's built-in theme
3. `<package>/dist/assets/themes/` ← lets a theme `@import '../bootstrap/...'`

So `_theme.scss` is found in the project's theme dir first, else UJM's. You never
import a theme by hard path — let loadPaths resolve it.

### 2. JS (`__theme__` webpack alias)

`ultimate-jekyll-manager.js` does `import('__theme__/_theme.js')`. The webpack
alias ([src/gulp/tasks/webpack.js](../src/gulp/tasks/webpack.js)) resolves
`__theme__` to the project theme dir if it exists, else UJM's package theme dir —
same project-shadows-package rule as SCSS.

### 3. Layouts & includes (the classy fallback)

This is the key to **not duplicating ~40 page layouts**. Theme HTML lives under:

- `src/defaults/dist/_layouts/themes/<id>/...`
- `src/defaults/dist/_includes/themes/<id>/...`

During build, `copyFallbackThemeFiles()`
([src/gulp/tasks/distribute.js](../src/gulp/tasks/distribute.js)) copies every
layout/include from the **`classy`** theme that the selected theme hasn't defined,
rewriting `themes/classy/` → `themes/<id>/` in the content. Layouts also use the
`themes/[ site.theme.id ]/...` template variable, which distribute resolves to the
active theme.

**Result:** a new theme inherits all of classy's pages for free and overrides
**only** the files whose *markup* must differ. You saw this in the build log:

```
Copied 48 fallback files from 'classy' to 'neobrutalism' theme
```

> Because classy is the fallback source, **keep classy's layouts theme-agnostic**
> (semantic Bootstrap classes, data-driven includes). Every other theme inherits
> them.

#### When to override a layout vs just restyle with CSS

Most of the time you do NOT override layouts — you restyle Bootstrap's classes
(see [Shared vs per-theme](#shared-vs-per-theme)) and the inherited classy markup
adopts your look. Override a layout only when the **structure itself** must differ.

The `neobrutalism` theme demonstrates both. It restyles classy's markup everywhere
EXCEPT the homepage and pricing page, where it ships genuinely different structure
(asymmetric split hero, offset showcase rows, oversized color-block stats) at
`_layouts/themes/neobrutalism/frontend/pages/{index,pricing}.html`. When you
override a page layout, **preserve any data-resolution Liquid** (the pricing
product-matching, paginator loops, `uj_post`/`uj_member` resolution) and keep the
**universal section keys** (`hero`, `cta`, `stats`, `faqs`, `testimonials`,
`newsletter`, `trusted_by`, `pricing.plans`) so a consumer's existing page
frontmatter keeps working across theme swaps — but write your own defaults and
structure for everything else (next section).

#### Frontmatter defaults are part of the theme's identity

Every theme page layout ships **default frontmatter** that renders when a
consumer page doesn't override it. Those defaults are not filler — they are the
theme's out-of-the-box voice, and **they MUST be written for the theme's genre,
NOT copied from classy.** Themes serve different purposes: classy/neobrutalism
are SaaS-product themes, `newsflash` is a news-site theme. A new theme's default
copy, section names, and demo data should read like the kind of site the theme
is for.

Concretely, when authoring a theme's page layouts:

1. **Write genre-native default values for every key.** A news theme's homepage
   hero pitches the publication ("News with a pulse", "Read the latest" →
   `/blog`), its pricing page sells reader memberships (`Reader` / `Supporter` /
   `Insider` tiers funding the journalism), its contact page has a tips line and
   a corrections subject — not "Technical support" and "API access". See
   `_layouts/themes/newsflash/frontend/pages/*.html` for the reference example.
2. **Keep universal keys universal.** Concepts that exist on any site keep the
   shared names — `hero`, `cta`, `stats`, `faqs`, `testimonials`, `newsletter`,
   `trusted_by`, and the `pricing` engine block — so consumer overrides survive
   a theme swap.
3. **Genre-specific sections get genre-specific keys.** When a section only
   makes sense for the theme's genre, name the key for what it means there
   instead of force-fitting classy's vocabulary: newsflash's homepage replaces
   classy's `showcase`/`features` with `latest` (the front-page post feed),
   `rundown` (the newsroom's numbered playbook), `desks` (coverage areas), and
   `more_stories` (extra story tiles). Consumers customizing those sections
   write frontmatter against the active theme's contract — document the keys
   in the layout's frontmatter comments.
4. **Never invent parallel resolution logic.** Whatever the keys are called,
   the Liquid that resolves posts, members, and pagination is copied from
   classy verbatim — and the plan-pricing math is not even copied: every
   theme's pricing layout calls the shared
   `{% include core/pricing/resolve-plan.html plan=plan %}` (product lookup,
   monthly/annual precedence, per-unit math) and renders the variables it
   assigns (`_plan_monthly`, `_plan_annually`, `monthly_price_per_unit`,
   `annual_price_per_unit`, `_config_product`). Only the data defaults and
   presentation change per theme.

#### The pricing page has a JS contract too

The pricing page is the one page whose content is **dynamically driven at
runtime**: the framework page module `src/assets/js/pages/pricing/index.js`
runs on every theme's `/pricing` and queries the DOM for the billing toggle,
price swapping, checkout routing, the current-plan indicator, and the
flash-sale promo banner. A theme that overrides the pricing layout MUST keep
these hooks (restyle them freely — the ids, classes, and data attributes are
the contract):

| Hook | What the framework JS does with it |
|---|---|
| `input[name="billing"]` radios with `data-billing="monthly"` / `"annually"` (one `checked`) | source of truth for the billing toggle |
| `.amount`, `.billing-info`, `.price-per-unit` — each carrying `data-monthly` + `data-annually` | text content swapped when the toggle changes |
| `button[data-plan-id="<plan id>"]` inside a `.card` | click → `/payment/checkout?product=<id>` (`enterprise` → `/contact`); the current-plan indicator disables + relabels the signed-in user's active plan button |
| plan name element matching `.card-title`, `.h2`, or `.h3` inside the card | plan name for add-to-cart analytics (falls back to the plan id) |
| `#pricing-promo-banner` (shipped with the `hidden` attribute) containing `#pricing-promo-badge` / `#pricing-promo-text` / `#pricing-promo-countdown` / `#pricing-promo-code` | flash-sale banner: the JS reveals it, fills in the rotating sale name + countdown, and pushes `.navbar-wrapper` + `main > section:first-of-type` down to make room |

Two behaviors worth knowing:

- The JS swaps active/inactive **button classes** on the toggle only when the
  radios live inside a `.btn-group` (classy's structure). A custom toggle
  (newsflash's `.billing-toggle`) skips that gracefully — style the active
  state in CSS via `.btn-check:checked + label` instead.
- Omitting a hook fails **silently**, not loudly — a missing promo banner just
  never appears, a missing `.card-title` quietly degrades analytics. Diff your
  pricing layout against classy's hooks before calling the theme done.

The hooks (and the rest of the theme conventions: entry files, `$avatar-sizes`,
`[ site.theme.id ]` bracket parents, no theme-prefixed classes, no inline
scripts, page-asset shapes) are enforced by the build-layer **theme-contract
test** — `npx mgr test mgr:build/theme-contract` — which globs every theme, so
a new theme is covered the moment it lands. It caught neobrutalism's missing
promo banner + `.card-title` the day it was written. The suite asserts on the
framework's `src/assets/themes` sources, which the published package doesn't
ship — in consumer projects it reports a single skip instead of running (or
crashing); it only executes inside the UJM repo (or a consumer linked to the
local repo via `npx mgr install dev`).

#### Theme chrome: inherit classy's nav + footer, restyle via CSS

The site chrome (masthead/nav + footer) resolves automatically: the
`jsonToHtml` task generates wrapper includes that dispatch to
`themes/<active-id>/frontend/sections/*.html` with the consumer's
`nav.json`/`footer.json` data, and `copyFallbackThemeFiles()` supplies classy's
version (with `themes/classy/` paths rewritten to your namespace) when the
theme doesn't ship one.

**Inherit by default — do NOT fork chrome includes.** The chrome's *identity*
comes from theme CSS, not from forked markup: newsflash's sticky blurred-paper
masthead and editorial ink-slab footer are achieved entirely in
`css/layout/_navigation.scss` + `_general.scss` against classy's inherited
markup (serif wordmark sizing, `.avatar { display: none }`, panel-color
repaints of the `.link-muted`/`.text-body` utilities, volt column heads). A
forked include that only re-skins is a copy that silently drifts every time
classy's chrome gets a fix — newsflash's nav fork was deleted for exactly this
reason after diverging from classy by nothing but a comment.

Fork a chrome include ONLY when the *structure* genuinely diverges (different
element order, removed/added blocks that CSS cannot express). If you do:

1. **Keep the data contract** — render the same `data.logo` / `data.links` /
   `data.actions` / `data.socials` / `data.legal` / `data.copyright` shapes from
   `nav.json`/`footer.json` so consumer config works across theme swaps.
2. **Reference your own theme namespace** for nested includes (e.g.
   `{% include themes/<id>/global/sections/account.html %}`) — the fallback
   copies classy's file into your namespace when you don't ship one.
3. **The footer MUST include the appearance picker** (see below) and the
   language dropdown.

#### The appearance picker is required in every footer

Every theme footer includes the appearance dropdown — a pure drop-in block; all
logic is handled framework-side via `data-appearance-*` attributes (see
[docs/appearance.md](appearance.md)). The toggle button is **icon-only**: the
mode icons swap via `data-appearance-icon`, and there is deliberately NO
`data-appearance-current` text label in the button (the words live in the menu
items):

```html
<div class="dropup uj-appearance-dropdown">
  <button class="btn btn-sm btn-outline-adaptive dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-label="Appearance">
    <span data-appearance-icon="light" hidden>{% uj_icon "sun", "fa-sm" %}</span>
    <span data-appearance-icon="dark" hidden>{% uj_icon "moon-stars", "fa-sm" %}</span>
    <span data-appearance-icon="system" hidden>{% uj_icon "circle-half-stroke", "fa-sm" %}</span>
  </button>
  <ul class="dropdown-menu">
    <li><button class="dropdown-item" type="button" data-appearance-set="light">Light</button></li>
    <li><button class="dropdown-item" type="button" data-appearance-set="dark">Dark</button></li>
    <li><button class="dropdown-item" type="button" data-appearance-set="system">System</button></li>
  </ul>
</div>
```

Classy's footer ships it next to the language dropdown, so themes inheriting
the fallback footer get it for free; themes with custom footers must include
it themselves.

#### No theme-prefixed classes — use universal class names

**Markup must never use theme-prefixed classes** (no `nb-*`, `classy-*`, etc.). A
theme-prefixed class hardcodes the markup to one theme and breaks swappability. When a
theme writes its own layout, it uses:

1. **Standard Bootstrap classes** wherever one fits — every theme already styles these:
   - `.card` (+ `.card-body`) — the canonical box for stat/step/plan/feature blocks
   - `.btn` / `.btn-primary` / `.btn-warning` / `.btn-outline-*` — buttons (theme picks the semantic color; `.btn-warning` = the yellow accent in neobrutalism)
   - `.text-bg-{primary,secondary,success,info,warning,danger}` — full color-block fills
   - `.border`, `.shadow`, `.accordion`, `.badge`, grid/flex utilities
2. **Universal semantic layout classes** for structures with no Bootstrap equivalent —
   shared *names*, each theme supplies its own *styling*:

   | Class | Represents |
   |---|---|
   | `.section-hero` / `.hero-title` / `.hero-actions` | a page hero block |
   | `.action-block` (`--ink` / `--surface`) | large stacked call-to-action blocks |
   | `.logo-strip` (`-box`, `-label`) | a "trusted by" logo marquee strip |
   | `.showcase` / `.showcase-row` (`--flip`) / `.showcase-num` / `.showcase-body` | alternating feature showcase rows |
   | `.steps` / `.step-card` (`-num`, `-icon`, `-title`, `-desc`) | numbered "how it works" steps |
   | `.stats` / `.stats-grid` / `.stat-block` (`-num`, `-label`, `-sub`) | stat / social-proof cells |
   | `.cta` / `.cta-panel` / `.cta-title` / `.cta-desc` / `.cta-actions` | closing CTA panel |
   | `.pricing-hero` / `.pricing-title` / `.pricing-plans` / `.pricing-plan` (`--popular`) / `.pricing-plan-*` | pricing page structures |
   | `.billing-toggle` / `.billing-option` / `.billing-save` | monthly/annual billing switch |
   | `.enterprise-panel` (`-title`) / `.faq` | enterprise strip, FAQ section |
   | `.section-head` / `.section-title` / `.kicker` (`--invert`) / `.highlight` / `.font-mono` | shared section heading + label/highlight helpers |

   A new theme that overrides these pages styles **the same class names** its own way.
   This is the contract that keeps custom layouts swappable.

> The `nb-`-style prefix survives ONLY on a theme's SCSS internals — its `$theme-*`
> config tokens, `--theme-*` CSS variables, and `@mixin` helpers. Those never appear in
> HTML, so they don't affect swappability. Keep prefixes out of markup, not out of SCSS.

### 4. Page-specific CSS (theme-aware, additive)

Every page links a per-path CSS bundle (`/assets/css/pages/<path>/index.bundle.css`,
resolved in [_includes/core/head.html](../src/defaults/dist/_includes/core/head.html)).
That bundle composes UJM's base page CSS (`assets/css/pages/<path>/index.scss`) and
the consumer's same-path file. Themes add a **third, additive layer**:

- Put theme page CSS at **`themes/<id>/pages/<path>/index.scss`**.
- The SASS task ([src/gulp/tasks/sass.js](../src/gulp/tasks/sass.js)) compiles it to a
  separate bundle **`pages/<path>/index.<id>.bundle.css`**.
- `head.html` links that bundle **in addition to** the base bundle, loaded *after* it
  (so theme page CSS can override base), gated by `{% iffile %}`.

**The fallback is the absence of a file** — and that's the whole elegance:

- If the theme has **no** page CSS for a path (e.g. signin, which almost no theme
  customizes), the `<id>` bundle simply doesn't exist, `{% iffile %}` skips the link,
  and the page is styled entirely by the theme's component/general CSS in the main
  bundle. **No fallback mechanism needed** — missing = nothing extra loads.
- If the theme **does** ship page CSS (e.g. neobrutalism's `pages/index.scss` for its
  custom homepage structure), it loads and layers on top.

This asymmetry vs. HTML layouts is deliberate: a page must always have *some* layout
(hence the classy copy-fallback), but page CSS is purely additive, so a missing file
is the correct no-op. Theme page CSS compiles standalone, so it pulls in the theme's
tokens + mixins via loadPaths (`@use 'config' as *;` + `@import 'css/base/mixins';`).

**Path shape must match the base bundle.** The theme file's path mirrors the base
page-CSS path for that page — which is NOT always `pages/<path>/index.scss`:

| Page | Base page CSS | Theme page CSS |
|---|---|---|
| Homepage (`/`) | `pages/index.scss` (flat) | `pages/index.scss` (flat) |
| Other (`/pricing`) | `pages/pricing/index.scss` (nested) | `pages/pricing/index.scss` (nested) |

The homepage is the one special case — its bundle is the flat `pages/index.bundle.css`,
so the theme file is the flat `themes/<id>/pages/index.scss`, NOT `pages/index/index.scss`.
If the shapes don't match, `{% iffile %}` looks for a bundle that was compiled under a
different name and silently skips the link. (The same flat-vs-nested rule applies to
theme page JS below.)

### 5. Page-specific JS (theme-aware, additive — mirrors page CSS)

Page JS works exactly like page CSS — three additive layers, same no-op-on-missing
rule. The frontend Manager ([src/index.js](../src/index.js)) dynamically imports a
page module from each layer and runs them **in order**:

1. `#main` — `__main_assets__/js/pages/<path>/index.js` (framework default)
2. `#theme` — `__theme__/pages/<path>/index.js` (active theme) ← the theme layer
3. `#project` — `__project_assets__/js/pages/<path>/index.js` (consumer)

- Put theme page JS at **`themes/<id>/pages/<path>/index.js`** (same path shape as the
  CSS — flat `pages/index.js` for the homepage, nested otherwise).
- A module exports `default ({ manager, options }) => { ... }`. Missing at any layer is
  a graceful no-op (logged as `module missing: #<layer>/…`, execution continues).
- Execution order is **main → theme → project**, matching the CSS cascade: framework
  default first, theme second, consumer last (consumer always wins).
- The theme import uses a `/* webpackInclude: /\.js$/ */` magic comment so webpack's
  dynamic-import context only scans `.js` — the theme's `pages/` dir also holds page
  CSS (`.scss`), which must NOT be pulled into the JS context.

So a theme can ship a page's structure (layout override), its styling (theme page CSS),
AND its behavior (theme page JS) — all three keyed off the same `pages/<path>` path,
all three no-ops when absent.

The three layers, named by **source** (the `#main`/`#theme`/`#project` tags in the
console logs map to these), always load in this order:

1. **Global** — the framework's own page file (`#main`)
2. **Theme** — the active theme's page file (`#theme`)
3. **Consumer** — the consuming project's page file (`#project`)

Later layers win (Consumer overrides Theme overrides Global) — the same cascade for
both CSS and JS.

### Asset-layer test panel

The built-in **`/test/libraries/layers`** page renders a live status panel for exactly
this cascade: six dots (CSS ×3, JS ×3), one per layer. Each dot starts **red** and a
layer turns **its own** dot green when it loads (CSS via a selector, JS by setting the
dot color). A **red** dot means that layer has no file for this page — the normal state
for a layer nobody customized. The panel reflects what *actually* loads.

- **Global** and **Theme** dots are populated by files shipped in the framework:
  `assets/{css,js}/pages/test/libraries/layers/index.*` (global) and the active theme's
  `pages/test/libraries/layers/index.*` (theme). These are green out of the box.
- **Consumer** dots require a real consumer file at
  `src/assets/{css,js}/pages/test/libraries/layers/index.*`. By default a project has
  none, so they're **red** — the honest "this layer is available but unused" signal.

**Proving the Consumer layer without committing files (`UJ_TEST_LAYERS`).** To light the
Consumer dots green on demand, run the dev server with the flag — there's a ready-made
script:

```bash
npm run start:test-layers      # ≡ UJ_TEST_LAYERS=true npm start
```

When set, the `defaults` task ([utils/manage-test-layers.js](../src/gulp/tasks/utils/manage-test-layers.js))
generates a real consumer page file into the project's `src/` **at build start** (before
sass + jekyll), so it loads through the genuine `__project_assets__` / consumer-page-CSS
path — no shims. The generated CSS `@use`s the framework base so it *composes* (the same
contract every real consumer page file follows). The files carry a `GENERATED — UJ_TEST_LAYERS`
marker and are **auto-removed at the start of the next run** (and never on a normal run),
so they never persist or get committed. (`.temp`/`dist` are also cleaned by `npx mgr clean`.)

> **Build-order note (dev only).** Theme page bundles are produced by the SASS task,
> then Jekyll's `{% iffile %}` checks for them in its source tree (`dist/`). On the
> *very first* dev render, Jekyll may render a page before its theme bundle has been
> written, so the link is missing until that page is re-rendered (touch the page source
> or save it again). A production `npm run build` runs sass before jekyll, so there's no
> race. If a theme page's CSS/JS isn't applying in dev, re-trigger that page's render.

> Editing `sass.js` / `index.js` (or any gulp/build task)? The consumer's running
> `gulp serve` loaded the task at startup — **fully restart the consumer's `npm start`**
> for task-code changes to take effect (webpack picks up `src/index.js` on its own watch,
> but gulp task definitions like the sass globs only reload on a fresh process).
> Layout/SCSS/`head.html` *content* changes are picked up live.

---

## Shared vs per-theme

Get this distinction right or you'll either duplicate plumbing or fight overrides.

### Shared — do NOT re-implement in a theme

| Layer | Where | What |
|---|---|---|
| Core behavior CSS | [src/assets/css/core/](../src/assets/css/core/) | animations, alerts, lazy-loading shimmer, cookie consent, bindings skeletons, social sharing. Injected for **every** theme by `ultimate-jekyll-manager.scss`. |
| Bootstrap extensions | [src/assets/themes/bootstrap/overrides/](../src/assets/themes/bootstrap/overrides/) | avatars, color-shades, soft-colors, adaptive buttons, spacing, link/typography utilities. Each theme pulls these in via `@import '../bootstrap/overrides'` at the end of its `_theme.scss`. |
| Page layouts/includes (fallback) | classy theme + fallback copy | the ~40 frontend/backend/admin layouts and ALL includes a theme doesn't define — including the nav + footer chrome, which themes inherit and restyle via CSS (see [Theme chrome](#theme-chrome-inherit-classys-nav--footer-restyle-via-css)). |
| Pricing math | [_includes/core/pricing/resolve-plan.html](../src/defaults/dist/_includes/core/pricing/resolve-plan.html) | the plan price-resolution Liquid (product lookup, monthly/annual precedence, per-unit math). Every theme's pricing layout calls `{% include core/pricing/resolve-plan.html plan=plan %}` and renders the assigned variables — never re-implement the math. |
| Bootstrap class contract | `bootstrap/scss` | the markup + class names (`.btn`, `.card`, `.navbar`, `.form-control`). Themes **restyle** these classes; they don't invent new markup. |

### Per-theme — this IS the theme's job (and SHOULD differ between themes)

- `_config.scss` — design tokens (`!default`), Bootstrap forward.
- `_root.scss` — SCSS → CSS-variable bridge for light/dark.
- Component SCSS — how `.btn`/`.card`/`.form-control`/`.navbar` actually look.
- `_theme.js` — expose Bootstrap + run theme behaviors on DOM ready.
- Chrome LOOK via CSS — masthead/footer restyling in `css/layout/` against the
  inherited classy chrome markup (fork the include itself only on real
  structural divergence — see [Theme chrome](#theme-chrome-inherit-classys-nav--footer-restyle-via-css)).
- *(optional)* Page-layout overrides under `_layouts/themes/<id>/...` — for pages
  whose structure must differ (keep the resolution Liquid + universal keys, write
  genre-native defaults).
- *(optional)* Theme page CSS at `pages/<path>/index.scss` — additive per-page
  styles for those overridden layouts.
- *(optional)* Theme page JS at `pages/<path>/index.js` — additive per-page behavior
  (the `#theme` layer between `#main` and `#project`).

A neobrutalist button and a classy button share only the `.btn` class — restyling
it is the theme's whole purpose. **Do not try to "share" component styling between
themes**; that produces an override-fighting mess. Share *plumbing*, not *looks*.

> Themes share the **class-name contract** (standard Bootstrap classes + the universal
> semantic layout classes — see [No theme-prefixed classes](#no-theme-prefixed-classes--use-universal-class-names)),
> not the styling. Same names, different looks → markup stays swappable.

### Structural vs visual components (gotcha)

A few "components" in classy are **structural behavior**, not just styling — e.g.
`_infinite-scroll.scss` (the trusted-by logo marquee + testimonial scroll). The
shared layouts emit `.infinite-scroll-track` markup, so any theme using those
layouts needs the matching CSS or the content renders broken (giant unstyled
logos). Until these are promoted to the shared layer, **port structural components
you actually use** into your theme (neobrutalism ships its own
`css/components/_infinite-scroll.scss` — mostly the same flex/marquee rules with
theme-tuned cosmetics). If a page using shared markup looks broken, check whether
a structural component is missing.

### Adaptive buttons need an explicit theme override (gotcha)

The shared `bootstrap/overrides/_buttons-adaptive.scss` defines `.btn-adaptive` /
`.btn-adaptive-inverse` (mode-flipping solids used by the nav CTA, auth buttons,
redirect, etc.) **only at single-class specificity** (`.btn-adaptive`, `0,1,0`) and
via the `--bs-btn-*` custom properties. A theme that restyles `.btn` will hit two
problems with these classes if it ignores them:

1. **Transparent resting fill.** Bootstrap's base `.btn { --bs-btn-bg: transparent }`
   can tie/beat the `.btn-adaptive` rule on source order, so the button renders
   *transparent* instead of solid. Fix: restate the resting fill at **doubled
   specificity** (`.btn.btn-adaptive`, `0,2,0`) in the theme's `_buttons.scss`, with a
   `[data-bs-theme="dark"]` pair for the mode flip.
2. **Hover color flash.** The adaptive defaults darken on hover (`--bs-btn-hover-bg:
   var(--bs-dark-hover)`), so an adaptive button animates differently from the theme's
   other solids. Fix: add `.btn-adaptive` / `.btn-adaptive-inverse` to the same
   hover/active **freeze** list the theme uses for `.btn-primary` etc.
   (`--bs-btn-hover-bg: var(--bs-btn-bg)`), so the press is pure transform+shadow.

See `themes/neobrutalism/css/components/_buttons.scss` for the reference treatment.
The `[class*="btn-outline-"]` selector already catches the *outline* adaptive
variants, so only the two **solid** adaptive classes need this.

### One token for interactive hovers — and `$primary` ≠ `--bs-primary` (gotcha)

Give every interactive hover/active fill (nav links, footer links, dropdown items,
in-content links, mobile toggler) a **single** token so they retune from one line and
never drift. Neobrutalism defines `--nb-accent-interactive` (blue) in `_root.scss`,
distinct from the yellow signature accent (`--nb-accent-yellow`) reserved for static
blocks (kicker tags, highlight marker, hero, badges). Every interactive `:hover`/
`.active` reads `var(--nb-accent-interactive)`; nothing hardcodes the color.

**The trap:** point that token at the runtime **`var(--bs-primary)`**, NOT the SCSS
`$primary` token. A consumer can set them to *different* values (UJM consumers
frequently do — the SCSS `$primary` and the rendered `--bs-primary` diverged, so a
rule written as `background: $primary` compiled a purple that didn't match the blue
`.btn-primary` buttons on the page). Any rule that should match a rendered Bootstrap
color must use the **CSS variable** (`var(--bs-primary)`), because SCSS values are
frozen at compile time while the `--bs-*` vars reflect the live theme.

One more: a generic `a:hover { color: … }` also paints **button** labels (buttons are
`<a>`). Guard it with `a.btn:hover { color: var(--bs-btn-color); }` so buttons keep
their own (frozen) text color. Nav/dropdown/footer links already win on specificity.

### Page bundles re-emit Bootstrap — double your selectors (gotcha)

Every theme **page** bundle (`pages/<path>/index.<id>.bundle.css`) compiles
standalone via `@use 'config'`, so it contains a full copy of Bootstrap — and it
loads AFTER `main.bundle.css`. Any main-bundle rule that ties Bootstrap's
specificity loses on pages that ship page CSS: Bootstrap's re-emitted
`:root`/`[data-bs-theme=dark]` variable blocks clobber a theme's single-selector
`_root.scss` bridge (dark mode reverts to Bootstrap gray), and re-emitted
`.btn`/`.btn-outline-*` rules clobber single-class button overrides.

**The fix is doubled selectors** in the theme's structural rules so they win on
specificity regardless of load order:

```scss
:root:root, [data-bs-theme="light"][data-bs-theme="light"] { /* light vars */ }
[data-bs-theme="dark"][data-bs-theme="dark"] { /* dark vars */ }
.btn.btn { /* press/lift system */ }
[class*="btn-outline-"][class*="btn-outline-"] { /* ghost buttons */ }
.dropdown-menu.dropdown-menu { /* panel inset (Bootstrap re-emits padding-x: 0) */ }
```

See newsflash's `_root.scss` + `_buttons.scss` (and neobrutalism's `.btn.btn`)
for reference treatments.

The same trap applies to **type metrics**: Bootstrap's re-emitted `.display-*`
(`font-weight: 300`), `.lead` (`font-weight: 300`), and `body` rules clobber
main-bundle element-rule overrides on any page that ships page CSS — headings
silently go thin on exactly those pages. For values Bootstrap owns a variable
for, **set the variable in the config `@forward ... with (...)` block instead
of writing an element rule** (`$display-font-weight`, `$display-line-height`,
`$lead-font-weight`, `$headings-line-height`, `$line-height-base`, …) — then
every Bootstrap copy compiles the right value natively and there is no
specificity war at all. Element rules in `_typography.scss` are only for
props Bootstrap has no variable for (optical sizing, letter-spacing,
`text-wrap`, font smoothing).

### Remap the `--bs-*-rgb` companions too (gotcha)

Bootstrap's `.bg-body`, `.bg-body-secondary`, `.bg-body-tertiary`,
`.text-body`, `.text-body-secondary` utilities paint from
`rgba(var(--bs-*-rgb), opacity)` — NOT the hex variables. A theme that remaps
`--bs-secondary-bg` but not `--bs-secondary-bg-rgb` gets Bootstrap's default
gray triplets bleeding through every `.bg-body-*` surface (most visibly in dark
mode). When the `_root.scss` bridge remaps a surface/color var, **always remap
its `-rgb` companion** in the same block:

```scss
--bs-secondary-bg: #{$nf-paper-2};
--bs-secondary-bg-rgb: #{red($nf-paper-2)}, #{green($nf-paper-2)}, #{blue($nf-paper-2)};
```

Also note: shared includes may put `!important` utilities (e.g.
`.bg-body-secondary` on the footer) on elements a theme wants to restyle — the
override needs `!important` AND equal-or-higher specificity
(`footer.bg-body-secondary`, not bare `footer`).

### Derive dark-mode brand remaps from `$primary` (gotcha)

When a dark block remaps `--bs-primary` / `--bs-link-color` (e.g. to brighten
the brand color for contrast on dark surfaces), **derive the value from the
compile-time `$primary`** — never hardcode the theme's stock color. Consumers
override `$primary` via `main.scss`'s `with (...)` block; a hardcoded dark
remap would snap their brand back to the theme's color the moment dark mode
engages (light honors the override, dark ignores it). newsflash's pattern:

```scss
// Stock vermilion keeps its hand-tuned brightening; any other brand color
// gets a generic white-mix lift.
$nf-primary-dark-mode: if($primary == $nf-vermilion, $nf-vermilion-dark-mode, mix(white, $primary, 15%));
```

The theme's own identity accents (newsflash's `--nf-vermilion` used in cover-art
gradients) are exempt — those ARE the theme, not the consumer's brand.

---

## 🚨 BOOTSTRAP-FIRST — NEVER reinvent the wheel

**This is the #1 theme authoring mistake.** A theme's job is to RESTYLE Bootstrap — not to build a parallel design system alongside it.

### The rule

Every HTML element must use **Bootstrap classes first**. Custom CSS exists ONLY to override how those Bootstrap classes look (colors, shadows, borders, radii, typography) via the theme's SCSS. You should NEVER:

- Invent custom layout classes when Bootstrap grid/flex utilities exist (`.row`, `.col-*`, `.d-flex`, `.gap-*`, `.justify-content-*`, `.align-items-*`, `.text-center`, `.mx-auto`, etc.)
- Create custom button classes (`.my-btn`, `.lm-btn`) when `.btn .btn-primary`, `.btn .btn-outline-dark`, etc. already exist — restyle `.btn` in theme SCSS instead
- Create custom spacing/sizing classes when Bootstrap has `p-*`, `m-*`, `w-*`, `rounded-*`, `shadow-*`
- Create custom text utilities when Bootstrap has `.text-muted`, `.lead`, `.display-*`, `.fw-*`, `.fs-*`
- Create custom card/container classes when `.card`, `.card-body`, `.container`, `.lh-*` exist
- Write `position`, `display`, `flex`, `gap`, `padding`, `margin`, `border-radius`, `text-align`, `font-weight`, `font-size` in custom CSS when a Bootstrap utility class does the same thing

### What theme CSS IS for

- Overriding Bootstrap component appearance: `.btn { border-radius: 50px; box-shadow: ... }` — changes how ALL buttons look
- Setting design tokens: `$primary`, `$border-radius`, `$font-family-sans-serif` — passed to Bootstrap's `@forward`
- CSS custom properties for the theme palette: `--lm-accent`, `--lm-ink`, etc.
- Dark mode overrides via `[data-bs-theme="dark"]` variable remapping
- Truly novel components with no Bootstrap equivalent (grain overlays, animated hero cards, marquee strips)
- Mixins/utilities that compose Bootstrap patterns, not replace them

### How to check yourself

Before writing ANY custom CSS class, ask: "Does Bootstrap already have a class for this?" If yes, use it. If the Bootstrap class doesn't look right, override its appearance in theme SCSS — don't create a parallel class. The HTML should be 90%+ Bootstrap classes with custom classes only for genuinely novel UI patterns.

### Anti-pattern example

```html
<!-- BAD: parallel design system -->
<div class="lm-wrap">
  <div class="lm-section">
    <a class="lm-btn lm-btn-primary">Click</a>
  </div>
</div>

<!-- GOOD: Bootstrap classes, theme restyled -->
<div class="container">
  <section class="py-5">
    <a class="btn btn-primary">Click</a>
  </section>
</div>
```

The GOOD version uses zero custom CSS for layout/buttons — the theme's `_buttons.scss` restyled `.btn` and `.btn-primary` to look however it wants. The page `main.scss` only adds styles for genuinely novel components.

---

## Authoring conventions (both paths)

1. **Every token is `!default`** so consumers can override without forking.
2. **Bridge to CSS variables** in `_root.scss`; components read `var(--*)`, not raw
   SCSS. Dark mode then becomes one `[data-bs-theme="dark"]` override block.
3. **Restyle Bootstrap's own classes** so inherited markup adopts your look with no
   HTML edits. Add your own classes only for net-new patterns.
4. **Namespace your own classes** (`.nb-*`, `.recipe-*`) to avoid collisions.
5. **Match classy's `$avatar-sizes` map** in `_config.scss` — the shared includes
   (nav/account) reference it.
6. **Fonts** load via the base layout's `theme.head.content`, NOT a CSS `@import`
   (avoids render-blocking duplicate loads). To use custom fonts, override
   `frontend/core/base.html` (see below).
7. **Develop in ONE appearance mode; ship with BOTH.** Pick a primary mode
   while building (the consumer's `theme.appearance` default is the natural
   choice) and get the design right there first — splitting attention across
   both modes mid-build doubles every iteration. But a theme is only **done**
   when light AND dark are both validated: the `_root.scss` bridge makes dark
   mode a single remap block, so build the token bridge correctly, then do a
   dedicated both-modes screenshot pass at the end.
8. **Validate live, then document.** UJM can't run a dev server — build in a
   consumer and screenshot (see [Validating](#validating-a-theme)).

---

## Path A — author a theme INSIDE UJM (shipped to all consumers)

Use this for first-party themes like `neobrutalism`.

1. **Copy the template** to your theme id:
   ```
   src/assets/themes/_template/  →  src/assets/themes/my-theme/
   ```
2. **Edit the SCSS:**
   - `_config.scss` — your tokens + the `@forward '../bootstrap/scss/bootstrap.scss' with (...)` block.
   - `_root.scss` — CSS-variable bridge (light + dark).
   - add `css/base/`, `css/layout/`, `css/components/` partials and `@import` them
     in `_theme.scss`. End `_theme.scss` with `@import '../bootstrap/overrides';`.
   - If you use shared mixins across partials, `@import` a `_mixins.scss` first so
     they're in the global scope the other `@import`s share (neobrutalism does this).
3. **Edit `_theme.js`** — `import bootstrap from '__main_assets__/themes/bootstrap/js/index.umd.js'`,
   `window.bootstrap = bootstrap`, run behaviors inside `domReady()`. Keep multiple
   behaviors in small `js/` files.
4. **Override only the HTML that must differ** under
   `src/defaults/dist/_layouts/themes/my-theme/...` (and `_includes/...`). The
   classy fallback supplies the rest. The most common override is
   `frontend/core/base.html` to load your fonts (neobrutalism overrides just this
   one file).
5. **Write genre-native frontmatter defaults** in every layout you override —
   the default copy/sections must match the theme's purpose, not classy's SaaS
   demo data. See [Frontmatter defaults are part of the theme's
   identity](#frontmatter-defaults-are-part-of-the-themes-identity).
6. **Restyle the inherited nav + footer chrome via CSS** (`css/layout/`) — do
   NOT fork the chrome includes unless the structure genuinely diverges. See
   [Theme chrome](#theme-chrome-inherit-classys-nav--footer-restyle-via-css).
7. **Add a `README.md`** in the theme folder (customization quickstart).
8. `npm run prepare` (copies `src/`→`dist/`) so consumers see it. Then test in a
   consumer (Path: [Validating](#validating-a-theme)).

## Path B — author a theme IN A CONSUMER PROJECT (that project only)

Use this when one site needs a bespoke look that shouldn't ship in UJM (e.g. Sweet
Saucy's `recipe` theme).

1. **Copy the template** from UJM into your project:
   ```
   node_modules/ultimate-jekyll-manager/dist/assets/themes/_template/
     →  <project>/src/assets/themes/my-theme/
   ```
2. **Select it** in `src/_config.yml`: `theme: { id: "my-theme" }`.
3. **Edit the SCSS/JS** exactly as Path A. The `../bootstrap/...` imports still
   resolve — UJM's loadPaths include the package themes root.
4. **Override HTML** (only if needed) under
   `<project>/src/_layouts/themes/my-theme/...` and `src/_includes/themes/my-theme/...`.
   The fallback still copies classy's defaults into your theme id at build time.
5. **PurgeCSS safelist:** if you add custom classes used only in JS-injected DOM,
   add them to `config/ultimate-jekyll-manager.json` → `sass.purgecss.safelist` so
   production builds don't strip them.
6. **`npm start`** and verify.

> To merely *recolor* an existing theme (not build a new one), don't create a
> theme — override its `!default` tokens in `main.scss` before
> `@use 'ultimate-jekyll-manager'`. See classy's README. To change a theme's
> component styles or a layout, **shadow it**: create
> `src/assets/themes/<id>/` (SCSS) or `src/_layouts/themes/<id>/<file>` (HTML) in
> your project — loadPaths/fallback resolve your copy first.

---

## Validating a theme

UJM cannot run a dev server itself (it runs inside a consumer). To verify a theme:

1. In UJM: `npm run prepare` (or `npm start` for watch) to publish `src/`→`dist/`.
2. In a consumer wired to local UJM (`"ultimate-jekyll-manager": "file:../ultimate-jekyll-manager"`),
   set `theme.id` and run `npm start`. Read the BrowserSync URL from the
   consumer's `.temp/_config_browsersync.yml`. Prefer `https://localhost:4000`;
   fall back to the local network IP (e.g. `https://192.168.x.x:4000`) if localhost doesn't connect.
3. Screenshot the key pages (home, pricing, signin, signup) in **both** light and
   dark (`document.documentElement.setAttribute('data-bs-theme','dark')`) — e.g.
   via the chrome-devtools MCP. Check the console for errors and that your theme's
   "loaded" log appears. Developing in one mode is fine (and encouraged — see
   [Authoring conventions](#authoring-conventions-both-paths)); **shipping
   requires both modes validated**, plus a click-through of the footer
   appearance picker to confirm live switching looks right.
4. Iterate on SCSS — the consumer's gulp watcher recompiles when UJM's `dist/`
   changes (if UJM is running `npm start`), or re-run `npm run prepare`.

**Do not declare a theme done without looking at rendered screenshots.** Verified
example: `neobrutalism` built into `ultimate-jekyll-website`, screenshotted across
all four pages in light + dark.

---

## Reference

- Theme tokens example: [src/assets/themes/neobrutalism/_config.scss](../src/assets/themes/neobrutalism/_config.scss)
- CSS-variable bridge example: [src/assets/themes/neobrutalism/css/base/_root.scss](../src/assets/themes/neobrutalism/css/base/_root.scss)
- Genre-native frontmatter defaults example: [src/defaults/dist/_layouts/themes/newsflash/frontend/pages/index.html](../src/defaults/dist/_layouts/themes/newsflash/frontend/pages/index.html)
- Posts-driven theme sections (ticker in base.html, cover-story hero, most-read rail — all guarded for empty `site.posts`): [src/defaults/dist/_layouts/themes/newsflash/](../src/defaults/dist/_layouts/themes/newsflash/)
- Theme page JS example (blog post reading-progress, flat `asset_path` shape): [src/assets/themes/newsflash/pages/blog/post.js](../src/assets/themes/newsflash/pages/blog/post.js)
- Starter: [src/assets/themes/_template/](../src/assets/themes/_template/)
- Fallback mechanism: [src/gulp/tasks/distribute.js](../src/gulp/tasks/distribute.js) (`copyFallbackThemeFiles`)
- Resolution: [src/gulp/tasks/sass.js](../src/gulp/tasks/sass.js), [src/gulp/tasks/webpack.js](../src/gulp/tasks/webpack.js)
- Related: [docs/assets.md](assets.md) (file layout), [docs/css.md](css.md) (section/theme-adaptive classes), [docs/appearance.md](appearance.md) (dark/light switching)
