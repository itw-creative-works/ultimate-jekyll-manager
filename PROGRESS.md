# Project Progress Tracker
> Agents and maintainers should update this file regularly to reflect the current state of the project.

## Current Focus
* **Goal:** Unreleased fix pending — sass watcher bundles-dir guard (ship as next patch)
* **Current Phase:** v1.9.28 shipped; sass watcher fix uncommitted in working tree
* **Priority:** Medium
* **Last Updated:** 2026-07-06 3:45 AM PDT
* **Notes:** `test/**/*` is now copy-once in `defaults.js` FILE_MAP — setup reruns no longer reset the consumer's `test/_init.js` (bit the Video-Editor/Clipdeck project twice). Sister frameworks (BEM/EM/BXM) have mirrored defaults tasks and likely the same gap — audit them in a follow-up pass. Prior focus (Phase 6 CI hardening) shipped in v1.9.16; kolpav kept.

## Active Task List
* [ ] One-off: sass watcher ENOENT on missing project bundles dir (2026-07-06 — found by Video-Editor/Clipdeck 4.3)
  * [x] Root cause: `bundleFiles` fed an unguarded `src/assets/css/bundles/*.scss` glob into `src()`/`watch()`; gulp's src() throws `ENOENT scandir` on a missing dir. Boot-time compile survived, but EVERY watcher-triggered rebuild errored in ms and consumer dist CSS silently went stale. Identical failure mode `themePageGlobs()` in the same file already guards (with the same rationale in its comment)
  * [x] Fix: project-bundles glob spread in only when the dir exists (`jetpack.exists` — mirrors themePageGlobs). One expression in `src/gulp/tasks/sass.js`
  * [x] Verified: repro probe against the repo's own gulp — unguarded list = `ENOENT scandir .../src/assets/css/bundles`, guarded = OK, guarded+dir-present = both files compiled (probe lives in the Video-Editor session scratchpad); `node --check` clean; `npm run prepare` synced dist; CHANGELOG [Unreleased]
  * [ ] Ship as next patch release. Video-Editor consumer carries an empty `src/assets/css/bundles/` workaround dir (its gotcha #22) — delete it there once this ships
  * [ ] No locking test: the guard is require-time cwd-dependent and the suite has no fake-consumer sass harness to require sass.js against — would need that harness first
* [ ] One-off: serve HTTPS cert validation — harmonized with BEM (2026-07-03)
  * [x] Bug 1: reuse lookup matched `localhost*.pem` but mkcert names certs after the FIRST SAN host (`development.<brand>+N.pem`) → cache never hit, certs silently regenerated EVERY serve. Lookup now matches `*.pem` (same as the post-generate find)
  * [x] Bug 2: "validity" check was just a `BEGIN CERTIFICATE` header sniff → foreign-CA (`.temp` roamed from another Mac) or expired certs reused blindly, browser rejects https://localhost:4000. New `checkCertProblem()`: unexpired + signature verifies against current `mkcert -CAROOT`; on problem, wipe `.temp/*.pem` + regenerate. Identical logic to backend-manager serve.js `_checkCertProblem()` (found via somiibo-backend's foreign-CA cert incident)
  * [x] Verified: function extracted verbatim from serve.js → fresh mkcert cert = usable; openssl foreign-CA cert = "issued by a different CA"; `node --check` + `npm run prepare` clean
  * [x] Shipped as v1.9.28 (includes web-manager ^4.3.4 bump — https dev API URL); paired ships: BEM v5.11.7 (cert validation), WM 4.3.4 (dev URL https + loopback redirects). Full suite 119 passing with WM 4.3.4 installed
* [x] One-off: token page's `?payload=` wrap made ADDITIVE (2026-07-03 — Ian's call: "pass more than we need, consumers ignore the extra")
  * [x] `pages/token/index.js` `_legacyTranslateTokenRedirect` no longer deletes `authToken` before setting `payload` — custom-scheme redirects carry BOTH shapes; old apps read payload, modern apps (EM `getAuthUrl()` flow, `authToken`-only) read authToken, each ignores the other. One-line change; old app byte-identical. Paired: EM's `auth/token` deep-link route reads ONLY `?authToken=`. The wrap still deletes cleanly when legacy support ends (existing TODOs)
  * [x] Error-state UX (2026-07-03): the loading spinner spun forever after a failure — `showError()` never hid the static spinner. Added `#token-spinner` + `#token-actions` to classy's `auth/token.html`; new `stopSpinner()` runs on every terminal state; on error the spinner swaps for a **Try again** (reload) button + smaller **Go home** link. New page-layer `token-error-state.test.js` (4 tests); full suite 119 passing
* [x] One-off: defaults task clobbered consumer `test/_init.js` on setup reruns (2026-07-02)
  * [x] Root cause: no FILE_MAP rule matched `test/**` — fall-through default is `overwrite: true`, so every `npx mgr setup` reset the consumer's fixture hook to the stub (only `test/README.md` was protected, via `**/*.md`)
  * [x] Fix: `'test/**/*': { overwrite: false }` in the copy-once section (seed when missing, consumer-owned after — matches the `src/`/`hooks/` convention); `getFileOptions` exported for testability
  * [x] New build-layer `defaults-file-options.test.js` locks all four rule classes (copy-once / always-overwrite / merge / skip) incl. last-match-wins ordering; full suite 115 passing ×2; `npm run prepare` synced dist
  * [x] Docs: new "Defaults distribution" rule table in `docs/build-system.md` (⚠️ unmatched files fall through to overwrite — new consumer-owned defaults MUST get an explicit rule), consumer-ownership note in `docs/test-framework.md` § test/_init.js, CHANGELOG [Unreleased]
  * [x] Follow-up (2026-07-06): audited BEM/EM/BXM — BEM + EM SAFE (their `copyDefaults()` in setup.js is copy-once by design: "already exists → preserve consumer's version"; EM's gulp defaults task is still a stub). BXM HAD the gap (ships `test/_init.js`, no `test/**` FILE_MAP rule → fall-through overwrite) — fixed in its working tree: `test/**/*` copy-once + `getFileOptions` export + locking build test + `getConfig()` missing-file guard (`JSON5.parse(undefined)` crashed in framework-repo context); 86/86 passing, CHANGELOG + docs/defaults.md updated. Uncommitted — BXM clone is 5 commits behind origin w/ unrelated WIP; Ian reconciles
* [x] One-off: `--extended` boolean-declaration fix in bin (2026-07-02)
  * [x] Bare `yargs(...).parseSync()` let `mgr test --extended some/target` swallow the target as the flag's VALUE (target lost + extended silently off); bin now declares `.boolean(['extended'])` — mirrors BEM's cli fix; same fix applied to BXM + EM in the same pass
  * [x] Verified: parse proof (before/after) + real bin run shows `target="..." +extended` + `build/cli` suite 3 passing; CHANGELOG [Unreleased]
* [x] One-off: Test discovery `_`-dir exclusion fix (2026-07-02)
  * [x] `runner.js` discovery globs ignored only top-level `_` entries (`['_**']`) — files under `_`-prefixed dirs (e.g. `test/_helpers/x.js`) were discovered as suites; both globs now share exported `DISCOVERY_IGNORE = ['**/_*.js', '**/_*/**']` (mirrors EM's fix)
  * [x] TDD: new build-layer `test-discovery.test.js` (red → green against a real temp tree); full suite 112 passing
  * [x] Docs: `docs/test-framework.md` Discovery bullet + CHANGELOG [Unreleased]; same fix applied to BXM (85 passing); BEM already correct (recursive walker), EM already shipped it
* [x] One-off: CDP doc rewrite for the per-session isolated browser (2026-07-01)
  * [x] `docs/cdp-debugging.md` rewritten (mirrored UJM/BEM/BXM/EM/WM): sessions auto-launch their own private Chrome via the `chrome-devtools` MCP — no launch command/ports/shared profile; resolved the committed merge conflict — dev URL is `https://localhost:4000`, NEVER the LAN IP
  * [x] CLAUDE.md live-test line updated to the localhost-only rule; CHANGELOG [Unreleased] added (uncommitted — ship with next release)
  * [x] OMEGA mirror mandate: Doc-update parity now documents the mirrored structure (canonical skeletons: omega:main mirror-spec); maintainer mirror note added to src/defaults/CLAUDE.md
* [x] One-off: Billing redirects category (2026-07-01)
  * [x] Move `/cancel` + `/refund` default redirects from `redirects/authentication/helpers/` to new `redirects/billing/` category
  * [x] Fix `/refund` target: `/privacy` → `/terms` (refund policy lives in terms)
  * [x] All 110 tests passing; CHANGELOG [Unreleased] entry added

* [ ] Phase 6: CI workflow hardening — retry logic + action version bumps
  * [x] Task 6.1: Diagnose CI failure — transient ECONNRESET + sfw crash on undefined alert results
  * [x] Task 6.2: Add 3x retry with 15s delay to `sfw npm install` step (with comments)
  * [x] Task 6.3: Bump `actions/checkout` v4→v7, `actions/setup-node` v4→v6 (Node 20 deprecation)
  * [x] Task 6.4: Decide on `kolpav/purge-artifacts-action@v1` — keeping (still useful, warning is cosmetic)
  * [x] Task 6.5: Fix `defaults.js` — add `overwrite: true` to `.github/workflows/build.yml` entry so workflow syncs on every `npx mgr setup`
  * [x] Task 6.6: Publish v1.9.16

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
