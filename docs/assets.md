# Asset Organization

This document covers UJM's asset layout, consuming-project overrides, the JSON-driven section configuration system (nav, footer, account dropdown), frontmatter-driven page customization, webpack aliases, and the page module pattern.

## Ultimate Jekyll Manager Files (THIS project)

**CSS:**
- `src/assets/css/ultimate-jekyll-manager.scss` — Main UJ stylesheet (provides core styles)
- `src/assets/css/global/` — Global UJ styles
- `src/assets/css/pages/` — Page-specific styles provided by UJ
  - Format: `src/assets/css/pages/[page-name]/index.scss`
  - Example: `src/assets/css/pages/download/index.scss`

**JavaScript:**
- `src/assets/js/ultimate-jekyll-manager.js` — Main UJ JavaScript entry point (provides core functionality)
- `src/assets/js/core/` — Core UJ modules
- `src/assets/js/pages/` — Page-specific JavaScript provided by UJ
  - Format: `src/assets/js/pages/[page-name]/index.js`
  - Example: `src/assets/js/pages/download/index.js`
- `src/assets/js/libs/` — UJ library modules (prerendered-icons, form-manager, authorized-fetch, etc.)

**Default Pages & Layouts:**

UJ provides default page templates and layouts in `src/defaults/dist/` that are copied to consuming projects. These are NOT meant to be edited by users.

- Format: `src/defaults/dist/_layouts/themes/[theme-id]/frontend/pages/[page-name].html`
- Examples:
  - `src/defaults/dist/_layouts/themes/classy/frontend/pages/download.html`
  - `src/defaults/dist/_layouts/themes/classy/frontend/pages/pricing.html`
  - `src/defaults/dist/_layouts/themes/classy/frontend/pages/payment/checkout.html`
  - `src/defaults/dist/_layouts/themes/classy/frontend/pages/payment/confirmation.html`
  - `src/defaults/dist/_layouts/themes/classy/frontend/pages/contact.html`
- Core layouts:
  - `src/defaults/dist/_layouts/core/root.html` — Root HTML wrapper
  - `src/defaults/dist/_layouts/themes/[theme-id]/frontend/core/base.html` — Theme base layout

**Complete UJ Page Example:**
- **HTML:** `src/defaults/dist/_layouts/themes/classy/frontend/pages/download.html`
- **CSS:** `src/assets/css/pages/download/index.scss`
- **JS:** `src/assets/js/pages/download/index.js`

These files serve as blueprints and reference implementations. When building custom pages in consuming projects, reference these for patterns and best practices.

**IMPORTANT:** Consuming projects CAN create files with the same paths in their own `src/` directory to override UJ defaults, but this should ONLY be done when absolutely necessary. Prefer using `src/pages/` and `src/_layouts/` for custom pages instead of overriding UJ default files.

## Consuming Project Files

**CSS:**
- `src/assets/css/main.scss` — Site-wide custom styles (runs on every page, edits by consuming project)
- `src/assets/css/pages/` — Page-specific custom styles
  - Format: `src/assets/css/pages/[page-name]/index.scss`

**JavaScript:**
- `src/assets/js/main.js` — Site-wide custom JavaScript (runs on every page, edits by consuming project)
- `src/assets/js/pages/` — Page-specific custom JavaScript
  - Format: `src/assets/js/pages/[page-name]/index.js`

**Pages & Layouts:**
- `src/pages/` — Individual page HTML/Markdown files
- `src/_layouts/` — Custom layouts for the consuming project

**Asset Loading:** Page-specific CSS/JS files are automatically included based on the page's canonical path. Override with `asset_path` frontmatter.

## Section Configuration Files (JSON)

UJ provides JSON configuration files for common sections like navigation and footer. These JSON files are consumed by corresponding HTML templates during the build process.

**Configuration Files:**
- `src/defaults/src/_includes/frontend/sections/nav.json` — Navigation configuration
- `src/defaults/src/_includes/frontend/sections/footer.json` — Footer configuration
- `src/defaults/src/_includes/global/sections/account.json` — Account dropdown configuration (shared across frontend nav, backend topbar, admin topbar)

**How It Works:**
1. JSON files contain structured data (links, labels, settings)
2. HTML templates in `src/defaults/dist/_includes/themes/[theme-id]/` read and render this data
3. The build process converts `.json` → data loaded by `.html` templates

**Customizing Navigation/Footer:**

Consuming projects should create their own JSON files in `src/_includes/frontend/sections/`:
- `src/_includes/frontend/sections/nav.json`
- `src/_includes/frontend/sections/footer.json`

**Example: Footer Configuration**

```json
{
  logo: {
    href: '/',
    class: 'filter-adaptive',
    text: '{{ site.brand.name }}',
    description: '{{ site.meta.description }}',
  },
  links: [
    {
      label: 'Company',
      href: null,
      links: [
        {
          label: 'About Us',
          href: '/about',
        },
        {
          label: 'Pricing',
          href: '/pricing',
        },
      ],
    },
  ],
  socials: {
    enabled: true,
  },
  copyright: {
    enabled: true,
    text: null,
  },
}
```

**Note:** These are JSON5 files (support comments, trailing commas, unquoted keys). The corresponding HTML templates automatically process these files during the build.

## Account Dropdown (Shared Component)

The account dropdown (avatar + user info + menu items) is a shared component used across the frontend nav, backend topbar, and admin topbar. It is defined once and included everywhere.

**Data Source:** `src/defaults/src/_includes/global/sections/account.json`

This is the single source of truth for account dropdown menu items. Consuming projects can override it by creating `src/_includes/global/sections/account.json`.

**Example: account.json**

```json5
{
  dropdown: [
    { label: 'Account', href: '/account#profile', icon: 'user-gear' },
    { label: 'Dashboard', href: '/dashboard', icon: 'gauge-high' },
    { divider: true, attributes: [['data-wm-bind', '@show auth.account.roles.admin']] },
    { label: 'Admin Panel', href: '/admin/dashboard', icon: 'shield-halved', attributes: [['data-wm-bind', '@show auth.account.roles.admin']] },
    { divider: true },
    { label: 'Sign Out', icon: 'arrow-right-from-bracket', class: 'auth-signout-btn text-danger' }
  ]
}
```

**Include:** `src/defaults/dist/_includes/themes/classy/global/sections/account.html`

This renders the full account dropdown: avatar button with profile photo, user info header (displayName + email), and the menu items from `account.json`.

**Parameters:**

| Parameter | Default | Description |
|-----------|---------|-------------|
| `size` | `md` | Avatar size class (`sm`, `md`, `lg`) |
| `attributes` | none | Array of `[name, value]` attribute pairs for the dropdown wrapper |

**Usage in templates:**

```liquid
{% include themes/classy/global/sections/account.html size="md" attributes=action.attributes %}
```

**How it's wired into nav/topbar:**

In `nav.json` or `topbar.json`, set `type: 'account'` on an action — the rendering templates detect this type and include the shared account dropdown automatically. No `dropdown` array is needed on the action:

```json5
{
  type: 'account',
  attributes: [
    ['data-wm-bind', '@show auth.user'],
    ['hidden', '']
  ],
}
```

**File Locations:**

| Purpose | Path |
|---------|------|
| Account data (SSOT) | `src/defaults/src/_includes/global/sections/account.json` |
| Account include | `src/defaults/dist/_includes/themes/classy/global/sections/account.html` |
| Frontend nav (uses include) | `src/defaults/dist/_includes/themes/classy/frontend/sections/nav.html` |
| Backend topbar (uses include) | `src/defaults/dist/_includes/themes/classy/backend/sections/topbar.html` |
| Admin topbar (wraps backend) | `src/defaults/dist/_includes/themes/classy/admin/sections/topbar.html` |

## Customizing Default Pages via Frontmatter

**BEST PRACTICE:** UJ default pages are designed to be customized through frontmatter WITHOUT writing any HTML. Consuming projects can create a simple page that includes ONLY frontmatter to configure the default page's behavior.

**How It Works:**
1. UJ default pages use `page.resolved` to access merged frontmatter (site → layout → page)
2. **IMPORTANT:** Before customizing, READ the UJ default page in `src/defaults/dist/_layouts/` to understand available frontmatter options and how they're used
3. Consuming projects create a page in `src/pages/` with custom frontmatter
4. The page uses a UJ layout (e.g., `blueprint/pricing`)
5. Frontmatter overrides default values without any HTML

**Example: Customizing the Pricing Page**

**Step 1:** Read the UJ default pricing page to see available frontmatter options:
- File: `src/defaults/dist/_layouts/themes/classy/frontend/pages/pricing.html`
- Look for frontmatter at the top and how `page.resolved.pricing` is used in the HTML

**Step 2:** In consuming project, create `src/pages/pricing.html`:

```yaml
---
### ALL PAGES ###
layout: blueprint/pricing
permalink: /pricing

### PAGE CONFIG ###
pricing:
  price_per_unit:
    enabled: true
    feature_id: "credits"
    label: "credit"
  plans:
    - id: "basic"
      name: "Basic"
      tagline: "best for getting started"
      url: "/download"
      pricing:
        monthly: 0
        annually: 0
      features:
        - id: "credits"
          name: "Credits"
          value: 1
          icon: "sparkles"
    ...
---
```

That's it! No HTML needed. The UJ pricing layout reads `page.resolved.pricing` and renders the plans accordingly.

**When to Use Frontmatter Customization:**
- ✅ Customizing UJ default pages (pricing, contact, download, etc.)
- ✅ Changing configuration without touching HTML
- ✅ Maintaining upgradability when UJ updates

**When to Create Custom Pages:**
- ❌ Building entirely new page types
- ❌ Needing custom HTML structure
- ❌ Pages with unique layouts not provided by UJ

## Webpack Import Aliases

UJM defines two webpack aliases (in `src/gulp/tasks/webpack.js`) for importing assets in JavaScript:

| Alias | Resolves To | Purpose |
|-------|------------|---------|
| `__main_assets__` | `[UJM package]/dist/assets` | UJM's own built-in assets (core modules, libraries, pages) |
| `__project_assets__` | `[consuming project]/src/assets` | The consuming project's custom assets |

> A third alias, `__theme__`, resolves to the project's theme if one exists, else UJM's theme. See [CLAUDE.md → Frontend Manager](../CLAUDE.md#frontend-manager-srcindexjs).

**`__main_assets__`** — Import UJM libraries and core modules:

```javascript
import { FormManager } from '__main_assets__/js/libs/form-manager.js';
import authorizedFetch from '__main_assets__/js/libs/authorized-fetch.js';
import { getPrerenderedIcon } from '__main_assets__/js/libs/prerendered-icons.js';
```

**`__project_assets__`** — Import consuming project's own assets:

```javascript
// Used in src/index.js to load project-specific page modules
import(`__project_assets__/js/pages/${pageModulePath}`)
```

**How they work together:** `src/index.js` loads page modules from both aliases — first from `__main_assets__` (UJM defaults), then from `__project_assets__` (project overrides/extensions). If a project module doesn't exist, it gracefully skips. This enables a layered system where UJM provides defaults and consuming projects can extend or override page behavior.

**When to use which:**
- **`__main_assets__`** — When importing UJM-provided libraries, core modules, or referencing UJM's built-in page scripts
- **`__project_assets__`** — When a consuming project needs to import its own custom assets from within UJM-managed code

## Page Module Structure

All page modules must follow this standardized pattern:

```javascript
/**
 * [Page Name] Page JavaScript
 */

// Libraries
import webManager from 'web-manager';

// Module
export default () => {
  return new Promise(async function (resolve) {
    // Initialize when DOM is ready
    await webManager.dom().ready();

    // Page initialization logic
    helper1();

    // Resolve after initialization
    return resolve();
  });
};

// Helper functions
function helper1() {
  // Helper implementation
}
```

**Key Points:**
- `web-manager` is a singleton — `import webManager from 'web-manager'` returns the same initialized instance everywhere. No need to receive it via params or store in module-level variables.
- Helpers are defined outside the main export function
- Always wait for DOM ready before manipulating elements
- Use `webManager.utilities().escapeHTML()` for XSS prevention — do NOT write your own escape function. See [docs/xss-prevention.md](xss-prevention.md).
