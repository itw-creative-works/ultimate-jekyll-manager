# Ad Units (Verts)

Ultimate Jekyll provides ad unit includes that display Google AdSense ads with automatic fallback to in-house ads served from promo-server when AdSense is blocked or unfilled.

## Include Files

| Include | Purpose |
|---------|---------|
| `modules/adunits/adsense.html` | AdSense ad with promo-server fallback |
| `modules/adunits/promo-server.html` | Direct promo-server ad (no AdSense) |

## AdSense Include

```liquid
{% include /modules/adunits/adsense.html type="in-article" %}
{% include /modules/adunits/adsense.html type="in-article" vert-size="rectangle" %}
{% include /modules/adunits/adsense.html type="display" vert-size="banner" %}
{% include /modules/adunits/adsense.html type="display" vert-size="300" %}
```

**Parameters:**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `type` | No | `display` | Ad type: `display`, `in-article`, `in-feed`, `multiplex` |
| `slot` | No | From site config | Override the ad slot ID |
| `vert-size` | No | (unconstrained) | Max height preset or pixel value (cannot use `size` — conflicts with Liquid's built-in `size` filter) |
| `style` | No | `""` | Custom inline CSS |
| `layout` | No | `image-above` | Layout for `in-feed` type: `image-above`, `image-side` |

## Promo Server Include

```liquid
{% include /modules/adunits/promo-server.html vert-id="/verts/units/test/google" %}
{% include /modules/adunits/promo-server.html vert-id="/verts/units/test/google" vert-size="banner" %}
```

**Parameters:**

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `vert-id` | Yes | `""` | Path to the vert on promo-server |
| `vert-size` | No | (unconstrained) | Max height preset or pixel value |
| `style` | No | `""` | Custom inline CSS |

## Size Presets

The `vert-size` parameter accepts preset names or raw pixel values. Presets constrain the ad unit's max-height:

| Preset | Max Height | Typical Use |
|--------|-----------|-------------|
| `banner` | 150px | Horizontal banner ads |
| `leaderboard` | 90px | Wide horizontal ads (alias for banner) |
| `rectangle` | 250px | Medium rectangle, in-content ads |
| `large-rectangle` | 600px | Large rectangle, sidebar ads |
| `skyscraper` | 600px | Tall sidebar ads |

Raw pixel values are also accepted: `vert-size="300"` → 300px max-height.

When no `vert-size` is specified, the ad unit renders unconstrained.

## How It Works

1. The include renders a `data-lazy="@script ..."` div that lazy-loads `vert.bundle.js` when scrolled into view
2. `vert.js` creates a `<vert-unit>` custom element with `max-height` + `overflow: hidden` (if `vert-size` is set)
3. For AdSense types: loads the AdSense script, pushes the ad, and monitors fill status
4. If AdSense is blocked or unfilled, falls back to a promo-server iframe
5. The promo-server iframe content uses CSS container queries to adapt its layout to the available space
6. Ad units are hidden for non-basic plan users via `data-wm-bind="@hide auth.account.subscription.product.id !== basic"`

## File Locations

| Purpose | Path |
|---------|------|
| AdSense include | `src/defaults/dist/_includes/modules/adunits/adsense.html` |
| Promo Server include | `src/defaults/dist/_includes/modules/adunits/promo-server.html` |
| Vert JS module | `src/assets/js/modules/vert.js` |
| Vert CSS | `src/assets/css/core/_verts.scss` |
