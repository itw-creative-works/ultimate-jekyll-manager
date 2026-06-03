# TODO: Automated Tests for the Auth System

## Why

The consent-guard / `sendUserSignupMetadata` ordering bug that shipped in v1.3.1 (and was fixed in v1.3.2) is exactly the kind of regression that should never reach production. The bug was:

- Page-load consent guard ran BEFORE `sendUserSignupMetadata`
- Brand-new signups had `consent.legal.status: 'revoked'` (BEM schema default)
- Guard saw `'revoked'` → signed user out → metadata POST never fired → user permanently orphaned

Discovered only via live testing on Somiibo. Should have been caught by a unit test.

This file proposes a layered test strategy so the next refactor + every future change is safe.

## Strategy: three tiers, mostly mocked

### Tier 1 — Unit (JSDOM + mocked Firebase, fast)

Run from UJM. Add to the existing `test/tests/**/*.test.js` harness. No real Firebase, no network. Covers ~80% of bugs including the v1.3.1 regression.

Files to write:

```
test/tests/auth-consent-capture.test.js
  • captureSignupConsent() reads consent-legal + consent-marketing checkboxes
  • writes the right shape to webManager.storage() under key 'consent'
  • label text is captured verbatim (so BEM gets the exact string the user saw)

test/tests/auth-consent-validate.test.js
  • validateConsent() blocks submit when consent-legal is unchecked
  • surfaces the inline error + wrapper outline
  • does NOT block submit when both boxes are checked or only marketing is unchecked

test/tests/auth-guard-ordering.test.js   ← THIS WOULD HAVE CAUGHT v1.3.1
  • on a fresh user (account < SIGNUP_MAX_AGE) with consent.legal.status: 'revoked'
    → sendUserSignupMetadata is called
    → guard does NOT sign out
  • on an old user (account > SIGNUP_MAX_AGE) with consent.legal.status: 'revoked'
    → guard signs out
    → notification is shown
  • on any user with consent.legal.status: 'granted'
    → guard does NOT fire regardless of age

test/tests/auth-reverse-signup.test.js
  • reverseAccidentalSignup() calls user.delete() THEN signOut() THEN clears authReturnUrl
  • formManager.showError fires with the right message
  • if user.delete() throws, signOut still runs (best-effort)

test/tests/auth-policy-redirect.test.js
  • policy='authenticated' + no user → redirect to unauthenticated URL
  • policy='unauthenticated' + user → redirect to authenticated URL (honoring authReturnUrl)
  • policy='disabled' → no-op

test/tests/auth-metadata-payload.test.js
  • sendUserSignupMetadata builds the right payload shape
  • includes consent, attribution, context
  • skips when account is old or signupProcessed flag is set
  • sets signupProcessed flag after successful POST
```

Mocking contract:

```js
// Mock webManager
const fakeWebManager = {
  auth: () => ({ listen, signOut, getIdToken }),
  storage: () => ({ get, set }),
  utilities: () => ({ showNotification }),
  config: { auth: { config: { policy, redirects, roles } } },
};

// Mock Firebase auth functions
// - createUserWithEmailAndPassword
// - signInWithEmailAndPassword
// - signInWithPopup / signInWithRedirect
// - getRedirectResult
// - sendPasswordResetEmail
// - user.delete()
// - getAuth().signOut()

// Mock FormManager (or use the real one — it's mockable already)
const fakeFormManager = { showError, showSuccess, ready, ... };
```

Approach: load `src/assets/js/core/auth.js` and `src/assets/js/libs/auth.js` into JSDOM
with all imports stubbed (Jest/Mocha module mocks or rewire). For HTML-aware tests
(captureSignupConsent), load `src/defaults/dist/_layouts/themes/classy/frontend/pages/auth/signup.html`
into JSDOM and exercise the real DOM.

### Tier 2 — Integration against Firebase Emulator (slower, optional)

Run from UJM. Boot `firebase emulators:start --only auth,firestore` before the suite.
Extend the existing `test/fixtures/consumer-site/` with:

- `firebase.json` configured for emulator ports
- Canned Firebase web config pointing at `localhost:9099` / `localhost:8080`
- Test user seeding via Admin SDK helpers

Covers: full email-signup round-trip, the storage-survives-redirect path, real
auth-state-listener firing, real Firestore reads in the guard.

**Skip OAuth at this tier.** Firebase emulator's auth emulator doesn't speak to
real Google. OAuth tests stay manual (Tier 3).

This is OPTIONAL — only worth building if a bug slips through Tier 1.

### Tier 3 — Manual smoke (don't automate)

Google OAuth + cross-provider webhooks stay manual. Reasons:
- Google actively blocks scripted browsers (even Puppeteer with stealth plugins)
- Real 2FA flows
- Provider UI rolls and tests break
- Cost/value is terrible

Keep the live-test checklist (see [TODO-CONSENT-LIVETEST.md](TODO-CONSENT-LIVETEST.md))
as the authoritative manual smoke procedure.

## Where the tests live

Run from UJM. NOT from a host project. Reasons:
- `core/auth.js` + `libs/auth.js` are owned by UJM
- Host project tests would re-test framework internals, wrong layering
- UJM's existing 60-test Mocha harness is already fast (~6s)

Default config (Firebase emulator + a fake brand) baked into
`test/fixtures/` so contributors don't need their own Firebase project.

## Sequencing

1. **First**: do the libs/auth.js refactor (split into `auth.js` + `auth-providers.js` + `auth-consent.js`).
   - See the auth-audit findings in this session's notes.
   - Refactor first means we write tests against the FINAL shape, not throw-away.
   - Each new file gets a focused test file.

2. **Then**: Tier 1 unit tests for the new shape.
   - Target: every test file from the list above, green.
   - Should take ~half a day.

3. **Optional later**: Tier 2 emulator-backed tests, only if Tier 1 misses a class
   of bugs in practice. Probably won't be needed.

4. **Never**: Tier 3 automation. Stays manual via [TODO-CONSENT-LIVETEST.md](TODO-CONSENT-LIVETEST.md).

## What about Ultimate Jekyll for the test site?

Tempting but NO. Reasons:
- UJ build is heavy (Jekyll + webpack), test boot would be 10+ seconds
- Circular dependency risk (UJM testing UJM via UJ which uses UJM)
- UJM's existing Mocha harness is the right tool

The test harness should stay vanilla Mocha + JSDOM + fixture HTML files.

## What this DOESN'T cover

- Google OAuth UI flows (manual only)
- Cross-provider unsubscribe webhooks (manual + BEM tests already exist)
- Beehiiv webhook setup (blocked on plan upgrade; manual when ready)
- Firebase Auth SDK bugs (not our code, not our problem)

## Done criteria

- All 6 test files above written and green
- `npm test` in UJM runs them as part of the standard suite
- The v1.3.1 bug (consent guard ordering) is caught by `auth-guard-ordering.test.js` — verify by reverting the v1.3.2 fix in a branch and watching the test fail
- Documented in `docs/testing.md` so contributors know to add auth tests when touching auth code
