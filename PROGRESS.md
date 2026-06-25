# Project Progress Tracker
> Agents and maintainers should update this file regularly to reflect the current state of the project.

## Current Focus
* **Goal:** FormManager disabled-state refactor — global fleet rollout
* **Current Phase:** Phase 1 — global form fixes applied, docs pending
* **Priority:** Medium
* **Last Updated:** 2026-06-25 9:07 AM PDT
* **Notes:** Global audit + fix complete. 41 files edited across UJM framework + 19 consumer repos. All JS-managed forms now have `data-form-state="initializing"` + `onsubmit="return false"`. Unnecessary `disabled` removed from submit buttons. `data-fm-keep-disabled` eliminated. Docs still need updating.

## Active Task List
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
