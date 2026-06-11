# Layouts and Pages

## Page Types

- **One-off pages** (e.g., `/categories`, `/sitemap`) — Create as pages without custom layouts; use existing layouts
- **Repeating page types** (e.g., blog posts, category pages) — Create a dedicated layout (e.g., `_layouts/category.html`)

## Layout Requirements

All layouts and pages must eventually require a theme entry point:

```yaml
layout: themes/[ site.theme.id ]/frontend/core/base
```

**Note:** The `[ site.theme.id ]` syntax is correct and allows dynamic theme selection.

## Asset Path Configuration

For pages sharing the same assets, use the `asset_path` frontmatter variable:

```yaml
---
# Instead of deriving path from page.canonical.path
asset_path: categories/category
---
```

**Example:**
- One-off page: `pages/categories.html` → `src/assets/css/pages/categories/index.scss`
- Repeating layout: `_layouts/category.html` → `src/assets/css/pages/categories/category.scss` (set `asset_path: categories/category` in layout frontmatter)

## Customizing Default Pages (blueprints)

Default pages live in `src/defaults/dist/_layouts/themes/[theme-id]/frontend/pages/`. Consumers customize them through frontmatter only — see [assets.md → Customizing Default Pages via Frontmatter](assets.md#customizing-default-pages-via-frontmatter) for the mechanism (`page.resolved`, reading the default layout first).

For each relevant default page:

1. Create a page in the consuming project's `src/pages/` directory
2. Use ONLY frontmatter to customize — NO HTML content needed
3. Set `layout: blueprint/[page-name]` (e.g., `layout: blueprint/pricing`)
4. Customize the frontmatter values to match the brand and purpose

### File Extension Rules

- `.md` — Use for frontmatter-only customization (no HTML content)
- `.html` — Use only when adding custom HTML content beyond the layout

### Frontmatter Rules

- Default pages (blueprint layouts): Do NOT include `meta.title` or `meta.description` — already set in the layout
- Do NOT include `theme` config (e.g., `theme.main.class`) unless explicitly changing from defaults
- `superheadline`: Homepage keeps default icon AND text; other pages may customize `text` but keep the default `icon`

### Page Exclusions

Do NOT modify these pages:

- `auth/*` — Authentication pages (signin, signup, reset, oauth2)
- `payment/*` — Payment pages (checkout, confirmation)
- `account/*` — Account management pages
- `app.html` — App page
- `404.html` — Error page

## Default Pages — Customization Levels

| Page | File | Layout | Level | Customize | Keep defaults |
|------|------|--------|-------|-----------|---------------|
| Homepage | `src/pages/index.md` | `blueprint/index` | Full | `hero`, `features`, `testimonials`, `stats`, `cta` | `superheadline` (icon AND text) |
| Pricing | `src/pages/pricing.md` | `blueprint/pricing` | Full | plan `features`/`pricing`/`definitions`/`price_per_unit`, `testimonials`, `faqs` | plan `id`/`name`/`tagline`, plan order |
| About | `src/pages/about.md` | `blueprint/about` | Full | `hero`, `mission`, `vision`, `story`, `values`, `team` | — |
| Contact | `src/pages/contact.md` | `blueprint/contact` | Minimal | `testimonials`, `faqs` ONLY | `hero`, `contact_methods`, `contact_form`, `stats` |
| Download | `src/pages/download.md` | `blueprint/download` | Minimal | `testimonials`, `faqs` ONLY | `hero`, `platforms`, `features`, `system_requirements` |

### Homepage hero specifics

Always use the tagline format `tagline: "Introducing {{ site.brand.name }}"`. The hero supports optional display modes via `hero.display` — use only if the site benefits from an in-hero demo, CTA, or video:

```yaml
hero:
  display:
    type: input  # or: form, video, custom
    view: side   # or: bottom (default)
```

- `bottom` (default) — content stacked vertically, display element below text; `side` — side-by-side, display element on the right
- Types: `input` (single field + button, e.g. email signup), `form` (multiple fields), `video` (embedded player), `custom` (only for something the others can't achieve)
- Reference examples: `src/defaults/dist/pages/test/components/hero-demo-{input,form,video,side,custom}.html`

### Pricing plan features

Use YAML comments to separate feature types in each plan's `features` array:

- `# Common features` — listed in EVERY plan, displayed aligned across all plan cards
- `# Additional features` — features introduced in THIS plan only, appear in the "Everything in X, plus:" section

Do NOT repeat additional features that are unchanged from the previous plan (they're inherited automatically).

### Testimonials (any page)

Each testimonial requires `quote` (1-2 sentences max), `author`, `role`, `company`, `initial` (first letter of name, shown in avatar). Use 3 for balanced display, keep quotes relevant to the page (pricing → value/ROI, contact → support experience), vary roles to show a broad customer base.

### FAQs (any page)

Each FAQ requires `question` + `answer` (answers can include HTML like `<br><br>`). Use 3-5 per page, focused on the page's topic (pricing → billing/trials/refunds, contact → response times/channels), ordered by most commonly asked. `{{ site.brand.name }}` works in answers.

## Dashboard Resource Pages (list/detail/edit)

For dashboard resource pages (e.g., forms, users, orders), use separate pages — do NOT use a single page with show/hide toggling.

**File structure:**

```
src/pages/dashboard/items/
  index.html     ← list page
  view.html      ← detail page
  edit.html      ← edit page (optional)

src/assets/js/pages/dashboard/items/
  index.js
  view.js
  edit.js        ← (optional)
```

**URL pattern:** `/dashboard/items` (list) · `/dashboard/items/view?id={id}` (detail) · `/dashboard/items/edit?id={id}` (edit, optional).

**Frontmatter:** the view page's breadcrumbs follow Home → Dashboard → Items (linked) → Details (active, no href):

```yaml
meta:
  breadcrumbs:
    - label: Home
      href: /
    - label: Dashboard
      href: /dashboard
    - label: Items
      href: /dashboard/items
    - label: Details
      active: true
```

**JS conventions:**

- `view.js` must redirect to the list page if no `?id=` param is present:

  ```js
  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) {
    window.location.href = '/dashboard/items';
    return;
  }
  ```

- Links from the list page to detail use `/dashboard/items/view?id=${item.id}`
- After creating an item, redirect to `/dashboard/items/view?id=${item.id}`
- Delete on the view page redirects back to the list page

## Creating Custom Pages (beyond blueprints)

When a page needs custom HTML (no blueprint fits):

1. Place it in `src/pages/` with `.html` extension
2. Use `layout: themes/[ site.theme.id ]/frontend/core/base`
3. **Include `meta.title` and `meta.description`** in frontmatter (see [seo.md](seo.md))
4. Follow the HTML patterns from default pages: `{% uj_icon %}` for icons, theme-adaptive classes (`bg-body`, `bg-body-secondary`, `text-body`, `btn-adaptive` — see [css.md](css.md)), `data-lazy="@class animation-slide-up"` animations, `page.resolved.[section]` for frontmatter data, the superheadline/headline/headline_accent/subheadline pattern
5. Use frontmatter for configuration data, keep actual content in the body
6. Forms: always FormManager with `onsubmit="return false"` + `novalidate` — see [page-loading.md](page-loading.md) for the full form protection standards
7. Create `src/assets/css/pages/[page-name]/index.scss` / `src/assets/js/pages/[page-name]/index.js` only if needed ([assets.md](assets.md))

A good reference implementation to study: `src/defaults/dist/_layouts/themes/classy/frontend/pages/contact.html` (frontmatter structure, section organization, Bootstrap classes, `{% uj_icon %}`, `page.resolved`, form validation attributes, responsive grids, `data-lazy` animations).

## See also

- [assets.md](assets.md) — frontmatter customization mechanism, page module/CSS auto-loading, nav/footer/account JSON
- [seo.md](seo.md) — content writing rules, services/solutions/alternatives page types, JSON-LD schema
- [themes.md](themes.md) — theme layouts, the classy fallback, authoring new themes
- [no-inline-scripts.md](no-inline-scripts.md) — where page JS goes (never inline)
