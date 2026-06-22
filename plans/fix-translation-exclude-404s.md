# Fix: Translation exclude list not respected by footer language switcher

## Problem

Every UJM site with translation enabled generates dead language links on excluded pages (e.g. blog posts), causing widespread 404s indexed by Google.

**Root cause:** The footer language switcher and the `uj_translation_url` Ruby tag both generate language-prefixed URLs (`/es/blog/my-post`, `/ko/blog/my-post`) without checking the `translation.exclude` list. Meanwhile, the translation gulp task correctly skips excluded pages — so the translated HTML files are never generated, but the links to them are.

**Impact:** Every blog post on every site with translation enabled has footer links to non-existent translated pages. Google discovers these via crawling, indexes them as 404s, and inflates "Page not found" stats in GA4 (often 40-50% of all pageviews). Also harms crawl budget.

**Example (operst):**
- Config: `translation.enabled: true`, `exclude: ["blog"]`, languages: `es`, `ko`
- Footer on `/blog/my-post` links to `/es/blog/my-post` and `/ko/blog/my-post`
- Neither of those pages exist — both return 404
- GA4 shows "Oops! This page doesn't exist" as the #1 page at 45% of traffic

## Fix 1: Footer template (DONE)

**File:** `src/defaults/dist/_includes/themes/classy/frontend/sections/footer.html`

**Change:** Before rendering the language dropdown, check the current page against the exclude list. If matched, only show the default language (same behavior as when translation is disabled).

```liquid
{% assign page_excluded_from_translation = false %}
{% for exclude in site.translation.exclude %}
  {% assign exclude_folder = "/" | append: exclude | append: "/" %}
  {% assign exclude_page = "/" | append: exclude %}
  {% if page.url == exclude_page or page.url contains exclude_folder %}
    {% assign page_excluded_from_translation = true %}
  {% endif %}
{% endfor %}
{% if site.translation.enabled and site.translation.languages.size > 0 and page_excluded_from_translation != true %}
  {% assign all_languages = site.translation.languages | push: default_language %}
{% else %}
  {% assign all_languages = "" | split: "" | push: default_language %}
{% endif %}
```

**Matching logic:** Uses the same pattern as `translation.js` — each exclude entry matches as both a folder prefix (`/blog/...`) and an exact page path (`/blog`).

**Status:** Applied to `src/defaults/dist/_includes/themes/classy/frontend/sections/footer.html`. Needs `npm run prepare` to copy to `dist/`.

## Fix 2: `uj_translation_url` Ruby tag (DONE)

**File:** `jekyll-uj-powertools` gem, `lib/tags/translation_url.rb`

**Current code (v1.7.9):** The `render` method generates language-prefixed URLs without checking the exclude list at all. When called with `{% uj_translation_url "es", page.url %}` on a blog post, it returns `/es/blog/my-post` regardless of whether blog is excluded.

**Proposed change:** Add an exclude check in the `render` method. If the URL path matches an exclude entry, return the un-prefixed (default language) URL instead of the language-prefixed one. This is defense-in-depth — even if a template forgets to check, the tag itself won't generate dead links.

```ruby
def render(context)
  # ... existing argument parsing ...

  # Get site and translation config from context
  site = context.registers[:site]
  return '/' unless site

  translation_config = site.config['translation'] || {}
  default_language = translation_config['default'] || 'en'
  available_languages = translation_config['languages'] || [default_language]

  # NEW: Check if the URL path is excluded from translation
  excludes = translation_config['exclude'] || []
  normalized_path = normalize_path(url_path)
  if page_excluded?(normalized_path, excludes)
    # Return un-prefixed URL for excluded pages
    return normalized_path.empty? ? '/' : "/#{normalized_path}"
  end

  # ... rest of existing logic (validate language, generate URL) ...
end

private

# NEW: Check if a page path matches any exclude entry
def page_excluded?(normalized_path, excludes)
  return false if excludes.empty? || normalized_path.empty?

  excludes.any? do |exclude|
    # Match as exact page path or as folder prefix
    normalized_path == exclude || normalized_path.start_with?("#{exclude}/")
  end
end
```

**Applied:** `jekyll-uj-powertools` v1.7.11. Version bumped in gemspec + CHANGELOG updated.

## Fix 3: Consider — strip language dropdown entirely on excluded pages

The current Fix 1 still renders a language dropdown with a single "English" option on excluded pages. An alternative is to hide the dropdown entirely when the page is excluded. This is a UX call — showing a single-language dropdown is harmless but arguably useless.

To hide it entirely, wrap the `<div class="dropup uj-language-dropdown">` block in:
```liquid
{% unless page_excluded_from_translation and site.translation.enabled %}
  <!-- language dropdown markup -->
{% endunless %}
```

## Verification

After applying Fix 1 and rebuilding a site:

1. Visit a blog post → footer should show only "English" (or no language dropdown)
2. Visit a non-excluded page (e.g. `/pricing`) → footer should show all languages
3. View page source on a blog post → no `href="/es/blog/..."` links in footer
4. After reindexing, GA4 "Page not found" percentage should drop significantly

## Scope

- Fix 1 covers ALL UJM sites (classy is the base footer for all themes)
- Fix 2 covers any future template that uses `uj_translation_url` on excluded pages
- The spam bot traffic (`/ar/`, `/fr/`, etc. from disabled languages) is separate — those are fabricated URLs from crawlers, not caused by UJM. A Cloudflare WAF rule can block those if desired.
