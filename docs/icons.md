# Icon System

Ultimate Jekyll uses Font Awesome icons but does NOT include the Font Awesome JavaScript or CSS library. All icons must be rendered server-side using Jekyll's `{% uj_icon %}` tag.

## Available Icons

UJM ships with the **full Font Awesome Pro solid icon set** (4,600+ icons) at `assets/icons/font-awesome/solid/`, plus brand icons at `assets/icons/font-awesome/brands/`. Any Pro or Free solid/brand icon name can be used with `{% uj_icon %}` and prerendered icons. The icon style defaults to `solid` and can be configured via `site.config.icons.style`.

Browse available icons at: https://fontawesome.com/icons

## When to Use `{% uj_icon %}` vs Prerendered Icons

**IMPORTANT:** Use the correct method based on WHERE the icon will be used:

### Use `{% uj_icon %}` in HTML/Liquid Templates

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

**Parameters:**
1. Icon name (string or variable, without "fa-" prefix)
2. CSS classes (optional, defaults to "fa-3xl")

### Available Icon Sizes

- `fa-2xs` — Extra extra small
- `fa-xs` — Extra small
- `fa-sm` — Small
- `fa-md` — Medium (default base size)
- `fa-lg` — Large
- `fa-xl` — Extra large
- `fa-2xl` — 2x extra large
- `fa-3xl` — 3x extra large
- `fa-4xl` — 4x extra large
- `fa-5xl` — 5x extra large

**Size Examples:**

```liquid
{% uj_icon "check", "fa-sm" %}     <!-- Small inline icon -->
{% uj_icon "star", "fa-lg" %}      <!-- Slightly larger -->
{% uj_icon "rocket", "fa-2xl" %}   <!-- Hero/feature icons -->
{% uj_icon "chart-pie", "fa-4xl" %}<!-- Large placeholder icons -->
```

### Use Prerendered Icons in JavaScript

When icons need to be dynamically inserted via JavaScript, pre-render them in frontmatter and access them via the library:

**1. Add icons to page frontmatter (names only, no classes):**

```yaml
---
prerender_icons:
  - name: "mobile"
  - name: "envelope"
  - name: "bell"
---
```

**2. Import the library in JavaScript:**

```javascript
import { getPrerenderedIcon } from '__main_assets__/js/libs/prerendered-icons.js';
```

**3. Use in your code (second argument works like uj_icon's second argument):**

```javascript
// With size + classes (same as {% uj_icon "mobile", "fa-sm me-1" %})
$badge.innerHTML = `${getPrerenderedIcon('mobile', 'fa-sm me-1')} Push Notification`;

// Without classes (no size class on the <i> wrapper)
$el.innerHTML = getPrerenderedIcon('bell');
```

**Use this when:**
- Icons are dynamically inserted via JavaScript
- Icons are part of dynamically generated content
- Icons are added to elements created with `document.createElement()`

## What NOT to Do

**NEVER use manual icon HTML in JavaScript:**

```javascript
// ❌ WRONG - Bootstrap Icons (we don't use Bootstrap Icons)
$el.innerHTML = '<i class="bi bi-check-circle"></i> Text';

// ❌ WRONG - Manual Font Awesome (we don't have FA JS/CSS)
$el.innerHTML = '<i class="fa-solid fa-check"></i> Text';

// ✅ CORRECT - Use prerendered icons
$el.innerHTML = `${getPrerenderedIcon('circle-check', 'fa-sm me-1')} Text`;
```

## Benefits

- Icons are rendered server-side with proper Font Awesome classes
- No client-side icon generation overhead
- Consistent icon styling across the application
- No Font Awesome JavaScript/CSS library needed
