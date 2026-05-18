# CSS Guidelines

## Section Padding in Custom Pages

**DO NOT add padding classes to sections in custom frontend pages.**

UJ handles section padding automatically via the theme's layout system. When creating or editing custom frontend pages:

- ❌ DO NOT use `py-5`, `py-4`, `pt-5`, `pb-5`, `p-5`, etc. on `<section>` elements
- ❌ DO NOT add vertical padding to sections manually
- ✅ Let the UJ theme handle section spacing automatically

**The ONLY exception:** Add padding if the user EXPLICITLY requests it for a specific section.

## Theme-Adaptive Classes

**DO NOT USE:** `bg-light`, `bg-dark`, `text-light`, `text-dark`

Ultimate Jekyll supports both light and dark modes. Use adaptive classes instead:

**Backgrounds:**
- `bg-body` — Primary background
- `bg-body-secondary` — Secondary background
- `bg-body-tertiary` — Tertiary background

**Text:**
- `text-body` — Body text color

**Buttons:**
- `btn-adaptive` — Adaptive button
- `btn-outline-adaptive` — Adaptive outline button

These classes automatically adapt to the current theme mode. See [docs/appearance.md](appearance.md) for the dark/light mode switching system.

## Cards Inside Colored Sections

When placing cards inside sections with `bg-body-secondary` or `bg-body-tertiary`, cards will blend in because they share the same background color by default.

**Solution:** Add `bg-body` to cards to create visual contrast:

```html
<!-- ❌ WRONG - Card blends with section background -->
<section class="bg-body-secondary">
  <div class="card">...</div>
</section>

<!-- ✅ CORRECT - Card stands out with contrasting background -->
<section class="bg-body-secondary">
  <div class="card bg-body">...</div>
</section>
```

**Rule:** When a section uses `bg-body-secondary` or `bg-body-tertiary`, always add `bg-body` to child cards to ensure proper visual hierarchy.

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
