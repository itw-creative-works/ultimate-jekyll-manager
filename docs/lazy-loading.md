# Lazy Loading System

Ultimate Jekyll uses a custom lazy loading system powered by web-manager.

## Syntax

```html
data-lazy="@type value"
```

## Supported Types

### `@src` — Lazy load src attribute

```html
<img data-lazy="@src /assets/images/hero.jpg" alt="Hero">
<iframe data-lazy="@src https://example.com/embed"></iframe>
```

### `@srcset` — Lazy load srcset attribute

```html
<img data-lazy="@srcset /img/small.jpg 480w, /img/large.jpg 1024w">
```

### `@bg` — Lazy load background images

```html
<div data-lazy="@bg /assets/images/background.jpg"></div>
```

### `@class` — Lazy add CSS classes

```html
<div data-lazy="@class animation-fade-in">Content</div>
```

### `@html` — Lazy inject HTML content

```html
<div data-lazy="@html <p>Lazy loaded content</p>"></div>
```

### `@script` — Lazy load external scripts

```html
<div data-lazy='@script {"src": "https://example.com/widget.js", "attributes": {"async": true}}'></div>
```

## Features

- Automatic cache busting via `buildTime`
- IntersectionObserver for performance (50px threshold)
- Loading state CSS classes: `lazy-loading`, `lazy-loaded`, `lazy-error`
- Intelligent handling of video/audio sources
- Automatic DOM re-scanning for dynamic elements

**Implementation:** `src/assets/js/core/lazy-loading.js`
