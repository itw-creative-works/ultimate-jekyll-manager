# Animation Studio

Admin page at `/admin/studio` for creating screen-recording-ready product demo animation clips. Ships with UJM as a default admin page — consumer projects supply only clip definitions and clip-specific CSS.

## Architecture

The Studio page is a standalone full-viewport dark canvas with a sidebar for clip selection and playback controls. It bypasses the standard admin sidebar/topbar/header chrome (`theme.sidebar/topbar/header: enabled: false` in the blueprint).

**Framework provides (boilerplate):**
- Page file (`dist/pages/admin/studio/index.html`) + blueprint layout
- Sidebar with auto-generated clip buttons from registered clips
- Playback controls (pause duration slider, speed selector, play/pause toggle)
- Aspect ratio toggle (16:9 landscape / 9:16 vertical for reels/stories)
- Recording-ready canvas with dashed border and aspect ratio label
- Clip runner loop with speed-scaled timing
- `animate()` helper — wraps Web Animations API with auto-speed scaling
- `el()` helper — DOM element factory (`el(tag, classes, innerHTML)`)
- Admin role gate (redirects non-admins to `/dashboard`)
- All boilerplate CSS (sidebar, controls, canvas frame — theme-agnostic)

**Consumer provides (project-specific):**
- Clip definitions via `window.STUDIO_CLIPS` (set in the project JS layer)
- Clip-specific CSS (animation primitives, keyframes, component styles)

## Clip registration

Consumer projects register clips by setting `window.STUDIO_CLIPS` in their page-specific JS at `src/assets/js/pages/admin/studio/index.js`. The framework's main-layer JS reads this object after auth resolves (by which time the project-layer module has executed).

```js
// src/assets/js/pages/admin/studio/index.js (consumer project)

window.STUDIO_CLIPS = {
  'hero': {
    label: 'Hero Intro',         // sidebar button text
    duration: 3000,              // total animation duration in ms (before speed scaling)
    build($canvas, { animate, el }) {
      // Create DOM elements and animate them
      const title = el('div', 'my-title-class');
      title.innerHTML = '<h1>Hello World</h1>';
      $canvas.appendChild(title);

      animate(title, [
        { opacity: 0, transform: 'translateY(30px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ], { duration: 800 });
    },
  },

  'feature-demo': {
    label: 'Feature Demo',
    duration: 5000,
    build($canvas, { animate, el }) {
      // ...
    },
  },
};

export default () => {};
```

### Clip contract

Each clip in `window.STUDIO_CLIPS` is keyed by a unique ID string and must have:

| Field | Type | Description |
|---|---|---|
| `label` | `string` | Button text in the sidebar. Falls back to the clip ID if omitted. |
| `duration` | `number` | Total animation duration in milliseconds (pre-speed scaling). Used to calculate when the loop restarts. |
| `build` | `function($canvas, helpers)` | Called each loop iteration. Receives the cleared canvas element and helper functions. Must build DOM and start animations. |

### `build()` helpers

The `build` function receives helpers as its second argument:

**Core helpers:**

**`animate(element, keyframes, options)`** — Wraps `Element.animate()` (Web Animations API). Auto-scales `delay` and `duration` by the current speed setting. Returns the `Animation` object.

Options:
- `delay` (ms, default `0`) — scaled by speed
- `duration` (ms, default `500`) — scaled by speed
- `fill` (default `'forwards'`)
- `easing` (default `'cubic-bezier(0.34, 1.56, 0.64, 1)'`)

**`el(tag, classes, innerHTML)`** — Creates a DOM element. All three arguments are optional strings.

**Builder helpers** (reusable clip patterns — zero boilerplate in consumer):

**`flowClip({ title, nodes })`** — Animated title + horizontal/vertical flow of cards with arrows between them. Automatically switches to vertical layout in 9:16. Each node has `{ icon, label, stat }`.

**`cardClip({ badge, title, contentFn })`** — Animated neobrutalist card (uses Bootstrap `.card` with theme shadow). `badge` is badge HTML, `title` is the heading, `contentFn(container, { animate, el })` is called to populate the card body.

**`chatClip({ header, messages })`** — Header + animated chat bubble sequence. Each message has `{ type: 'them'|'ai', text, label? }`.

### Speed scaling

The `animate()` helper divides `delay` and `duration` by the current speed multiplier (0.5×, 1×, 1.5×, 2×). At 2× speed, a 1000ms animation completes in 500ms. The clip's `duration` is also scaled when calculating the loop restart time.

If a clip uses raw `Element.animate()` directly (bypassing the helper), it must manually divide timings by the speed — but this is not recommended.

## Clip-specific CSS

Animation primitives go in the consumer's page-specific CSS at `src/assets/css/pages/admin/studio/index.scss`. These are project-specific styles for the animation content rendered inside the canvas — things like card shapes, flow diagrams, chat bubbles, custom keyframes.

**Important:** The consumer's page CSS MUST import the framework's boilerplate partial with `@use 'studio'`. This is required because page-specific CSS compiles independently per layer, and the consumer's file overwrites the framework's. The `@use 'studio'` directive pulls in the boilerplate (sidebar, controls, canvas) from `dist/assets/css/_studio.scss` via the SASS loadPaths. Consumer CSS should NOT redefine these boilerplate styles.

```scss
// src/assets/css/pages/admin/studio/index.scss (consumer project)
@use 'ultimate-jekyll-manager' as *;
@use 'studio';

// Animation card
.my-card {
  background: var(--my-theme-color);
  border-radius: 18px;
  padding: 24px;
  opacity: 0; // animated in by JS
}

// Custom keyframe
@keyframes my-slide-in {
  0% { opacity: 0; transform: translateX(-40px); }
  100% { opacity: 1; transform: translateX(0); }
}
```

## Canvas dimensions

The canvas has two aspect ratio modes, toggled via the sidebar buttons:

| Aspect | Width | Height | Use case |
|---|---|---|---|
| 16:9 | 960px | 540px | Landscape video, website demos |
| 9:16 | 405px | 720px | Vertical reels, stories, TikTok |

The canvas transitions smoothly between sizes. The currently selected aspect ratio is shown as a label above the top-right corner.

## Playback controls

| Control | Default | Range | Description |
|---|---|---|---|
| Pause (ms) | 1500 | 500–4000 | Delay between clip loop iterations |
| Speed | 1× | 0.5×–2× | Playback speed multiplier |
| Play/Pause | Playing | — | Toggle clip loop |

## Admin gating

The Studio page requires `admin` role authentication (inherited from the `classy/admin/core/minimal` layout). Non-admin users are redirected to `/dashboard`. The `#studio` container starts `hidden` and is revealed after auth confirms admin access.

## No-clips fallback

If `window.STUDIO_CLIPS` is not set or is empty (no clips registered), the Studio page shows a message: "No clips registered. Set `window.STUDIO_CLIPS` in your project JS." This is the expected state for consumer projects that haven't defined clips yet.

## File locations

**Framework (UJM):**
- `src/defaults/dist/pages/admin/studio/index.html` — page file
- `src/defaults/dist/_layouts/blueprint/admin/studio/index.html` — blueprint layout (HTML + sidebar + controls)
- `src/assets/js/pages/admin/studio/index.js` — boilerplate JS (engine, helpers)
- `src/assets/css/_studio.scss` — boilerplate CSS partial (sidebar, controls, canvas). Consumers import via `@use 'studio'`.
- `src/defaults/dist/_includes/admin/sections/sidebar.json` — includes Studio link

**Consumer project:**
- `src/assets/js/pages/admin/studio/index.js` — clip definitions (`window.STUDIO_CLIPS`)
- `src/assets/css/pages/admin/studio/index.scss` — clip-specific animation CSS (must include `@use 'studio'` to pull in boilerplate)
- No page file needed — the framework default provides `/admin/studio`
