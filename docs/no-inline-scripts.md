# NO JavaScript in HTML Files — Hard Rule

**THIS IS NON-NEGOTIABLE.** No `<script>` tag with an inline JS body is ever allowed in any file under `src/` — not pages, not components (`_includes/`), not layouts (`_layouts/`). If you find one, you move it. If you write one, you are wrong.

## Why this rule exists

1. **UJM auto-loads page modules.** The framework already provides a first-class mechanism: `src/assets/js/pages/<pagePath>/index.js` runs automatically for each page based on `data-page-path`. Inline scripts bypass this system, fragment the codebase, and make code impossible to lint/test/bundle properly.
2. **Inline scripts break module boundaries.** They can't `import` anything, can't be code-split, can't be tree-shaken, and have to re-declare every helper.
3. **Inline scripts hide bugs.** They often reference globals (`Manager`, `firebase`, `webManager.uj`) that aren't exposed, breaking silently at runtime.
4. **Inline scripts duplicate logic.** The same drop-down/demo/filter logic gets copy-pasted into many files instead of being shared from a single module.
5. **Inline scripts are a historical accident.** Old UJM (pre-2.0) exposed `Manager` globally and encouraged inline scripts. That's gone. Any inline script you see in a repo is migration debt that must be paid.

## The rule, stated precisely

For every `<script>` tag in `src/**/*.html` under a UJM project:

| Tag shape | Allowed? | Why |
|-----------|----------|-----|
| `<script>...body...</script>` with JS body | ❌ **NEVER** | Move the body to a JS module (see below) |
| `<script src="https://..."></script>` | ✅ OK | External loader, no inline code |
| `<script type="application/ld+json">...</script>` | ✅ OK | Structured data, not JS |
| `<script type="module" src="..."></script>` | ✅ OK | External ES module, no inline code |
| `<script>` with ≤10 lines of trivial first-paint display | ✅ OK with comment | Small helpers that must run before the bundle |

**The "small helper" exception must meet ALL of these:**

- Under ~10 lines of code
- Does a single cosmetic first-paint task (e.g. replacing a `--:--:--` placeholder with the current time)
- Would cause visible flash/flicker if deferred to the bundle
- Has an inline comment explaining why it's intentionally inline

If in doubt, move it. The exception is for ≤10-line display polyfills, NOT for 20-line "quick" handlers.

## Where to move the script

### Case 1: The script is inside a **page** file (`src/pages/<something>.html` or `.md`)

Move it to `src/assets/js/pages/<pagePath>/index.js` — the path is derived from the page's frontmatter `permalink:`.

| Page frontmatter | Page module path |
|------------------|------------------|
| `permalink: /` | `src/assets/js/pages/index.js` |
| `permalink: /contact` | `src/assets/js/pages/contact/index.js` |
| `permalink: /dashboard/history` | `src/assets/js/pages/dashboard/history/index.js` |
| `permalink: /tools/form-builder` | `src/assets/js/pages/tools/form-builder/index.js` |

**Always check if the target file already exists.** If it does, MERGE your logic into the existing `export default` function. DO NOT overwrite.

Module template:

```javascript
/**
 * <Page Name> Page JavaScript
 */

import webManager from 'web-manager';

export default async () => {
  await webManager.dom().ready();

  // ... moved logic ...
};
```

### Case 2: The script is inside a **component** (`src/_includes/**/*.html`)

Components are Jekyll partials — they don't have a single "page path" because they can be included in many pages. Two strategies:

**Option A — Used by exactly one page:** Move the script to that one page's `src/assets/js/pages/<path>/index.js`. Simpler, more scoped.

**Option B — Used by multiple pages (or you can't tell):** Move the script to `src/assets/js/main.js` as an `init<ComponentName>()` function with an **element-existence guard** so it's a no-op on pages without the component.

```javascript
// src/assets/js/main.js
import Manager from 'ultimate-jekyll-manager';
import webManager from 'web-manager';

const manager = new Manager();

manager.initialize().then(() => {
  // Each component gets its own init function with a guard
  initHeroDemo();
  initChatDemo();
  initScheduler();
});

function initHeroDemo() {
  // Element-existence guard — MUST be the first thing in the function
  const $toggle = document.getElementById('hero-demo-toggle');
  if (!$toggle) return;

  // ... moved logic ...
}
```

**How to pick the guard element:** use the first `getElementById` / `querySelector` the original script called. If that element isn't on the page, the original script would have crashed anyway, so returning early is safe.

### Case 3: The script is inside a **layout** (`src/_layouts/**/*.html`)

Same as components: grep for `layout: <layout-path>` across pages. If one page uses it, move to that page's module. If multiple, move to `main.js` with a guard.

## Handling Liquid templating inside a script

This is the trickiest case, and the one that trips most people up. **Jekyll Liquid (`{{ ... }}`, `{% ... %}`) runs at BUILD TIME on HTML files. Webpack-bundled JS modules under `src/assets/js/` are NOT processed by Jekyll** — any Liquid you leave inside a `.js` file will appear as literal text in the output.

### Strategy A: `data-*` attribute bridge (for Liquid values)

Use this when the script reads values from Liquid, e.g. `{{ site.url }}`, `{{ include.action1 | default: "..." }}`, `{{ page.items | jsonify }}`.

**Before (broken inline script):**

```html
<!-- src/_includes/frontend/components/hero-demo.html -->
<script>
  var platform = '{{ include.platform }}';
  var actions = [
    '{{ include.action1 | default: "Like" }}',
    '{{ include.action2 | default: "Share" }}',
  ];
  var items = {{ page.items | jsonify }};
</script>
```

**After:**

```html
<!-- src/_includes/frontend/components/hero-demo.html -->
<!-- Hidden config element — Jekyll fills data attributes at build time -->
<div id="hero-demo-config"
     data-platform="{{ include.platform }}"
     data-action-1="{{ include.action1 | default: 'Like' }}"
     data-action-2="{{ include.action2 | default: 'Share' }}"
     data-items='{{ page.items | jsonify }}'
     hidden></div>

<!-- ... rest of component markup ... -->

<!-- Logic moved to src/assets/js/main.js (initHeroDemo) -->
```

```javascript
// src/assets/js/main.js
function initHeroDemo() {
  const $config = document.getElementById('hero-demo-config');
  if (!$config) return;

  const platform = $config.dataset.platform;
  const actions = [
    $config.dataset.action1,
    $config.dataset.action2,
  ];
  const items = JSON.parse($config.dataset.items);

  // ... moved logic ...
}
```

**Notes on data attributes:**

- Use kebab-case in HTML (`data-action-1`), which maps to camelCase in JS (`.dataset.action1`).
- For `| jsonify` output, wrap the attribute value in single quotes: `data-items='{{ x | jsonify }}'` (jsonify emits double-quoted JSON).
- For complex objects, use `| jsonify` → `data-json='...'` → `JSON.parse($config.dataset.json)`.

### Strategy B: `<template>` element cloning (for Liquid render tags)

Use this when the script interpolates Liquid render tags like `{% uj_icon "name" %}` or `{% include partials/x.html %}` into HTML strings it builds.

**Before (broken inline script):**

```html
<!-- Inline script tries to build HTML string with Liquid render tag -->
<script>
  el.innerHTML = '<span class="icon">{% uj_icon "arrow-pointer", "smaller" %}</span>';
</script>
```

**After:**

```html
<!-- Hidden templates — Jekyll renders the icon markup inside at build time -->
<template id="hero-demo-icon-arrow-pointer">{% uj_icon "arrow-pointer", "smaller" %}</template>
<template id="hero-demo-icon-eye">{% uj_icon "eye", "smaller" %}</template>

<!-- ... rest of component markup ... -->

<!-- Logic moved to src/assets/js/main.js (initHeroDemo) -->
```

```javascript
// src/assets/js/main.js
function getIcon(name) {
  const $template = document.getElementById('hero-demo-icon-' + name);
  return $template ? $template.content.cloneNode(true) : document.createTextNode('');
}

function initHeroDemo() {
  const $container = document.getElementById('hero-demo');
  if (!$container) return;

  // Build DOM nodes programmatically — NO innerHTML string building
  const $span = document.createElement('span');
  $span.className = 'icon';
  $span.appendChild(getIcon('arrow-pointer'));
  $container.appendChild($span);
}
```

**Why template cloning instead of innerHTML string concat:** Liquid render tags produce complex nested HTML (SVG with classes, etc.) that can't be easily stringified. Templates let Jekyll render the full HTML once, then JS clones it as needed. This also avoids XSS risk and the need for `escapeHTML()`.

### Strategy C: Liquid conditional branching (`{% if %}` in scripts)

Rewrite as JS conditionals using data-attribute values.

**Before:**

```html
<script>
  {% if include.mode == "turbo" %}
    setInterval(tick, 100);
  {% else %}
    setInterval(tick, 1000);
  {% endif %}
</script>
```

**After:**

```html
<div id="demo-config" data-mode="{{ include.mode }}" hidden></div>
<!-- Logic moved to main.js (initDemo) -->
```

```javascript
function initDemo() {
  const $config = document.getElementById('demo-config');
  if (!$config) return;

  const mode = $config.dataset.mode;
  const intervalMs = mode === 'turbo' ? 100 : 1000;
  setInterval(tick, intervalMs);
}
```

## Handling globals from inline scripts

Old inline scripts often defined functions that other code expected to find on `window` (hCaptcha callbacks, YouTube IFrame API callbacks, inline `onclick="..."` handlers, etc.). When moving to a module:

```javascript
// In the page module / init function
function hCaptchaLoadCallback() { /* ... */ }
function hCaptchaCompleteCallback() { /* ... */ }

// Expose on window — required by external script that calls it globally
window.hCaptchaLoadCallback = hCaptchaLoadCallback;
window.hCaptchaCompleteCallback = hCaptchaCompleteCallback;
```

Same applies to `onYouTubeIframeAPIReady`, inline `onclick="handleFoo(this)"`, and similar global-callback patterns. Leave the external `<script src="...">` loader in place (it's allowed), but put its callbacks in a module and explicitly assign them to `window`.

## Playbook: moving an inline script step by step

1. **Read the full HTML file** (not just the script block) — frontmatter, surrounding markup, all `<script>` tags.
2. **Classify each `<script>` tag**:
   - `type="application/ld+json"` → leave alone (structured data)
   - `src="..."` → leave alone (external loader)
   - Trivial ≤10-line first-paint helper → leave alone with a comment
   - Everything else → **MOVE**
3. **Grep the script body** for `{{` and `{%` to find Liquid references. Plan your data-attribute and template element bridges.
4. **Determine the destination**:
   - Page → `src/assets/js/pages/<pagePath>/index.js` (check if it exists; merge if so)
   - Component/layout used by one page → that page's module
   - Component/layout used by many pages → `src/assets/js/main.js` with `init<Name>()` guard
5. **Add bridge elements to the HTML** (`<div data-*>` config, `<template>` icons) **before** removing the script. This way Jekyll still processes the Liquid.
6. **Move the script body** to the destination. Unwrap any `(function() { ... })()` IIFE. Preserve `var`/`const`/`let` exactly. Add the element-existence guard as the first statement.
7. **Rewrite Liquid references** in the moved JS to read from data attributes or clone templates.
8. **Replace the `<script>...</script>` block** in HTML with `<!-- Logic moved to <destination path> -->`.
9. **Verify with `git diff`** — confirm the HTML change is only the script removal + any bridge elements you added.
10. **Do NOT refactor the script logic** while moving it. Move verbatim with only the changes required to work outside the HTML file. Refactoring and moving in the same pass is how bugs get introduced.

## What NOT to do

- ❌ Don't leave `Manager.something()` — `Manager` is not globally exposed. Use `import webManager from 'web-manager'`.
- ❌ Don't leave `firebase.firestore()` — Firebase is not globally exposed either. Use `webManager.firestore()`.
- ❌ Don't build HTML strings with Liquid interpolation inside a JS module — it won't be processed.
- ❌ Don't use `window.showExitPopup = () => webManager.uj().showExitPopup()` shims as a way to avoid moving the rest of the logic. Move the whole script.
- ❌ Don't split one inline script across multiple modules "for organization" — keep it as one function in the destination file.
- ❌ Don't add the script to `main.js` without an element-existence guard. `main.js` runs on every page.
- ❌ Don't forget that `src/assets/js/pages/index.js` is the module for the root `permalink: /` — the file lives at `pages/index.js`, NOT `pages//index.js` or `pages/home/index.js`.

## Verification

After moving an inline script, run this grep to confirm the file is clean:

```bash
# Should find zero matches (excluding ld+json and external src)
rg -U '<script>[\s\S]*?</script>' src/**/*.html
```

## See also

- [assets.md](assets.md) — page module structure, webpack aliases, where each JS file lives
- [common-mistakes.md](common-mistakes.md) — inline scripts are mistake #1
- [xss-prevention.md](xss-prevention.md) — escaping rules for any HTML the moved JS builds
- [templating.md](templating.md) — what Liquid processes (and what it doesn't)
