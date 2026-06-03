# TODO: Consent System End-to-End Live Test Checklist

## Context

End-to-end manual smoke for the marketing-consent + cross-provider-unsub
pipeline. Run after each new BEM/WM/UJM deploy that touches auth, consent,
email-preferences, or webhook code paths.

Each step depends on state set up by earlier steps. Run top-to-bottom.

Live test target: **Somiibo** (`somiibo.com` + `api.somiibo.com`).
Parent BEM: **ITW** (`itwcreativeworks.com` + `api.itwcreativeworks.com`).

## Pre-flight

- [ ] **Use a fresh email** (`consent-test+1@yourdomain.com` or a Gmail alias) so the signup is genuinely new
- [ ] **Have a separate Google account ready** that has never signed up here (for the reverse-signup test)
- [ ] **Open multiple browser windows side by side**:
  - Somiibo signup page
  - SendGrid Marketing → Contacts
  - Beehiiv dashboard → Somiibo publication subscribers
- [ ] **Tail BEM logs in terminal**:
  ```bash
  cd /Users/ian/Developer/Repositories/Somiibo/somiibo-backend/functions
  npx mgr logs:tail
  ```
- [ ] **Confirm current package versions live**:
  - BEM: `^5.2.2`
  - web-manager: `^4.2.0`
  - UJM: `^1.3.2`
- [ ] **Confirm last Somiibo backend + website deploys** were AFTER the BEM/UJM version bumps
- [ ] **Delete any stale test accounts** from previous attempts:
  ```bash
  npx mgr auth:get "<test-email>"     # find the uid
  npx mgr auth:delete "<uid>" --force
  npx mgr firestore:delete "users/<uid>" --force
  ```

## Tests

### ☐ Test 1 — Signup with marketing consent granted (golden path)

**Action:** Sign up at `somiibo.com/signup` with both checkboxes checked.

**Verify:**
- [ ] Account created, redirected to logged-in dashboard
- [ ] `npx mgr firestore:get users/<uid>` shows:
  - `consent.legal.status: 'granted'`
  - `consent.legal.grantedAt.source: 'signup'`
  - `consent.legal.grantedAt.ip` populated (not null)
  - `consent.legal.grantedAt.text` is the actual label string
  - `consent.marketing.status: 'granted'`
  - `consent.marketing.grantedAt.source: 'signup'`
  - `consent.marketing.revokedAt.timestamp: null`
- [ ] SendGrid Contacts: new contact exists with this email
- [ ] Beehiiv Subscribers: new subscriber exists
- [ ] BEM logs: search for `buildConsentRecord: legal=granted, marketing=granted`

**Capture the uid** for use in later tests.

### ☐ Test 2 — Signup with marketing UNCHECKED

**Action:** Sign out. Sign up with a different fresh email. Legal checked, marketing UNCHECKED.

**Verify:**
- [ ] `consent.marketing.status: 'revoked'`, `revokedAt.source: 'signup'`, `grantedAt.timestamp: null`
- [ ] SendGrid: contact NOT created
- [ ] Beehiiv: subscriber NOT created
- [ ] BEM logs: `buildConsentRecord: legal=granted, marketing=revoked` — `mailer.sync()` should NOT have been called

### ☐ Test 3 — Signup with legal UNCHECKED (validation blocks)

**Action:** Try to submit signup with legal box UNCHECKED.

**Verify:**
- [ ] Submit button is disabled OR clicking submit shows the inline error + red outline around the consent group
- [ ] No Firebase auth user created
- [ ] No request fired to `/user/signup` (browser DevTools network tab)

### ☐ Test 4 — Google sign-in with a NEW (nonexistent) Google account on /signin

**Action:** On `somiibo.com/signin` (NOT `/signup`), click "Continue with Google" and authenticate with a Google account that has never been used here.

**Verify:**
- [ ] Inline error appears: "This account doesn't exist. Try signing up first or use a different account."
- [ ] User stays on `/signin` (no redirect away)
- [ ] Firebase Auth dashboard: the user does NOT persist (created then deleted)
- [ ] Firestore: no orphan user doc remains (`users` collection)
- [ ] BEM logs: look for `Reversing accidental signup from /signin` warning
- [ ] `sendUserSignupMetadata` should NOT have run (no `/user/signup` POST in logs)

### ☐ Test 5 — Account-page opt-out

**Action:** Sign in as the Test 1 user. Go to `/account` → notifications section. Toggle marketing OFF.

**Verify:**
- [ ] Toast/UI confirms the change
- [ ] `consent.marketing.status: 'revoked'`, `revokedAt.source: 'account'`, `revokedAt.timestamp` is recent, `revokedAt.ip` populated
- [ ] `consent.marketing.grantedAt` is UNTOUCHED (original signup grant info preserved)
- [ ] SendGrid: contact removed from list
- [ ] Beehiiv: subscriber removed

### ☐ Test 6 — Account-page opt-in (re-grant)

**Action:** Same user. Toggle marketing back ON.

**Verify:**
- [ ] `status: 'granted'`, `grantedAt.source: 'account'`, `grantedAt.timestamp` newer than original
- [ ] `revokedAt` UNTOUCHED (informational, still shows the Test 5 revoke)
- [ ] SendGrid: contact re-added
- [ ] Beehiiv: subscriber re-added

### ☐ Test 7 — SendGrid webhook → cross-provider sync via parent forwarder

**Action:** In SendGrid dashboard → Marketing → Contacts, find Test 1 user's contact and manually unsubscribe (or add their email to the Global Unsubscribe list via Suppressions).

**Verify (allow up to ~30s for delivery):**
- [ ] ITW BEM logs: `POST /backend-manager/marketing/webhook/forward?provider=sendgrid` with 200
- [ ] Somiibo BEM logs: `POST /backend-manager/marketing/webhook?provider=sendgrid` from parent forwarder
- [ ] Somiibo Firestore: `consent.marketing.status: 'revoked'`, `revokedAt.source: 'sendgrid'`
- [ ] Beehiiv: subscriber removed (cross-provider sync)
- [ ] ITW Firestore `marketing-webhooks/{eventId}` doc exists (idempotency record)
- [ ] Repost the same event manually with curl → second receipt short-circuits on `eventId`

### ☐ Test 8 — Beehiiv webhook (DEFERRED until Beehiiv plan upgraded)

**⏸️ Blocked**: Beehiiv webhook API requires a paid Beehiiv tier (currently 403 `ACCESS_FORBIDDEN`).

When unblocked:
- Run `npm start -- --service beehiiv` in OMEGA to auto-configure all publications
- OR manually add the webhook in each publication's settings:
  - URL: `https://api.itwcreativeworks.com/backend-manager/marketing/webhook/forward?provider=beehiiv&key=<BACKEND_MANAGER_WEBHOOK_KEY>`
  - Events: `subscription.unsubscribed`, `subscription.deleted`, `subscription.paused`
  - Publications: Somiibo (`pub_60fa806e...`), StudyMonkey (`pub_0716e341...`), shared devbeans (`pub_69c961a7...`)

Then test: unsub via Beehiiv's "Manage subscription" link → verify symmetric flip on Firestore + SendGrid.

### ☐ Test 9 — Page-load consent guard (ENFORCE_CONSENT_GUARD = true)

**Action:** Manually edit Test 1 user's Firestore doc via `npx mgr firestore:set users/<uid>` to flip `consent.legal.status` to `'revoked'`. Refresh the Somiibo page.

**Verify:**
- [ ] User is signed out (with notification toast: "This account hasn't completed setup. Please sign up first.")
- [ ] Lands on public site
- [ ] Browser console warning: `[Auth] Signing out user with no legal consent on record`
- [ ] **Restore** `consent.legal.status` to `'granted'` so the user can use Somiibo again

**Important caveat from v1.3.2 fix:** the guard only fires for accounts older than `SIGNUP_MAX_AGE` (5min). For this test to work, the Test 1 user must have signed up more than 5 minutes ago. If you just signed up and immediately ran this, the guard won't fire — wait 5 minutes or use an older test account.

### ☐ Test 10 — HMAC anonymous unsubscribe link (from a marketing email)

**Action:** Trigger a marketing email send (or grab an existing unsub link from a previous email). Click it.

**Verify:**
- [ ] Unsub confirmation page loads
- [ ] User's `consent.marketing.status: 'revoked'`, `revokedAt.source: 'sendgrid'` (or `'beehiiv'` depending on link origin)
- [ ] SendGrid: removed
- [ ] Beehiiv: removed

## Commands cheat-sheet

```bash
# All from Somiibo backend dir
cd /Users/ian/Developer/Repositories/Somiibo/somiibo-backend/functions

# Logs (live tail)
npx mgr logs:tail

# Logs (one-shot)
npx mgr logs:read --limit 100
npx mgr logs:read --filter "consent" --limit 50
npx mgr logs:read --filter "marketing/webhook" --limit 50
npx mgr logs:read --filter "<uid>" --limit 100

# Firestore
npx mgr firestore:get "users/<uid>"
npx mgr firestore:query "marketing-webhooks" --limit 10    # idempotency records (run from ITW backend, the parent)
npx mgr firestore:set "users/<uid>" '{...partial...}' --merge
npx mgr firestore:delete "users/<uid>" --force

# Auth
npx mgr auth:get "<email-or-uid>"
npx mgr auth:delete "<uid>" --force
```

## Progress log

Track which tests have been run + when. Mark with date once you've verified end-to-end.

- [ ] Test 1 — Signup, marketing GRANTED
- [ ] Test 2 — Signup, marketing UNCHECKED
- [ ] Test 3 — Signup, legal UNCHECKED (validation blocks)
- [ ] Test 4 — Google new account on /signin (reverse-signup)
- [ ] Test 5 — Account opt-out
- [ ] Test 6 — Account opt-in (re-grant)
- [ ] Test 7 — SendGrid webhook → cross-provider
- [ ] Test 8 — Beehiiv webhook (deferred)
- [ ] Test 9 — Page-load guard
- [ ] Test 10 — HMAC unsub link

Last attempted: 2026-05-22, got blocked on Test 1 by the v1.3.1 consent-guard ordering bug. Fixed in v1.3.2. Ready to restart from Test 1 after Somiibo redeploys against `ultimate-jekyll-manager@^1.3.2`.
