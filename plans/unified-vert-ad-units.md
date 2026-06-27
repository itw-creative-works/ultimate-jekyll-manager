# Unified Ad Units (Verts) — Architecture Plan

**Status:** Proposal / decision pending
**Scope:** `web-manager`, `ultimate-jekyll-manager` (UJM), `browser-extension-manager` (BXM), `electron-manager` (EM)
**Author:** Ian (drafted with Claude)

---

## 1. Motivation

Two problems are driving this plan:

### Problem A — The "chrome-error" self-refresh bug (the spark)

The promo-server ad iframe **refreshes itself** on a timer that lives *inside* the iframe document (the refresh cadence is driven by user-interaction logic inside the ad page, not by the host page — this is intentional and must be preserved).

Failure mode: if a self-refresh fires while the machine is asleep/offline (e.g. laptop slept with the Tabblar index tab open), the iframe navigates, the network request fails, and Chrome replaces the iframe document with its `chrome-error://chromewebdata/` error page. **Once that happens the ad's own JS is gone** — there is nothing left running inside the iframe to schedule another retry. The iframe is a dead error page until something *outside* it forces a reload.

This reproduces as: "come back to a Tabblar index tab after a while, the sidebar ad is showing the Chrome error page and never recovers."

**Constraint:** failure cannot be detected directly — the iframe is cross-origin (`promo-server.itwcreativeworks.com`), so the host cannot read `contentDocument`, inspect the URL, or distinguish a successful load from Chrome's error page (the `load` event fires for both). The only viable host-side fix is a **staleness heuristic**: on `visibilitychange → visible`, if the iframe hasn't successfully loaded in N minutes, reload it from the host (`iframe.src = resolvedSrc`). Reloading a healthy ad is harmless (it would have refreshed itself soon anyway); reloading a dead one rescues it.

### Problem B — Ad units are hardcoded in consumers (the real architectural issue)

Tabblar injects the ad as a **raw, hand-written `<iframe>`** in [`src/views/pages/index.html`](../../../Tabblar/tabblar-browser-extension/src/views/pages/index.html):

```html
<iframe src="https://promo-server.itwcreativeworks.com/verts/main?image=false&ctaLabel=false"
        class="sidebar-ad-iframe w-100 border-0 rounded" style="height: 250px;"></iframe>
```

This is the antipattern we want to eliminate. **A consumer should never hand-roll an ad iframe.** It has none of the protocol, sizing, fallback, or recovery logic that UJM's system has. The fix for Problem A must NOT be added to the consumer — fixes live in a **framework** or in **web-manager**, never in Tabblar/site code.

**Hard requirement:** every framework (UJM, BXM, EM) must expose a first-class way to *inject* an ad unit. No framework consumer should ever hardcode an iframe again.

---

## 2. Current state — full audit of UJM's vert system

UJM is the only framework with a real ad system today. It spans Jekyll includes, a JS module, CSS, config, and bootstrap wiring.

### 2.1 Jekyll includes — `src/defaults/dist/_includes/modules/adunits/`

| File | Purpose |
|------|---------|
| `adsense.html` | AdSense ad **with promo-server fallback**. Resolves client + per-type slot from `page.resolved.advertising.google-adsense.*`. Types: `display`, `in-article`, `in-feed`, `multiplex`. Guarded by `{% iftruthy page-adsense-client %}`. |
| `promo-server.html` | **Direct** promo-server custom ad (no AdSense). Takes `vert-id`, `vert-size`, `style`. |

Both render a `data-lazy='@script {...}'` div whose `attributes` become `data-ad-*` on a dynamically-injected `<script src="vert.bundle.js">`. The script is **lazy-loaded on scroll-into-view** by the lazy-loading core (see 2.5), not loaded eagerly.

`vert-size` (not `size` — collides with Liquid's built-in `size` filter) selects a max-height preset or raw px.

### 2.2 JS module — `src/assets/js/modules/vert.js` (363 lines)

Reads its config from `document.currentScript`'s `data-ad-*` attributes, then `createAdUnit()` orchestrates everything. Key pieces:

| Function | Responsibility |
|----------|----------------|
| `createAdUnit(config, $script)` | Builds the `<vert-unit>` custom element + `<ins class="adsbygoogle">`, configures per ad type, inserts into DOM, loads AdSense, kicks off fill monitoring. For `type === 'custom'` → straight to `createCustomAd()`. |
| `loadAdSenseScript(config)` | Dynamically injects `adsbygoogle.js?client=…` via `webManager.dom().loadScript()`. |
| `monitorAdFillStatus($unit, config)` | Polls `ins.adsbygoogle[data-ad-status]` every 100 ms up to 10 s. `unfilled` or timeout → `createCustomAd()` **fallback**. `filled` → done. **This is the de-facto adblock/no-fill detector.** |
| `createCustomAd($unit, config)` | **Builds the promo-server iframe.** Unique `frameId`, sandbox attrs, `parentURL` + `frameId` + `loadVertId` query params. Local-server swap when `debug=true` or dev+promo-server brand. **← Problem A lives here; recovery goes here.** |
| `setupMessageHandler()` | One-time `window.postMessage` listener. **Origin-validated** against `window.location.origin` + `https://promo-server.itwcreativeworks.com`. Commands: `uj-vert-unit:set-dimensions` (iframe tells host its height), `uj-vert-unit:click` (host navigates on ad click, `https?:` only). Guarded by `window.__ujVertMessageHandlerSetup`. |
| `protectFromAdSenseOverrides(...)` | MutationObservers that fight AdSense's `height: auto !important` overrides on the vert-unit's `max-height` and on height-constrained ancestors (`vh-100`, `h-100`, `min-vh-100`). AdSense-specific. |
| `SIZE_PRESETS` / `resolveSize(v)` | `banner:150, leaderboard:90, rectangle:250, large-rectangle:600, skyscraper:600`; else raw px. |

**The clean seam:** roughly half of `vert.js` is **AdSense-specific** (`loadAdSenseScript`, `monitorAdFillStatus`, the `<ins>` construction, `protectFromAdSenseOverrides`) and only runs in a web page. The other half — **`createCustomAd` + `setupMessageHandler` + sizing** — is the universal promo-server iframe layer that BXM and EM also need. This seam is what makes the recommended split possible.

### 2.3 CSS — `src/assets/css/core/_verts.scss`

- `vert-unit { display: block; }` — custom elements default to `inline`, which collapses to 0-width and breaks in-viewport-on-load ads.
- `@media print { vert-unit, .uj-vert-unit { display: none } }`.
- A commented-out sidebar `max-height` block annotated **"DOESNT WORK WITH GOOGLE ADS?!"** — AdSense reflates it. Noted as a known pain point.

### 2.4 "Adblock detection" — `src/assets/js/modules/popupads.js`

**Vestigial stub.** Creates a hidden `#uj-antivert-detector` div and nothing else. Not imported anywhere. The *real* no-fill/adblock handling is `monitorAdFillStatus`'s unfilled→fallback path. Flag for deletion or completion separately; not load-bearing.

### 2.5 Lazy-load core — `src/assets/js/core/lazy-loading.js`

IntersectionObserver-driven. The `@script` directive resolves to `webManager.dom().loadScript()`. Verts therefore cost nothing until scrolled near. Any shared module must preserve this lazy entry point on the UJM side.

### 2.6 Config + bootstrap wiring

- `_config_default.yml` → `advertising.google-adsense.{client, display-slot, in-article-slot, in-feed-slot, multiplex-slot}` + `cse.site-id`.
- `foot.html:98` passes `advertising: {{ page.resolved.advertising | jsonify }}` into the **webManager config blob** — so web-manager already receives advertising config at init.
- `foot.html:217` direct AdSense `<script>` is **commented out** — `vert.js` loads it dynamically instead.
- `head.html:85` preconnect guarded by adsense client presence.

---

## 3. Current state — BXM, EM, web-manager

| Framework | Ad system today |
|-----------|-----------------|
| **BXM** (Tabblar) | None. Hardcoded `<iframe>` in `index.html` (Problem B). No protocol, no sizing, no fallback, no recovery. Visibility gated by `data-wm-bind="@show showAds"` + JS computing `showAds = usageHours > 12 && !resolved.active`. |
| **EM** | None. No ads yet, but slated to consume web-manager and will want this. |
| **web-manager** | No vert/ad module. Modules: storage, utilities, analytics, auth, bindings, firestore, notifications, serviceWorker, sentry, usage, dom. Singleton, consumed by UJM + BXM + (future) EM. Constructor pattern: `this._x = new X(this)` + getter `x() { return this._x }`. **Already receives `advertising` in its config blob.** |

---

## 4. The decision

Where does the **shared ad-unit system** (and therefore the Problem A recovery fix) live? Three options.

### Option 1 — Unique implementation per framework

Each framework owns its own ad code. UJM keeps `vert.js`; BXM gets a new port; EM gets another port.

- **UJM:** add ~10-line recovery to `createCustomAd`. Surgical.
- **BXM:** introduce a brand-new vert module (a port of UJM's) + an injection API so Tabblar stops hardcoding. Tabblar migrates its `<iframe>` → framework call (one-time, in the framework's API — not an ongoing "fix in consumer").
- **EM:** same port again.

| Pros | Cons |
|------|------|
| Each framework fully controls its own lifecycle. No new web-manager surface. | **3 near-identical copies** of the iframe/protocol/recovery logic. |
| UJM change is tiny and low-risk. | Every future ad fix (recovery tuning, `online` retry, protocol change) done **3×**. |
| | Forces BXM **and** EM to grow full ad subsystems from scratch. |
| | Guaranteed drift between frameworks. |

### Option 2 — Light helper in web-manager (recovery only)

web-manager exposes `webManager.verts().watch($iframe, opts)` — a generic "watch this iframe, reload it when stale on visibility" utility. Each framework still **constructs** its own iframe and hands it over to be watched.

- **web-manager:** ~60-line `verts.js` (watch list + one shared `visibilitychange` listener + staleness check).
- **UJM:** one-line call after building the iframe in `createCustomAd`.
- **BXM:** still needs a framework-level injection point that builds the iframe **and** calls `watch()`. So BXM grows a small construction module anyway — just without recovery logic in it.

| Pros | Cons |
|------|------|
| Recovery logic exists **once**. Future recovery improvements ship everywhere via one update. | Iframe **construction** still diverges across frameworks. |
| UJM change is a one-liner. | Doesn't satisfy "framework-injectable everywhere" on its own — BXM/EM still need their own construction + injection layer. |
| Small, easy-to-review web-manager surface. | Two layers to reason about (construct here, recover there). Doesn't fix Tabblar's missing protocol/fallback. |

### Option 3 — Full vert system in web-manager (recommended, refined below)

web-manager owns the **universal** ad-iframe core: promo-server `createCustomAd`, the `postMessage` protocol, size presets, **and** recovery. UJM and BXM/EM become thin consumers.

The refinement that makes this clean (per the seam identified in 2.2): **web-manager owns only the universal core; AdSense stays in UJM.** AdSense (`loadAdSenseScript`, `monitorAdFillStatus`, `<ins class="adsbygoogle">`, `protectFromAdSenseOverrides`) only runs on a web page and has no meaning in an extension or desktop app, so it does **not** belong in web-manager.

**Proposed web-manager API (`webManager.verts()`):**

```js
// Create a promo-server custom ad inside a host element (replaces its content).
// Handles iframe construction, sandbox attrs, message protocol, AND stale-load recovery.
webManager.verts().createCustomAd($host, { vertId, size, style, staleAfterMs });

// Watch an externally-constructed iframe for stale loads (e.g. UJM's AdSense path
// that built the iframe itself, or any other custom construction).
webManager.verts().watch($iframe, { srcResolver, staleAfterMs });

// Size preset → px (shared so all frameworks agree on 'rectangle' etc.).
webManager.verts().resolveSize(value);
```

Internals folded in from UJM's `vert.js`: the `frameId` scheme, sandbox attribute string, `parentURL`/`frameId`/`loadVertId` query params, the origin-validated `postMessage` handler (`uj-vert-unit:*` command names kept verbatim — they're just strings the promo-server already speaks), and the recovery loop (per-iframe `lastLoadedAt`, one shared `visibilitychange` listener, `isConnected` + staleness guard before `iframe.src = srcResolver()`).

**Per-framework consumption:**

- **UJM** — `vert.js` keeps **only** the AdSense layer. Its `createCustomAd` collapses to a delegation:
  ```js
  const createCustomAd = ($vertUnit, config) => {
    webManager.verts().createCustomAd($vertUnit, {
      vertId: config.vertId, size: config.size, style: config.style,
    });
    webManager.auth().listen({ once: true }, async () => webManager.bindings().update());
  };
  ```
  ~80 lines (iframe construction + message handler) **deleted** from UJM. The Jekyll includes, lazy-load entry, AdSense flow, and CSS are unchanged.

- **BXM** — ships a tiny framework-level injection point so consumers never hardcode. Scan-on-bootstrap against a declarative host:
  ```js
  // browser-extension-manager — page-context bootstrap
  document.querySelectorAll('[data-bxm-ad]').forEach(($host) =>
    webManager.verts().createCustomAd($host, {
      vertId: $host.getAttribute('data-bxm-ad-vert-id') || '',
      size:   $host.getAttribute('data-bxm-ad-size')   || '',
    }));
  ```
  Tabblar's **only** change, ever, is a one-time HTML swap from the raw `<iframe>` to:
  ```html
  <div data-bxm-ad data-bxm-ad-size="rectangle" class="sidebar-ad-host w-100"></div>
  ```
  That is consuming a framework API, **not** a fix in the consumer. Tabblar instantly gains the protocol, sizing, fallback hooks, and recovery.

- **EM** — identical pattern to BXM (`data-em-ad` or shared attribute), zero new ad logic.

| Pros | Cons |
|------|------|
| **True SSOT** for the universal ad iframe. Recovery + protocol + sizing fixed in exactly one place. | Biggest up-front change; touches 3 repos in coordination. |
| Satisfies "framework-injectable everywhere" — BXM/EM get a real injection API; **no consumer ever hardcodes** again. | web-manager gains DOM/iframe responsibility (it already does DOM via bindings/dom, so not a category change). |
| AdSense complexity stays out of web-manager (web-only concern stays in UJM). | promo-server origin + `uj-vert-unit:*` names live in web-manager — mild coupling to promo-server as permanent infra. |
| Tabblar gains protocol + sizing + recovery it lacks today, for free. | Once web-manager owns it, UJM + BXM must update in lock-step. |

---

## 5. Recommendation

**Adopt Option 3, refined:** web-manager owns the universal promo-server iframe core (`createCustomAd` + `postMessage` protocol + size presets + **recovery**); UJM retains only its AdSense layer and delegates the custom-ad path; BXM and EM get a thin declarative injection point (`[data-*-ad]` → `webManager.verts().createCustomAd`).

Why over the others:

- **vs Option 1:** Option 1 writes the same iframe/recovery code three times and forces BXM+EM to build full ad systems anyway. The recovery bug (and every future one) would be fixed N times.
- **vs Option 2:** Option 2 fixes recovery once but leaves construction divergent, and **still** requires BXM/EM to build their own construction+injection layer — so we pay most of Option 3's cost without getting the SSOT for construction or the protocol/fallback upgrade for Tabblar.
- **The seam is real and clean:** AdSense is genuinely web-only and stays in UJM; everything below it is universal and moves down to web-manager. We are not forcing unrelated concerns together.

**If a smaller first step is wanted:** ship Option 2's `watch()` immediately to stop the Problem A bleeding (one-liner in UJM `createCustomAd`, plus a BXM bootstrap that `watch()`es Tabblar's existing iframe so even the current hardcoded ad self-heals), then land the full Option 3 migration. `watch()` is a strict subset of the Option 3 API, so it is not throwaway work — it becomes one of the public methods in the final module.

---

## 6. Implementation outline (Option 3)

1. **web-manager** — add `src/modules/verts.js`; register `this._verts = new Verts(this)` + `verts()` getter in `src/index.js` (mirror existing module pattern). Port `createCustomAd`, `setupMessageHandler`, `SIZE_PRESETS`/`resolveSize` from UJM `vert.js`; add the recovery loop (`lastLoadedAt` per iframe, shared `visibilitychange` listener, `isConnected` + `staleAfterMs` guard, `srcResolver`). Default `staleAfterMs = 10 * 60 * 1000`. Read promo-server base + dev-swap from `this.config` / `manager.isDevelopment()`.
2. **web-manager** — bump version; document `verts()` in CLAUDE.md + a `docs/verts.md`.
3. **UJM** — gut `createCustomAd`/`setupMessageHandler`/iframe construction from `vert.js`; delegate to `webManager.verts().createCustomAd`. Keep AdSense flow, includes, lazy entry, CSS. Update `docs/ads.md` to note the iframe layer now lives in web-manager. Bump the pinned web-manager dependency.
4. **BXM** — add the page-context `[data-bxm-ad]` scan calling `webManager.verts().createCustomAd`. Document the `data-bxm-ad*` attributes. Bump web-manager dep.
5. **Tabblar** — one-time HTML swap: raw `<iframe>` → `<div data-bxm-ad data-bxm-ad-size="rectangle">`. Validate the chrome-error recovery end-to-end (sleep/offline repro, or DevTools offline + force a stale reload on visibility).
6. **EM** — adopt the same injection point when EM grows ads (no action required now).
7. **Cleanup** — decide the fate of `popupads.js` (complete it as a real detector or delete the stub) separately from this work.

**Validate before documenting** (per repo conventions): exercise AdSense-filled, AdSense-unfilled→fallback, direct promo-server, and the stale-reload recovery path live, then update README/CLAUDE/docs/CHANGELOG in each touched repo.

---

## 7. Open questions

- **promo-server coupling in web-manager:** keep `uj-vert-unit:*` command names and the `promo-server.itwcreativeworks.com` origin as constants in web-manager? (Recommended yes — promo-server is permanent infra; renaming means a promo-server-side compat bump for no real gain.)
- **Recovery trigger set:** ship `visibilitychange` only first, or also add a `window 'online'` listener (catches the woke-up-online case even before the tab is focused)? `online` is cheap and complementary — likely worth including in the first web-manager version.
- **Staleness threshold:** 10 min default — expose as a per-call `staleAfterMs` (yes) and/or a global web-manager config knob?
- **`vert-size` naming:** keep the Liquid-driven `vert-size` name on includes, but the web-manager API can use the cleaner `size` since there's no Liquid collision in JS.
</content>
</invoke>
