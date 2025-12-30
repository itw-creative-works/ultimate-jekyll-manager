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

### Ultimate Jekyll Manager Files (THIS project)

**CSS:**
- `src/assets/css/ultimate-jekyll-manager.scss` - Main UJ stylesheet (provides core styles)
- `src/assets/css/global/` - Global UJ styles
- `src/assets/css/pages/` - Page-specific styles provided by UJ
  - Format: `src/assets/css/pages/[page-name]/index.scss`
  - Example: `src/assets/css/pages/download/index.scss`

**JavaScript:**
- `src/assets/js/ultimate-jekyll-manager.js` - Main UJ JavaScript entry point (provides core functionality)
- `src/assets/js/core/` - Core UJ modules
- `src/assets/js/pages/` - Page-specific JavaScript provided by UJ
  - Format: `src/assets/js/pages/[page-name]/index.js`
  - Example: `src/assets/js/pages/download/index.js`
- `src/assets/js/libs/` - UJ library modules (prerendered-icons, form-manager, authorized-fetch, etc.)

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
  - `src/defaults/dist/_layouts/core/root.html` - Root HTML wrapper
  - `src/defaults/dist/_layouts/themes/[theme-id]/frontend/core/base.html` - Theme base layout

**Complete UJ Page Example:**
- **HTML:** `src/defaults/dist/_layouts/themes/classy/frontend/pages/download.html`
- **CSS:** `src/assets/css/pages/download/index.scss`
- **JS:** `src/assets/js/pages/download/index.js`

These files serve as blueprints and reference implementations. When building custom pages in consuming projects, reference these for patterns and best practices.

**IMPORTANT:** Consuming projects CAN create files with the same paths in their own `src/` directory to override UJ defaults, but this should ONLY be done when absolutely necessary. Prefer using `src/pages/` and `src/_layouts/` for custom pages instead of overriding UJ default files.

### Section Configuration Files (JSON)

UJ provides JSON configuration files for common sections like navigation and footer. These JSON files are consumed by corresponding HTML templates during the build process.

**Configuration Files:**
- `src/defaults/src/_includes/frontend/sections/nav.json` - Navigation configuration
- `src/defaults/src/_includes/frontend/sections/footer.json` - Footer configuration

**How It Works:**
1. JSON files contain structured data (links, labels, settings)
2. HTML templates in `src/defaults/dist/_includes/themes/[theme-id]/frontend/sections/` read and render this data
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

### Customizing Default Pages via Frontmatter

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

### Consuming Project Files

**CSS:**
- `src/assets/css/main.scss` - Site-wide custom styles (runs on every page, edits by consuming project)
- `src/assets/css/pages/` - Page-specific custom styles
  - Format: `src/assets/css/pages/[page-name]/index.scss`

**JavaScript:**
- `src/assets/js/main.js` - Site-wide custom JavaScript (runs on every page, edits by consuming project)
- `src/assets/js/pages/` - Page-specific custom JavaScript
  - Format: `src/assets/js/pages/[page-name]/index.js`

**Pages & Layouts:**
- `src/pages/` - Individual page HTML/Markdown files
- `src/_layouts/` - Custom layouts for the consuming project

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

**Available Icon Sizes:**
- `fa-2xs` - Extra extra small
- `fa-xs` - Extra small
- `fa-sm` - Small
- `fa-md` - Medium (default base size)
- `fa-lg` - Large
- `fa-xl` - Extra large
- `fa-2xl` - 2x extra large
- `fa-3xl` - 3x extra large
- `fa-4xl` - 4x extra large
- `fa-5xl` - 5x extra large

**Size Examples:**
```liquid
{% uj_icon "check", "fa-sm" %}     <!-- Small inline icon -->
{% uj_icon "star", "fa-lg" %}      <!-- Slightly larger -->
{% uj_icon "rocket", "fa-2xl" %}   <!-- Hero/feature icons -->
{% uj_icon "chart-pie", "fa-4xl" %}<!-- Large placeholder icons -->
```

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

**⚠️ IMPORTANT: Auth State Requirement**

`authorizedFetch` requires Firebase Auth to have determined the current user's authentication state before being called. On fresh page loads (e.g., OAuth callback pages, deep links), Firebase Auth needs time to restore the session from IndexedDB/localStorage.

**If called before auth state is determined, it will throw: `"No authenticated user found"`**

**Solution:** Wait for auth state before calling `authorizedFetch`:

```javascript
// Wait for auth state to be determined (fires once auth is known)
webManager.auth().listen({ once: true }, async () => {
  // Now safe to use authorizedFetch
  const response = await authorizedFetch(url, options);
});
```

**When this matters:**
- Pages that load and immediately need to make authenticated API calls
- OAuth callback pages (user returns from external auth provider)
- Deep links that require authenticated requests on load

**When NOT needed:**
- User-triggered actions (button clicks, form submissions) - by then auth state is always determined
- Pages that wait for user interaction before making API calls

**Reference:** `src/assets/js/libs/authorized-fetch.js`

#### FormManager Library

Lightweight form state management library with built-in validation, state machine, and event system.

**Import:**
```javascript
import { FormManager } from '__main_assets__/js/libs/form-manager.js';
```

**Basic Usage:**
```javascript
const formManager = new FormManager('#my-form', options);

formManager.on('submit', async ({ data, $submitButton }) => {
  const response = await fetch('/api', { body: JSON.stringify(data) });
  if (!response.ok) throw new Error('Failed');
  formManager.showSuccess('Form submitted!');
});
```

**State Machine:**
```
initializing → ready ⇄ submitting → ready (or submitted)
```

**Configuration Options:**
```javascript
{
  autoReady: true,           // Auto-transition to initialState when DOM ready
  initialState: 'ready',     // State after autoReady fires
  allowResubmit: true,       // Allow resubmission after success (false = 'submitted' state)
  resetOnSuccess: false,     // Clear form fields after successful submission
  warnOnUnsavedChanges: false, // Warn user before leaving with unsaved changes
  submittingText: 'Processing...', // Text shown on submit button during submission
  submittedText: 'Processed!', // Text shown on submit button after success (when allowResubmit: false)
  inputGroup: null           // Filter getData() by data-input-group attribute (null = all fields)
}
```

**Events:**

| Event | Payload | Description |
|-------|---------|-------------|
| `submit` | `{ data, $submitButton }` | Form submission (throw error to show failure) |
| `validation` | `{ data, setError }` | Custom validation before submit |
| `change` | `{ field, name, value, data }` | Field value changed |
| `statechange` | `{ state, previousState }` | State transition |
| `honeypot` | `{ data }` | Honeypot triggered (for spam tracking) |

**Validation System:**

FormManager runs validation automatically before `submit`:
1. **HTML5 validation** - Checks `required`, `minlength`, `maxlength`, `min`, `max`, `pattern`, `type="email"`, `type="url"`
2. **Custom validation** - Use `validation` event for business logic

```javascript
fm.on('validation', ({ data, setError }) => {
  if (data.age && parseInt(data.age) < 18) {
    setError('age', 'You must be 18 or older');
  }
});
```

Errors display with Bootstrap's `is-invalid` class and `.invalid-feedback` elements.

**Autofocus:**

When the form transitions to `ready` state, FormManager automatically focuses the field with the `autofocus` attribute (if present and not disabled).

**Methods:**

| Method | Description |
|--------|-------------|
| `on(event, callback)` | Register event listener (chainable) |
| `ready()` | Transition to ready state |
| `getData()` | Get form data as nested object (supports dot notation, respects input group filter) |
| `setData(obj)` | Set form values from nested object |
| `setInputGroup(group)` | Set input group filter (string, array, or null) |
| `getInputGroup()` | Get current input group filter |
| `showSuccess(msg)` | Show success notification |
| `showError(msg)` | Show error notification |
| `reset()` | Reset form and go to ready state |
| `isDirty()` | Check if form has unsaved changes |
| `setDirty(bool)` | Set dirty state |
| `clearFieldErrors()` | Clear all field validation errors |
| `throwFieldErrors({ field: msg })` | Set and display field errors, throw error |

**Nested Field Names (Dot Notation):**

Use dot notation in field names for nested data:
```html
<input name="user.address.city" value="NYC">
```

Results in:
```javascript
{ user: { address: { city: 'NYC' } } }
```

**Input Groups:**

Filter `getData()` to only return fields matching a specific group. Fields without `data-input-group` are "global" and always included.

```html
<!-- Global fields (no data-input-group) - always included -->
<input name="settings.theme" value="dark">

<!-- Group-specific fields -->
<input name="options.url" data-input-group="url" value="https://example.com">
<input name="options.ssid" data-input-group="wifi" value="MyWiFi">
<input name="options.password" data-input-group="wifi" value="secret123">
```

```javascript
// Set group filter (accepts string or array)
formManager.setInputGroup('url');           // Single group
formManager.setInputGroup(['url', 'wifi']); // Multiple groups
formManager.setInputGroup(null);            // Clear filter (all fields)

// Get current filter
formManager.getInputGroup(); // Returns ['url'] or null

// getData() respects the filter
formManager.setInputGroup('wifi');
formManager.getData();
// Returns: { settings: { theme: 'dark' }, options: { ssid: 'MyWiFi', password: 'secret123' } }
// Note: 'url' field excluded, global 'settings.theme' included
```

Can also be set via config:
```javascript
const fm = new FormManager('#form', { inputGroup: 'wifi' });
```

**Honeypot (Bot Detection):**

FormManager automatically rejects submissions if a honeypot field is filled. Honeypot fields are hidden from users but bots fill them automatically.

```html
<!-- Hidden from users via CSS -->
<input type="text" name="honey" autocomplete="off" tabindex="-1"
       style="position: absolute; left: -9999px;" aria-hidden="true">
```

Fields matching `[data-honey]` or `[name="honey"]` are:
- Excluded from `getData()` output
- Checked during validation — if filled, submission is rejected with generic error

**Checkbox Handling:**
- **Single checkbox:** Returns `true`/`false`
- **Checkbox group (same name):** Returns object `{ value1: true, value2: false }`

**Multiple Submit Buttons:**

Access the clicked button via `$submitButton`:
```html
<button type="submit" data-action="save">Save</button>
<button type="submit" data-action="draft">Save Draft</button>
```

```javascript
fm.on('submit', async ({ data, $submitButton }) => {
  const action = $submitButton?.dataset?.action; // 'save' or 'draft'
});
```

**Reference:** `src/assets/js/libs/form-manager.js`
**Test Page:** `src/assets/js/pages/test/libraries/form-manager/index.js`
**Example:** `src/assets/js/pages/contact/index.js`

## Analytics & Tracking

Ultimate Jekyll uses three tracking platforms: Google Analytics (gtag), Facebook Pixel (fbq), and TikTok Pixel (ttq).

### ITM (Internal Tracking Medium)

Internal tracking system modeled after UTM for cross-property user journey tracking.

| Parameter | Purpose | Examples |
|-----------|---------|----------|
| `itm_source` | Platform/origin | `website`, `browser-extension`, `app`, `email` |
| `itm_medium` | Delivery mechanism | `modal`, `prompt`, `banner`, `tooltip` |
| `itm_campaign` | Specific campaign/feature | `exit-popup`, `premium-unlock`, `newsletter-signup` |
| `itm_content` | Specific context | Page path, feature ID, variant |

**Examples:**
```
# Website exit popup
?itm_source=website&itm_medium=modal&itm_campaign=exit-popup&itm_content=/pricing

# Extension premium unlock
?itm_source=browser-extension&itm_medium=prompt&itm_campaign=premium-unlock&itm_content=bulk-export
```

### Tracking Guidelines

**IMPORTANT Rules:**
- Track important user events with `gtag()`, `fbq()`, and `ttq()` functions
- NEVER add conditional checks for tracking functions (e.g., `if (typeof gtag !== 'undefined')`)
- Always assume tracking functions exist - they're globally available or stubbed
- Reference standard events documentation before implementing custom tracking

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

### Tracking Implementation

**IMPORTANT:** Always track events to ALL THREE platforms in this order:
1. Google Analytics (gtag)
2. Facebook Pixel (fbq)
3. TikTok Pixel (ttq)

Track events directly without existence checks. All three tracking calls should be made together for every event.

**Development Mode:**
In development mode, all tracking calls are intercepted and logged to the console for debugging. See `src/assets/js/libs/dev.js` for implementation.

## HTML Element Attributes

The `<html>` element has data attributes for JavaScript/CSS targeting:

| Attribute | Values |
|-----------|--------|
| `data-theme-id` | Theme ID (e.g., `classy`) |
| `data-theme-target` | `frontend`, `backend`, `docs` |
| `data-bs-theme` | `light`, `dark` |
| `data-page-path` | Page permalink (e.g., `/about`) |
| `data-asset-path` | Custom asset path or empty |
| `data-environment` | `development`, `production` |
| `data-platform` | `windows`, `mac`, `linux`, `ios`, `android`, `chromeos`, `unknown` |
| `data-browser` | `chrome`, `firefox`, `safari`, `edge`, `opera`, `brave` |
| `data-device` | `mobile` (<768px), `tablet` (768-1199px), `desktop` (>=1200px) |
| `data-runtime` | `web`, `browser-extension`, `electron`, `node` |
| `aria-busy` | `true` (loading), `false` (ready) |

**Detection source:** `web-manager/src/modules/utilities.js`

## Audit Workflow

When fixing issues identified by the audit task (`src/gulp/tasks/audit.js`):

1. Review the audit file location provided
2. Create a TODO list for each audit category
3. Read the ENTIRE audit file and plan fixes for each category
4. Tackle issues incrementally - DO NOT attempt to fix everything at once
5. Work through one category at a time

**Remember:** Audit files are large. Systematic, incremental fixes prevent errors and ensure thoroughness.
