# Project Progress Tracker
> Agents and maintainers should update this file regularly to reflect the current state of the project.

## Current Focus
* **Goal:** CI workflow hardening — retry logic + action version bumps
* **Current Phase:** Phase 6 — workflow updated, needs kolpav decision + publish
* **Priority:** Medium
* **Last Updated:** 2026-06-30 1:39 AM PDT
* **Notes:** Updated UJM's default build.yml template (source of truth for all consumers). Added 3x retry on `sfw npm install`, bumped checkout v4→v7 and setup-node v4→v6 to fix Node 20 deprecation warnings. `kolpav/purge-artifacts-action@v1` is abandoned (last commit Jan 2023) — needs decision: remove, replace, or keep.

## Active Task List
* [ ] Phase 6: CI workflow hardening — retry logic + action version bumps
  * [x] Task 6.1: Diagnose CI failure — transient ECONNRESET + sfw crash on undefined alert results
  * [x] Task 6.2: Add 3x retry with 15s delay to `sfw npm install` step (with comments)
  * [x] Task 6.3: Bump `actions/checkout` v4→v7, `actions/setup-node` v4→v6 (Node 20 deprecation)
  * [ ] Task 6.4: Decide on `kolpav/purge-artifacts-action@v1` (abandoned) — remove, replace, or keep
  * [ ] Task 6.5: Publish new UJM version so consumers pick up the workflow changes

* [ ] Phase 5: Fix "Getter must be a function: default" crash + dependency upgrades
  * [x] Task 5.1: Diagnose root cause — stale CDN cache of `main.bundle.js` (5.107 runtime) served alongside fresh 5.108 chunks with array-form `.d()` calls
  * [x] Task 5.2: Confirm webpack 5.108 works correctly in a clean build (both runtime + chunks match)
  * [x] Task 5.3: Update all patch/minor deps (10 packages including webpack 5.108.3)
  * [x] Task 5.4: Upgrade js-yaml 4→5 — guarded 3 `yaml.load()` call sites against empty input, production build passes
  * [x] Task 5.5: Upgrade @babel/core + @babel/preset-env 7→8 — no config changes needed, production build passes
  * [ ] Task 5.6: Rebuild + redeploy StudyMonkey (+ Cloudflare cache purge for main.bundle.js)
  * [ ] Task 5.7: Verify /signin loads without error on StudyMonkey


* [ ] Phase 1: FormManager disabled-state snapshot-and-restore
  * [x] Task 1.1: Refactor `_setDisabled` to use snapshot instead of `data-fm-keep-disabled`
  * [x] Task 1.2: Add `_permanentlyDisabled` Set, populated in `_init()` before first disable
  * [x] Task 1.3: Write page-layer tests (5 tests: snapshot capture, full disable, selective re-enable, cycle durability, onsubmit HTML guard)
  * [x] Task 1.4: All 85 tests passing
  * [x] Task 1.5: Add visual Test 7 to FM test page (form-manager.html + JS) with permanently disabled fields + rapid-cycle demo
  * [x] Task 1.6: Write comprehensive FM page-layer tests — getData/setData (12 tests), validation/honeypot/file-accept (13 tests). 110 total.
  * [x] Task 1.7a: Full audit + fix: remove `disabled` from all loading-guard inputs across UJM forms (auth signin/signup/reset, email-preferences, hero-demo-form input/select/textarea)
  * [x] Task 1.7b: Add `data-form-state="initializing"` to all FM-managed forms, CSS guard in `_initialize.scss`, FM sets attribute in `_init()`. Remove loading-guard `disabled` from test form inputs.
  * [x] Task 1.7c: Refined loading guard — removed whole-form CSS lockdown + blanket `_setDisabled(true)` from init. Forms editable immediately; only submit buttons disabled until ready. Existing guards (disabled buttons + `onsubmit` + FM state check + body.html click interceptor) prevent premature submission.
  * [x] Task 1.7d: Hardened disabled-state CSS + click interceptor — added `[aria-disabled="true"]` to selectors, FM form-state submit button safety net in `_utilities.scss`, removed production `console.log` from body.html interceptor.
  * [x] Task 1.7e: Global fleet audit — audited all 46 UJM consumer repos + framework for form compliance
  * [x] Task 1.7f: UJM framework fix — removed `disabled` from 15 submit buttons across auth, hero-demo, email-preferences, test page
  * [x] Task 1.7g: Consumer repo fixes — added `data-form-state` + `onsubmit` to ~30 forms across 19 repos, removed `data-fm-keep-disabled` (LoudMouth), removed loading-guard `disabled` from 6 elements (Trusteroo)
  * [ ] Task 1.7: Update `docs/javascript-libraries.md` — replace `data-fm-keep-disabled` docs with new snapshot pattern + loading guard model
  * [ ] Task 1.8: Update CHANGELOG with the change
  * [ ] Task 1.9: Ship (commit, push, publish)

* [x] Phase 4: Add missing dates to newsflash story cards
  * [x] Task 4.1: Add date to "Top Stories" cards on homepage (index.html)
  * [x] Task 4.2: Add date to "More to Chew On" cards on homepage (index.html)
  * [x] Task 4.3: Add date to "Read Next" cards on blog post page (post.html)

* [ ] Phase 3: Fix translation exclude list not respected by footer language switcher
  * [x] Task 3.1: Diagnose root cause — footer renders dead `/es/blog/...` links for excluded pages
  * [x] Task 3.2: Fix footer template (`classy/frontend/sections/footer.html`) to check exclude list
  * [x] Task 3.3: Fix `uj_translation_url` Ruby tag in `jekyll-uj-powertools` gem v1.7.11 (defense-in-depth)
  * [ ] Task 3.4: Validate on a consumer site (rebuild + check footer on blog post)
  * [ ] Task 3.5: Ship both repos (commit, push, publish gem + UJM)

* [x] Phase 2: Fix blog post ad insertion inside blockquotes
  * [x] Task 2.1: Filter out `<p>` elements inside `<blockquote>`, `<details>`, `<figure>` from ad insertion candidates in `post.js`

## Completed Task List
* [x] Phase 0: v1.9.0 release — MCP OAuth flow + CDP debugging docs + dev-URL updates
