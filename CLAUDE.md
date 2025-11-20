# Ultimate Jekyll Manager

## Project Overview

Ultimate Jekyll Manager is a template framework that consuming projects install as an NPM module to build Jekyll sites quickly and efficiently. It provides best-practice configurations, default components, themes, and build tools.

**Important:** This is NOT a standalone project. You cannot run `npm start` or `npm run build` directly in this repository.

## Project Structure

### Directory Organization
- `src/gulp/tasks` - Gulp tasks for building Jekyll sites
- `src/defaults/src` - Default source files (editable by users, copied to consuming project's `src/`)
- `src/defaults/dist` - Default distribution files (not editable by users, copied to consuming project's `dist/`)
- `src/assets/css` - Stylesheets (global, pages, themes)
- `src/assets/js` - JavaScript modules (core, pages, libraries)
- `src/assets/themes` - Theme SCSS and JS files

### Consuming Project Structure
- `src/` - Compiled to `dist/` via npm
- `dist/` - Compiled to `_site/` via Jekyll

## Local Development

The local development server URL is stored in `.temp/_config_browsersync.yml` in the consuming project's root directory. Read this file to determine the correct URL for browsing and testing.

## Asset Organization

### CSS Architecture
- `src/assets/css/ultimate-jekyll-manager.scss` - Main UJ stylesheet
- `src/assets/css/main.scss` - Site-wide styles (runs on every page)
- `src/assets/css/global/` - Global UJ styles
- `src/assets/css/pages/` - Page-specific styles
  - Format: `src/assets/css/pages/[page-name]/index.scss`

### JavaScript Architecture
- `src/assets/js/ultimate-jekyll-manager.js` - Main UJ JavaScript entry point
- `src/assets/js/main.js` - Site-wide JavaScript (runs on every page)
- `src/assets/js/core/` - Core UJ modules
- `src/assets/js/pages/` - Page-specific JavaScript
  - Format: `src/assets/js/pages/[page-name]/index.js`

**Asset Loading:** Page-specific CSS/JS files are automatically included based on the page's canonical path. Override with `asset_path` frontmatter.

### Page Module Structure

All page modules must follow this standardized pattern:

```javascript
/**
 * [Page Name] Page JavaScript
 */

// Libraries
let webManager = null;

// Module
export default (Manager) => {
  return new Promise(async function (resolve) {
    // Shortcuts
    webManager = Manager.webManager;

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
- Helpers are defined outside the main export function
- Use `webManager` shortcuts for common operations
- Always wait for DOM ready before manipulating elements

## Layouts and Pages

### Page Types
- **One-off pages** (e.g., `/categories`, `/sitemap`) - Create as pages without custom layouts; use existing layouts
- **Repeating page types** (e.g., blog posts, category pages) - Create a dedicated layout (e.g., `_layouts/category.html`)

### Layout Requirements
All layouts and pages must eventually require a theme entry point:
```yaml
layout: themes/[ site.theme.id ]/frontend/core/base
```

**Note:** The `[ site.theme.id ]` syntax is correct and allows dynamic theme selection.

### Asset Path Configuration

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

## UJ Powertools (Jekyll Plugin)

Ultimate Jekyll uses the `jekyll-uj-powertools` gem for custom Liquid functionality.

**Documentation:** `/Users/ian/Developer/Repositories/ITW-Creative-works/jekyll-uj-powertools/README.md`

### Available Features
- **Filters:** `uj_strip_ads`, `uj_json_escape`, `uj_title_case`, `uj_content_format`
- **Tags:** `iftruthy`, `iffalsy`, `uj_icon`, `uj_logo`, `uj_image`, `uj_member`, `uj_post`, `uj_readtime`, `uj_social`, `uj_translation_url`, `uj_fake_comments`, `uj_language`
- **Global Variables:** `site.uj.cache_breaker`
- **Page Variables:** `page.random_id`, `page.extension`, `page.layout_data`, `page.resolved`

**Always check the README before assuming functionality.**

### Key Liquid Functions

#### `uj_content_format`
Formats content by first liquifying it, then markdownifying it (if markdown file).

#### `iftruthy` / `iffalsy`
Custom tags that check JavaScript truthiness (not null, undefined, or empty string).

```liquid
{% iftruthy variable %}
  <!-- Content -->
{% endiftruthy %}
```

**Limitations:**
- Does NOT support logical operators
- Does NOT support `else` statements
- CAN contain nested sub-statements

#### `page.resolved`
A deeply merged object containing all site, layout, and page variables. Precedence: page > layout > site. Enables a system of defaults with progressive overrides.

#### `uj_icon`
Inserts Font Awesome icons:

```liquid
{% uj_icon icon-name, "fa-md" %}
{% uj_icon "rocket", "fa-3xl" %}
```

**Parameters:**
1. Icon name (string or variable, without "fa-" prefix)
2. CSS classes (optional, defaults to "fa-3xl")

#### `asset_path` Override
Override default page-specific CSS/JS path derivation:

```yaml
---
asset_path: blog/post
---
```

Uses `/assets/css/pages/{{ asset_path }}.bundle.css` instead of deriving from `page.canonical.path`. Useful when multiple pages share assets (e.g., all blog posts).

## Icon System

Ultimate Jekyll uses Font Awesome icons but does NOT include the Font Awesome JavaScript or CSS library. All icons must be rendered server-side using Jekyll's `{% uj_icon %}` tag.

### When to Use `{% uj_icon %}` vs Prerendered Icons

**IMPORTANT:** Use the correct method based on WHERE the icon will be used:

#### Use `{% uj_icon %}` in HTML/Liquid Templates

When icons are part of the static HTML template, use `{% uj_icon %}` directly:

```liquid
<!-- Alerts -->
<div class="alert alert-success">
  {% uj_icon "circle-check", "fa-sm" %} Success message
</div>

<!-- Buttons -->
<button class="btn btn-primary">
  {% uj_icon "paper-plane", "fa-md me-2" %}
  Send
</button>

<!-- Labels -->
<label>
  {% uj_icon "envelope", "fa-sm me-1 text-info" %}
  Email
</label>
```

**Use this when:**
- The icon is in a Jekyll template (.html file)
- The icon is static and known at build time
- The icon is part of the page structure

#### Use Prerendered Icons in JavaScript

When icons need to be dynamically inserted via JavaScript, pre-render them in frontmatter and access them via the library:

**1. Add icons to page frontmatter:**
```yaml
---
prerender_icons:
  - name: "mobile"
    class: "fa-sm me-1"
  - name: "envelope"
    class: "fa-sm me-1"
  - name: "bell"
    class: "fa-sm me-1"
---
```

**2. Import the library in JavaScript:**
```javascript
import { getPrerenderedIcon } from '__main_assets__/js/libs/prerendered-icons.js';
```

**3. Use in your code:**
```javascript
const iconHTML = getPrerenderedIcon('mobile');
$badge.innerHTML = `${iconHTML}Push Notification`;
```

**Use this when:**
- Icons are dynamically inserted via JavaScript
- Icons are part of dynamically generated content
- Icons are added to elements created with `document.createElement()`

### What NOT to Do

**NEVER use manual icon HTML in JavaScript:**
```javascript
// ❌ WRONG - Bootstrap Icons (we don't use Bootstrap Icons)
$el.innerHTML = '<i class="bi bi-check-circle"></i> Text';

// ❌ WRONG - Manual Font Awesome (we don't have FA JS/CSS)
$el.innerHTML = '<i class="fa-solid fa-check"></i> Text';

// ✅ CORRECT - Use prerendered icons
const iconHTML = getPrerenderedIcon('circle-check');
$el.innerHTML = `${iconHTML} Text`;
```

### Benefits
- Icons are rendered server-side with proper Font Awesome classes
- No client-side icon generation overhead
- Consistent icon styling across the application
- No Font Awesome JavaScript/CSS library needed

## CSS Guidelines

### Theme-Adaptive Classes

**DO NOT USE:** `bg-light`, `bg-dark`, `text-light`, `text-dark`

Ultimate Jekyll supports both light and dark modes. Use adaptive classes instead:

**Backgrounds:**
- `bg-body` - Primary background
- `bg-body-secondary` - Secondary background
- `bg-body-tertiary` - Tertiary background

**Text:**
- `text-body` - Body text color

**Buttons:**
- `btn-adaptive` - Adaptive button
- `btn-outline-adaptive` - Adaptive outline button

These classes automatically adapt to the current theme mode.

## Page Loading Protection System

Ultimate Jekyll prevents race conditions by disabling buttons during JavaScript initialization.

### How It Works
1. HTML element starts with `data-page-loading="true"` and `aria-busy="true"` (`src/defaults/dist/_layouts/core/root.html`)
2. Protected elements are automatically disabled during this state
3. Attributes are removed when JavaScript completes (`src/assets/js/core/complete.js`)

### Protected Elements
- All form buttons (`<button>`, `<input type="submit">`, `<input type="button">`, `<input type="reset">`)
- Elements with `.btn` class (Bootstrap buttons)
- Elements with `.btn-action` class (custom action triggers)

### The `.btn-action` Class

Selectively protect non-standard elements that trigger important actions:

```html
<!-- Protected during page load -->
<a href="/api/delete" class="custom-link btn-action">Delete Item</a>
<div class="card-action btn-action" onclick="processData()">Process</div>

<!-- NOT protected (regular navigation/UI) -->
<a href="/about" class="btn btn-primary">About Us</a>
<button data-bs-toggle="modal">Show Info</button>
```

**Use `.btn-action` for:**
- API calls
- Form submissions
- Data modifications
- Payment processing
- Destructive actions

**Don't use for:**
- Navigation links
- UI toggles (modals, accordions, tabs)
- Harmless interactions

### Implementation
- **CSS:** `src/assets/css/core/utilities.scss` - Disabled styling
- **Click Prevention:** `src/defaults/dist/_includes/core/body.html` - Inline script
- **State Removal:** `src/assets/js/core/complete.js` - Removes loading state

## Lazy Loading System

Ultimate Jekyll uses a custom lazy loading system powered by web-manager.

### Syntax
```html
data-lazy="@type value"
```

### Supported Types

#### `@src` - Lazy load src attribute
```html
<img data-lazy="@src /assets/images/hero.jpg" alt="Hero">
<iframe data-lazy="@src https://example.com/embed"></iframe>
```

#### `@srcset` - Lazy load srcset attribute
```html
<img data-lazy="@srcset /img/small.jpg 480w, /img/large.jpg 1024w">
```

#### `@bg` - Lazy load background images
```html
<div data-lazy="@bg /assets/images/background.jpg"></div>
```

#### `@class` - Lazy add CSS classes
```html
<div data-lazy="@class animation-fade-in">Content</div>
```

#### `@html` - Lazy inject HTML content
```html
<div data-lazy="@html <p>Lazy loaded content</p>"></div>
```

#### `@script` - Lazy load external scripts
```html
<div data-lazy='@script {"src": "https://example.com/widget.js", "attributes": {"async": true}}'></div>
```

### Features
- Automatic cache busting via `buildTime`
- IntersectionObserver for performance (50px threshold)
- Loading state CSS classes: `lazy-loading`, `lazy-loaded`, `lazy-error`
- Intelligent handling of video/audio sources
- Automatic DOM re-scanning for dynamic elements

**Implementation:** `src/assets/js/core/lazy-loading.js`

## JavaScript Libraries

### WebManager

Custom library for site management functionality.

**Documentation:** `/Users/ian/Developer/Repositories/ITW-Creative-Works/web-manager/README.md`

**Available Utilities:**
- `webManager.auth()` - Authentication management
- `webManager.utilities()` - Utility functions
- `webManager.sentry()` - Error tracking
- `webManager.dom()` - DOM manipulation

**Important:** Always check the source code or README before assuming a function exists. Do not guess at API methods.

### Ultimate Jekyll Libraries

Ultimate Jekyll provides helper libraries in `src/assets/js/libs/` that can be imported as needed.

#### Prerendered Icons Library

Provides access to icons defined in page frontmatter and rendered server-side.

**Import:**
```javascript
import { getPrerenderedIcon } from '__main_assets__/js/libs/prerendered-icons.js';
```

**Usage:**
```javascript
const iconHTML = getPrerenderedIcon('apple');
```

**Reference:** `src/assets/js/libs/prerendered-icons.js`

#### Authorized Fetch Library

Simplifies authenticated API requests by automatically adding Firebase authentication tokens via Authorization Bearer header.

**Import:**
```javascript
import authorizedFetch from '__main_assets__/js/libs/authorized-fetch.js';
```

**Usage:**
```javascript
const response = await authorizedFetch(url, options);
```

**Key Benefits:**
- No need to manually call `webManager.auth().getIdToken()`
- Automatic token injection as Authorization Bearer header
- Centralized authentication handling

**Reference:** `src/assets/js/libs/authorized-fetch.js`

#### FormManager Library

Form handling library with built-in state management and validation.

**Import:**
```javascript
import { FormManager } from '__main_assets__/js/libs/form-manager.js';
```

**Usage:**
```javascript
const formManager = new FormManager('#my-form', options);
```

**Reference:** `src/assets/js/libs/form-manager.js`
**Example:** `src/assets/js/pages/contact/index.js`

## Analytics & Tracking

Ultimate Jekyll uses three tracking platforms: Google Analytics (gtag), Facebook Pixel (fbq), and TikTok Pixel (ttq).

### Tracking Guidelines

**IMPORTANT Rules:**
- Track important user events with Google Analytics, Facebook Pixel, and TikTok Pixel
- NEVER add conditional checks for tracking functions (e.g., `if (typeof gtag !== 'undefined')`)
- Always assume tracking functions exist - they're globally available or stubbed
- Reference standard events documentation before implementing custom tracking
- Always track events to ALL THREE platforms in this order:
  1. Google Analytics (gtag)
  2. Facebook Pixel (fbq)
  3. TikTok Pixel (ttq)
- Put all 3 tracking events in their own function per event for clarity

**Standard Events Documentation:**
- **Google Analytics GA4:** https://developers.google.com/analytics/devguides/collection/ga4/reference/events
- **Facebook Pixel:** https://www.facebook.com/business/help/402791146561655?id=1205376682832142
- **TikTok Pixel:** https://ads.tiktok.com/help/article/standard-events-parameters?redirected=2

### Platform-Specific Requirements

#### TikTok Pixel Requirements
TikTok has strict validation requirements:

**Required Parameters:**
- `content_id` - MUST be included in all events

**Valid Content Types:**
- `"product"`
- `"product_group"`
- `"destination"`
- `"hotel"`
- `"flight"`
- `"vehicle"`

Any other content type will generate a validation error.

**Example:**
```javascript
// ✅ CORRECT
ttq.track('ViewContent', {
  content_id: 'product-123',
  content_type: 'product'
});

// ❌ WRONG - Missing content_id
ttq.track('ViewContent', {
  content_type: 'product'
});

// ❌ WRONG - Invalid content_type
ttq.track('ViewContent', {
  content_id: 'product-123',
  content_type: 'custom'  // Not in approved list
});
```


## Audit Workflow

When fixing issues identified by the audit task (`src/gulp/tasks/audit.js`):

1. Review the audit file location provided
2. Create a TODO list for each audit category
3. Read the ENTIRE audit file and plan fixes for each category
4. Tackle issues incrementally - DO NOT attempt to fix everything at once
5. Work through one category at a time

**Remember:** Audit files are large. Systematic, incremental fixes prevent errors and ensure thoroughness.
