# Project Progress Tracker
> Agents and maintainers should update this file regularly to reflect the current state of the project.

## Current Focus
* **Goal:** FormManager disabled-state refactor (snapshot-and-restore)
* **Current Phase:** Phase 1 — implementation + tests complete, docs pending
* **Priority:** Medium
* **Last Updated:** 2026-06-20 11:03 PM PDT
* **Notes:** FM disabled-state refactor done + comprehensive FM test suite added (110 tests total, up from 80). Blog post ad insertion fix applied (Phase 2). Auth form HTML fixed to remove `disabled` from inputs (loading guards that conflicted with FM snapshot). Docs (javascript-libraries.md, CHANGELOG) still need updating before shipping.

## Active Task List
* [ ] Phase 1: FormManager disabled-state snapshot-and-restore
  * [x] Task 1.1: Refactor `_setDisabled` to use snapshot instead of `data-fm-keep-disabled`
  * [x] Task 1.2: Add `_permanentlyDisabled` Set, populated in `_init()` before first disable
  * [x] Task 1.3: Write page-layer tests (5 tests: snapshot capture, full disable, selective re-enable, cycle durability, onsubmit HTML guard)
  * [x] Task 1.4: All 85 tests passing
  * [x] Task 1.5: Add visual Test 7 to FM test page (form-manager.html + JS) with permanently disabled fields + rapid-cycle demo
  * [x] Task 1.6: Write comprehensive FM page-layer tests — getData/setData (12 tests), validation/honeypot/file-accept (13 tests). 110 total.
  * [x] Task 1.7a: Full audit + fix: remove `disabled` from all loading-guard inputs across UJM forms (auth signin/signup/reset, email-preferences, hero-demo-form input/select/textarea)
  * [x] Task 1.7b: Add `data-form-state="initializing"` to all 34 FM-managed forms + 7 test forms, CSS guard in `_initialize.scss`, FM sets attribute in `_init()`. Remove loading-guard `disabled` from test form inputs (tests 1-6).
  * [ ] Task 1.7: Update `docs/javascript-libraries.md` — replace `data-fm-keep-disabled` docs with new snapshot pattern + `onsubmit="return false"` + `data-form-state="initializing"` CSS guard
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
