# Project Progress Tracker
> Agents and maintainers should update this file regularly to reflect the current state of the project.

## Current Focus
* **Goal:** FormManager disabled-state refactor (snapshot-and-restore)
* **Current Phase:** Phase 1 — implementation + tests complete, docs pending
* **Priority:** Medium
* **Last Updated:** 2026-06-20 11:03 PM PDT
* **Notes:** FM disabled-state refactor done + comprehensive FM test suite added (110 tests total, up from 80). Blog post ad insertion fix applied (Phase 2). Docs (javascript-libraries.md, CHANGELOG) still need updating before shipping.

## Active Task List
* [ ] Phase 1: FormManager disabled-state snapshot-and-restore
  * [x] Task 1.1: Refactor `_setDisabled` to use snapshot instead of `data-fm-keep-disabled`
  * [x] Task 1.2: Add `_permanentlyDisabled` Set, populated in `_init()` before first disable
  * [x] Task 1.3: Write page-layer tests (5 tests: snapshot capture, full disable, selective re-enable, cycle durability, onsubmit HTML guard)
  * [x] Task 1.4: All 85 tests passing
  * [x] Task 1.5: Add visual Test 7 to FM test page (form-manager.html + JS) with permanently disabled fields + rapid-cycle demo
  * [x] Task 1.6: Write comprehensive FM page-layer tests — getData/setData (12 tests), validation/honeypot/file-accept (13 tests). 110 total.
  * [ ] Task 1.7: Update `docs/javascript-libraries.md` — replace `data-fm-keep-disabled` docs with new snapshot pattern + `onsubmit="return false"` + `data-form-state="initializing"` CSS guard
  * [ ] Task 1.8: Update CHANGELOG with the change
  * [ ] Task 1.9: Ship (commit, push, publish)

* [x] Phase 2: Fix blog post ad insertion inside blockquotes
  * [x] Task 2.1: Filter out `<p>` elements inside `<blockquote>`, `<details>`, `<figure>` from ad insertion candidates in `post.js`

## Completed Task List
* [x] Phase 0: v1.9.0 release — MCP OAuth flow + CDP debugging docs + dev-URL updates
