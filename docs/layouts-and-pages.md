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
