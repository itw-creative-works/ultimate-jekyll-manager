# Attribution Tracking System — Design & Implementation Plan

> Working design doc for the unified attribution system. Captures UTM/ITM tags, affiliate codes, and ad click IDs with a per-type "first-touch with 30-day refresh" model, plus auto-sync to the server when authenticated.

## Goals

An all-in-one system to track how users arrive at the site so we can:
1. Do UTM tracking (external marketing attribution)
2. Do ITM tracking (internal mechanisms — exit popups, extension prompts, etc.)
3. Capture ad click IDs for server-side conversion events (GA, Meta CAPI, TikTok Events API)
4. Properly attribute recurring purchases that happen offline (subscription renewals)

---

## Design Decisions (settled)

- **Attribution Model**: First-touch with 30-day refresh, **per-type basis**
  - Each category (UTM, ITM, affiliate, adClicks) has independent freshness
  - If no data exists for a type → save it
  - If data exists AND is < 30 days old → preserve (first-touch protection)
  - If data exists AND is >= 30 days old → overwrite (new journey)
  - Categories are independent: can overwrite stale UTM while keeping fresh affiliate
- **Freshness TTL**: 30 days globally for all types
- **Ad click IDs**: lumped into a single `adClicks` object (user only arrives from one ad at a time; they share one timestamp)
- **Server Sync**: on attribution change (if signed in) + signup + checkout
  - `_meta.needsSync` flag for deferred sync when user later signs in (mirrors `notifications.syncSubscription()` pattern in web-manager)
- **Storage**: User doc (rolling latest) + Subscription doc (frozen snapshot at purchase)
- **`getFresh()` returns ALL fresh data** — server decides what's recent enough to attribute. Subscription gets a frozen snapshot used for ALL recurring conversions, even years later.
- **No backwards compatibility** — replace the old shape cleanly, remove the ad-hoc 30-day check.

---

## Storage Structure

```javascript
// localStorage key: "attribution"
{
  utm: {
    tags: { utm_source, utm_medium, utm_campaign, utm_term, utm_content },
    timestamp: "ISO string",
    url: "full landing URL",
    page: "/path"
  },
  itm: {
    tags: { itm_source, itm_medium, itm_campaign, itm_content },
    timestamp: "ISO string",
    url: "full URL",
    page: "/path"
  },
  affiliate: {
    code: "partner123",
    timestamp: "ISO string",
    url: "full URL",
    page: "/path"
  },
  adClicks: {
    // All ad click IDs lumped together (user only arrives from one ad at a time)
    fbclid: "from URL param",
    fbc:    "from _fbc cookie",
    gclid:  "from URL param",
    ttclid: "from URL param",
    timestamp: "ISO string",
    url: "full URL",
    page: "/path"
  },
  _meta: {
    needsSync: false,        // true if attribution changed while signed out
    lastSynced: "ISO string" // last successful server sync
  }
}
```

---

## Data Captured

| Category | Source | Params |
|---|---|---|
| **UTM** | URL query | `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` |
| **ITM** | URL query (internal links, e.g. exit popup) | `itm_source`, `itm_medium`, `itm_campaign`, `itm_content` |
| **Affiliate** | URL query | `aff` or `ref` |
| **Ad Clicks** | URL query + cookie | `fbclid`, `fbc` (`_fbc` cookie), `gclid`, `ttclid` |

ITM tags are emitted by internal mechanisms. Example: `exit-popup.js` already sets `itm_source=website&itm_medium=modal&itm_campaign=exit-popup&itm_content=<pathname>` on its CTA link. Those land as a query string on the next page and get captured like UTM.

---

## Files to Modify

### 1. `src/assets/js/core/query-strings.js` — Core refactor

Currently captures UTM + affiliate only (no freshness, no ITM, no ad clicks, no sync). Becomes the single owner of attribution capture + sync.

Add:
1. Constants: `ATTRIBUTION_KEY = 'attribution'`, `FRESHNESS_DAYS = 30`, `FRESHNESS_MS = 30 * 24 * 60 * 60 * 1000`
2. `shouldPreserveAttribution(existingData)` — returns `true` if existing data is < 30 days old (preserve), `false` if missing or stale (allow overwrite)
3. `processUTMParams()` / `processITMParams()` / `processAffiliateParams()` / `processAdClickParams()` — each:
   - Reads its params, quits if none present
   - Applies `shouldPreserveAttribution()` first-touch check
   - Writes its category + metadata (timestamp/url/page)
   - Returns `true` if it changed anything
4. `getFbcCookie()` — parse `document.cookie` for `_fbc`
5. `getAttribution()` — raw stored object (all, regardless of age)
6. `getFreshAttribution()` — only categories < 30 days old, excludes `_meta`. This is the canonical thing sent to the server.
7. `syncAttribution()`:
   - If user signed in → POST fresh attribution to backend-manager, set `_meta.lastSynced`, clear `_meta.needsSync`
   - If not signed in → set `_meta.needsSync = true`
8. Auth-state listener for deferred sync: on sign-in, if `_meta.needsSync` is true, call `syncAttribution()`
9. Public API on `webManager._ujLibrary.attribution`:
   ```javascript
   {
     get:      () => getAttribution(),       // raw, all ages — debugging
     getFresh: () => getFreshAttribution(),  // < 30 days — USE THIS
     sync:     () => syncAttribution(),      // manual sync (usually automatic)
     clear:    () => clearAttribution()      // wipe all attribution
   }
   ```

`processQueryStrings()` orchestrates: run each processor, OR their return values; if anything changed, save to storage and call `syncAttribution()`.

### 2. `src/assets/js/core/auth.js` — Use fresh attribution in signup

`sendUserSignupMetadata(account)` currently reads raw `webManager.storage().get('attribution', {})` (line ~283). Change to:
```javascript
const attribution = webManager.uj().attribution.getFresh();
```
Everything else (the `flags.signupProcessed` SSOT gate, `/backend-manager/user/signup` endpoint, consent payload) stays as-is. Sync-on-change in query-strings.js is complementary — signup still sends attribution + context + consent in one shot.

### 3. `src/assets/js/pages/payment/checkout/modules/api.js` — Use fresh attribution

Line ~60 currently sends raw storage:
```javascript
attribution: webManager.storage().get('attribution', {}),
```
Change to:
```javascript
attribution: webManager.uj().attribution.getFresh(),
```
(The old ad-hoc 30-day UTM check from the former `session.js` is already gone — this just swaps raw → fresh so stale categories are dropped before the server snapshots them onto the subscription.)

---

## Sync Flow

```
User lands with ?utm_source=google (or itm_/fbclid/etc.)
        │
        ▼
processQueryStrings()
  - per-type freshness check (first-touch w/ 30-day refresh)
  - update localStorage
  - did anything change?
        │ yes
        ▼
Is user signed in?
  ├── YES → syncAttribution() now → set _meta.lastSynced
  └── NO  → set _meta.needsSync = true
        │
        ▼ (later) user signs in
auth-state listener
  - _meta.needsSync? → syncAttribution() → clear flag
```

---

## Server-Side Data Flow (informational — backend out of scope here)

```
USER DOC  /users/{uid}
  attribution: { utm, itm, affiliate, adClicks }   ← rolling update on each sync

        │ on purchase, snapshot →
        ▼
SUBSCRIPTION DOC  /users/{uid}/subscriptions/{subId}
  attribution: { ... }   ← FROZEN at purchase time
  → used for ALL recurring billing conversion events (even years later)
```

When a renewal fires months later, the server reads the subscription's frozen `attribution.adClicks.fbclid` (or gclid/ttclid) to send a server-side conversion event, attributing the recurring revenue to the original campaign.

---

## Public API Reference

```javascript
webManager.uj().attribution.get()       // raw stored attribution (all ages)
webManager.uj().attribution.getFresh()  // only < 30 days — send this to server
webManager.uj().attribution.sync()      // manual sync (normally automatic)
webManager.uj().attribution.clear()     // wipe all attribution
```

---

## Testing Checklist

- [ ] UTM params captured on landing
- [ ] ITM params captured (via exit-popup CTA link)
- [ ] Affiliate code captured (`aff` / `ref`)
- [ ] Ad click IDs captured (`fbclid`, `gclid`, `ttclid`)
- [ ] `_fbc` cookie read correctly
- [ ] First-touch protected per-type (revisit doesn't overwrite fresh data)
- [ ] 30-day refresh per-type (stale category overwritten, fresh ones kept)
- [ ] `getFresh()` excludes stale categories and `_meta`
- [ ] Sync fires when signed in + attribution changes
- [ ] `_meta.needsSync` set when signed out + attribution changes
- [ ] Deferred sync fires on sign-in when `needsSync` is true
- [ ] Signup (`auth.js`) sends `getFresh()` attribution
- [ ] Checkout (`api.js`) sends `getFresh()` attribution

---

## Open Questions / Notes

- Confirm the backend `user/signup` and checkout endpoints accept the new nested `adClicks` / `itm` shape (no backwards-compat shim — server should be updated in lockstep).
- Decide the sync command/endpoint for the standalone `syncAttribution()` call (e.g. `user/attribution` vs reusing signup). Signup already carries attribution, so sync-on-change is mainly for users who change attribution *after* signup but *before* checkout.
