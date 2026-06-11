# Common Mistakes to Avoid

1. **🚫 Inline `<script>` tags in HTML files** — the #1 worst mistake. Move ALL JS to page modules (`src/assets/js/pages/<path>/index.js`) or `main.js`. Component/layout scripts go in `main.js` with element-existence guards. Liquid-templated scripts bridge via `data-*` attributes or `<template>` elements. **Only exceptions:** `type="application/ld+json"`, external `<script src="...">` loaders, and ≤10-line first-paint display helpers with an explaining comment.
2. **🚫 Reinventing Bootstrap — the #1 CSS mistake** — NEVER create custom classes for things Bootstrap already provides. No `.lm-btn` when `.btn .btn-primary` exists; no `.lm-wrap` when `.container` exists; no custom flex/gap/padding/margin/text-align classes when Bootstrap utilities do the same thing. Theme SCSS overrides how `.btn`/`.card`/`.navbar` LOOK — it doesn't create parallel replacements. Custom CSS is ONLY for genuinely novel components with no Bootstrap equivalent. Before writing ANY custom class, ask: "Does Bootstrap have this?" If yes, USE IT. See [themes.md](themes.md) and [css.md](css.md).
3. **Creating duplicate CSS** — check Bootstrap and the active theme first.
4. **Wrong imports** — FormManager needs curly braces: `import { FormManager } from ...`.
5. **Assuming `Manager`, `firebase`, `webManager` are on `window`** — they are NOT. Use `import webManager from 'web-manager'` in a module. `firebase.firestore()` → `webManager.firestore()`. **Consumer code NEVER imports Firebase directly** — Firebase is web-manager's internal dependency. Same rule in EM and BXM.
6. **Installing UJM's dependencies as direct consumer deps** — Consumer projects must NOT `npm install firebase`, `web-manager`, or any other UJM/web-manager transitive dep. UJM's webpack config includes `resolve.modules` pointing at the framework's own `node_modules/`. If a dependency isn't resolving, the fix is in UJM's webpack config — not the consumer's `package.json`. Mirrors EM and BXM.
7. **Not using FormManager** — use it for ALL forms.
8. **Calling `$form.requestSubmit()` directly** — use `formManager.submit()`.
9. **Wrong dark mode classes** — use `bg-body` variants, not `bg-light`/`bg-dark`.
10. **Not waiting for DOM** — always `await webManager.dom().ready()`.
11. **Using native fetch** — always use `wonderful-fetch` or `authorized-fetch`.
12. **XSS — unescaped dynamic data in innerHTML** — Use `webManager.utilities().escapeHTML()`. Dynamic URLs in `href`/`src`/`action`/`window.location`/`window.open` ALSO need `webManager.utilities().sanitizeURL()` — `escapeHTML` alone lets `javascript:` execute. See [xss-prevention.md](xss-prevention.md).
13. **Leaving Liquid `{{ }}` or `{% %}` inside moved JS modules** — Jekyll does NOT process `src/assets/js/**/*.js`. Use `data-*` attribute bridges or `<template>` cloning.
