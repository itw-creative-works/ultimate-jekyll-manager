# UJ Powertools (Jekyll Plugin)

Ultimate Jekyll uses the `jekyll-uj-powertools` gem for custom Liquid functionality.

**Documentation:** `/Users/ian/Developer/Repositories/ITW-Creative-works/jekyll-uj-powertools/README.md`

## Available Features

- **Filters:** `uj_strip_ads`, `uj_json_escape`, `uj_title_case`, `uj_content_format`, `uj_hash`
- **Tags:** `iftruthy`, `iffalsy`, `uj_icon`, `uj_logo`, `uj_image`, `uj_member`, `uj_post`, `uj_readtime`, `uj_social`, `uj_translation_url`, `uj_fake_comments`, `uj_language`
- **Global Variables:** `site.uj.cache_breaker`
- **Page Variables:** `page.random_id`, `page.extension`, `page.layout_data`, `page.resolved`

**Always check the README before assuming functionality.**

## Key Liquid Functions

### `uj_content_format`

Formats content by first liquifying it, then markdownifying it (if markdown file).

### `uj_hash`

Returns a deterministic number between 0 and max (exclusive) based on the input string's MD5 hash. Same input always produces the same output.

```liquid
{{ "some-string" | uj_hash: 1000 }}  => 0-999 (stable across builds)
{{ site.url | uj_hash: 2 }}          => 0 or 1
```

### `iftruthy` / `iffalsy`

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

### `page.resolved`

A deeply merged object containing all site, layout, and page variables. Precedence: page > layout > site. Enables a system of defaults with progressive overrides.

### `uj_icon`

Inserts Font Awesome icons. See [docs/icons.md](icons.md) for the full reference (sizes, when to use vs prerendered icons in JS, etc.).

```liquid
{% uj_icon icon-name, "fa-md" %}
{% uj_icon "rocket", "fa-3xl" %}
```

### `asset_path` Override

Override default page-specific CSS/JS path derivation:

```yaml
---
asset_path: blog/post
---
```

Uses `/assets/css/pages/{{ asset_path }}.bundle.css` instead of deriving from `page.canonical.path`. Useful when multiple pages share assets (e.g., all blog posts). See also [docs/layouts-and-pages.md](layouts-and-pages.md).
