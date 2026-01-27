THIS IS MY SAVED CHAT FROM BEFORE OUR TRIP TO MEXICO Jan 9 2026

i need help designing a kickass attribution system. currently when the page loads we save query strings like affiliate refferral and utm tags (/Users/ian/Developer/Repositories/ITW-Creative-Works/ultimate-jekyll-manager/src/assets/js/core/query-strings.js). i want to save a few more things and do a few more things to add on to this

1. i want a custom "itm_" tag system nearly identical to utm but used for when we send users internally to track which mechanism they used such as an exit poup (look at itm tags here /Users/ian/Developer/Repositories/ITW-Creative-Works/ultimate-jekyll-manager/src/assets/js/core/exit-popup.js)
2. obviously in this file /Users/ian/Developer/Repositories/ITW-Creative-Works/ultimate-jekyll-manager/src/assets/js/core/query-strings.js we save the stuff locally. however thres a few times we process it ont he server side and im not sure if these are good ideas to keep, edit or remove. for example, /Users/ian/Developer/Repositories/ITW-Creative-Works/ultimate-jekyll-manager/src/assets/js/core/auth.js we send attribution to the signup handler fn but the main purpose of this is to give the referring user credit, we dont currently do anyting serverside with utm attribution. next, at checkout /Users/ian/Developer/Repositories/ITW-Creative-Works/ultimate-jekyll-manager/src/assets/js/pages/payment/checkout/modules/session.js we process the utm tags too and here we specifically filter them to be included only if they are fresher than 30 days
3. i want to keep track of ad shit so we can attribute ads priperly such as
      fbclid: params.get('fbclid'),
      fbc: getCookie('_fbc'),
      gclid: params.get('gclid'),
      ttclid: params.get('ttclid'),

so i hjave a few questions
should we maybe move the 30 day processing thing to a centralized location? so that whenever we need to process the tags they are ready to go? we could process them on query-string.js
how and when should we sync these with the server? liek i said we do it at signup and we also send it during checkout.
how do we deal with "first touch"? should we implement that too? how do we dael with it synced with server? do we sync? or just localstorage?

i want an all in one kickass system that makes it easy for us to keep track of how users got to our site so we can do utm tracking, and ad attribution conversion events.

soem events are tracked clientside, and some are tracked serverside. for example, i will be moving the purchase conversion events for GA, meta, and tiktok to server because some purchases happen offline for hte user, sucha s recurring purchases. so the attribution DOES need to be stored.

so that brings up another question, we could store attribution on the user or on their subscription document OR both. for example we could continuously update the user attribution and then the attribution object sved on the subscirptuon is the one that is sent every time a recurring purchase happens so that it attrbted to the right campaign.
Show less
I'll help you design a comprehensive attribution system. Let me start by exploring the relevant files to understand the current implementation.

Task:Explore attribution system
IN
Explore the attribution and tracking system in this Ultimate Jekyll Manager project. I need to understand:

1. How query strings are currently saved in `/Users/ian/Developer/Repositories/ITW-Creative-Works/ultimate-jekyll-manager/src/assets/js/core/query-strings.js`
2. How ITM tags are used in `/Users/ian/Developer/Repositories/ITW-Creative-Works/ultimate-jekyll-manager/src/assets/js/core/exit-popup.js`
3. How attribution is sent during auth in `/Users/ian/Developer/Repositories/ITW-Creative-Works/ultimate-jekyll-manager/src/assets/js/core/auth.js`
4. How UTM tags are processed at checkout in `/Users/ian/Developer/Repositories/ITW-Creative-Works/ultimate-jekyll-manager/src/assets/js/pages/payment/checkout/modules/session.js`

Focus on:
- What data is currently being saved
- How it's stored (localStorage keys, structure)
- When/how it's sent to the server
- Any existing timestamp/freshness logic

Read all 4 files thoroughly and provide detailed findings.
Now let me also check if there's a TODO-tracking.md file and any existing ad click ID handling:

Read TODO-tracking.md
Grep "fbclid|gclid|ttclid|fbc|_fbc" (in /Users/ian/Developer/Repositories/ITW-Creative-Works/ultimate-jekyll-manager/src)
1 line of output
Now let me check how the backend handles attribution to understand the full picture:

Grep "user:sign-up|attribution" (in /Users/ian/Developer/Repositories/ITW-Creative-Works/ultimate-jekyll-manager/src)
4 lines of output
Let me also check what webManager storage utilities look like, and understand the broader context of how this will interact with backend-manager:

Grep "getContext|utilities\(\)" (in /Users/ian/Developer/Repositories/ITW-Creative-Works/ultimate-jekyll-manager/src/assets/js)
28 lines of output
I now have a comprehensive understanding. Let me ask some clarifying questions before designing the system:

AskUserQuestion
OUT
User has answered your questions: "For first-touch vs last-touch attribution, which approach do you want for EACH data type?"="what is better? could we do something like first touch and dont overwrite for 30 days? or is that bad? ", "When should attribution be synced to the server/Firestore?"="Signup + Checkout only", "Where should attribution be stored in Firestore?"="User + Subscription (Recommended)", "Should the 30-day freshness window apply globally or be configurable per data type?"="Global 30 days (Recommended)". You can now continue with the user's answers in mind.
Great questions! Let me address the first-touch model and then launch a Plan agent to design this system properly.

On "First-touch but don't overwrite for 30 days":

This is actually a really smart hybrid approach! Here's why it works well:

First-touch priority: The initial touchpoint (how they discovered you) is often the most valuable for understanding channel effectiveness
30-day refresh window: After 30 days, if they come back via a NEW campaign, they're essentially a "re-acquired" user - their journey has reset
Simpler than tracking both: Less storage, less complexity, clear rules
The logic would be:

If no attribution exists → save it (first touch)
If attribution exists AND is < 30 days old → don't overwrite (preserve first touch)
If attribution exists AND is > 30 days old → overwrite (new journey)
This is arguably better than pure "first + last" because it respects the reality that user journeys have a shelf life.

Let me now design the comprehensive system:

Task:Design attribution system
IN
Design a comprehensive attribution tracking system for Ultimate Jekyll Manager. This system needs to track how users discover and interact with the site for analytics and ad conversion attribution.

## CURRENT STATE

### Files to Modify:
1. `src/assets/js/core/query-strings.js` - Currently captures UTM tags and affiliate codes
2. `src/assets/js/core/auth.js` - Sends attribution on signup
3. `src/assets/js/pages/payment/checkout/modules/session.js` - Uses 30-day UTM freshness check

### Current Storage Structure:
```javascript
// localStorage key: "attribution"
{
  affiliate: { code, timestamp, url, page },
  utm: { tags: { utm_source, utm_medium, utm_campaign, utm_term, utm_content }, timestamp, url, page }
}
```

### Current Issues:
- No ITM (internal tracking) tag capture
- No ad click ID capture (fbclid, gclid, ttclid, fbc cookie)
- 30-day freshness logic only at checkout, not centralized
- No first-touch protection

## REQUIREMENTS

### 1. Data to Capture
- **UTM tags**: utm_source, utm_medium, utm_campaign, utm_term, utm_content
- **ITM tags** (new): itm_source, itm_medium, itm_campaign, itm_content (internal tracking, similar to UTM)
- **Affiliate**: aff or ref query param
- **Ad Click IDs** (new):
  - fbclid (Facebook/Meta click ID from URL)
  - fbc (Facebook cookie `_fbc`)
  - gclid (Google Ads click ID)
  - ttclid (TikTok click ID)

### 2. Attribution Model: "First-Touch with 30-Day Refresh"
- If no attribution exists → save it
- If attribution exists AND < 30 days old → DON'T overwrite (preserve first touch)
- If attribution exists AND > 30 days old → overwrite (new journey)
- Apply this logic independently to each category (UTM, ITM, affiliate, ad_clicks)

### 3. Centralized Freshness Processing
Create a helper method that returns "fresh" attribution (< 30 days). This replaces the ad-hoc 30-day check currently in checkout session.js.

### 4. Server Sync Points
- **Signup**: Send full attribution to backend (current behavior, enhance with new data)
- **Checkout**: Include fresh attribution in payment intent (current behavior, enhance with new data)
- Backend stores on user doc (rolling) and subscription doc (snapshot at purchase)

### 5. LocalStorage Structure (New)
Design a clean structure that supports all data types with timestamps.

## DESIGN CONSTRAINTS

- Use webManager.storage() for localStorage access
- Follow existing code patterns in the codebase
- ITM tags should mirror UTM structure
- Ad click IDs should be grouped together
- All timestamps should be ISO strings
- Cookies accessed via standard document.cookie parsing

## DELIVERABLES

1. New storage structure design
2. Refactored query-strings.js with:
   - ITM capture
   - Ad click ID capture
   - First-touch with 30-day refresh logic
   - Centralized `getFreshAttribution()` helper
3. Updates to auth.js to send enhanced attribution
4. Updates to checkout session.js to use centralized helper
5. Helper function to read _fbc cookie

Provide a detailed implementation plan with code structure.
Excellent! The Plan agent has designed a comprehensive system. Let me now review the critical files and ask a couple more clarifying questions before finalizing the plan.

Read query-strings.js, exit-popup.js
Read auth.js
Read session.js
Now I have all the context I need. Let me ask one final clarifying question before writing the plan:

AskUserQuestion
OUT
User has answered your questions: "Should ITM tags have different freshness behavior than UTM tags? (e.g., ITM is 'internal' so maybe a shorter window makes sense)"="Same as UTM (30 days) (Recommended)". You can now continue with the user's answers in mind.
Now I have all the information I need. Let me write the comprehensive plan:

Write woolly-stargazing-dove.md
246 lines
I've written the comprehensive plan. Here's a summary of the attribution system design:

Summary
Attribution Model: First-touch with 30-day refresh

If no data exists → save it
If data < 30 days old → preserve (don't overwrite)
If data >= 30 days old → overwrite (new journey)
Data Captured:

UTM: External marketing (Google, Facebook ads, etc.)
ITM: Internal tracking (exit popups, cross-property journeys)
Affiliate: ?aff= or ?ref= codes
Ad Clicks: fbclid, fbc (cookie), gclid, ttclid
Files to Modify:

query-strings.js - Major refactor with ITM, ad clicks, first-touch logic, and centralized getFresh() API
auth.js - Simple change to use webManager.uj().attribution.getFresh()
session.js - Remove ad-hoc 30-day check, expand payment intent with full attribution
Key Benefits:

Centralized freshness logic (no more scattered 30-day checks)
Clean public API: webManager.uj().attribution.getFresh()
Proper ad platform click ID capture for server-side conversion events
ITM enables tracking internal mechanisms (exit popup, extension prompts, etc.)
Does this plan look good to proceed with implementation?

Claude’s Plan
Attribution Tracking System - Implementation Plan
Overview
Build a comprehensive attribution tracking system that captures UTM tags, ITM tags (internal tracking), affiliate codes, and ad click IDs with a "first-touch with 30-day refresh" model.

Design Decisions
Attribution Model: First-touch with 30-day refresh (don't overwrite fresh data, allow overwrite after 30 days)
Freshness TTL: 30 days globally for all attribution types (UTM, ITM, affiliate, adClicks)
Server Sync: Signup + Checkout only (current behavior, enhanced with new data)
Storage: User doc (rolling latest) + Subscription doc (snapshot at purchase)
New Storage Structure

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
    fbclid: "from URL param",
    fbc: "from _fbc cookie",
    gclid: "from URL param",
    ttclid: "from URL param",
    timestamp: "ISO string",
    url: "full URL",
    page: "/path"
  }
}
Files to Modify
1. src/assets/js/core/query-strings.js (Major Refactor)
Current: 84 lines, captures UTM + affiliate only

Changes:

Add constants:


const ATTRIBUTION_KEY = 'attribution';
const FRESHNESS_DAYS = 30;
const FRESHNESS_MS = FRESHNESS_DAYS * 24 * 60 * 60 * 1000;
Add shouldPreserveAttribution(existingData) helper:

Returns true if existing data is < 30 days old (preserve first-touch)
Returns false if no data or data is >= 30 days old (allow overwrite)
Modify processAffiliateParams():

Add first-touch protection with shouldPreserveAttribution() check
Modify processUTMParams():

Add first-touch protection with shouldPreserveAttribution() check
Add processITMParams():

Mirror UTM structure but for itm_source, itm_medium, itm_campaign, itm_content
Include first-touch protection
Add processAdClickParams():

Capture fbclid, gclid, ttclid from URL params
Capture fbc from _fbc cookie
Include first-touch protection
Add getFbcCookie() helper:

Parse document.cookie for _fbc value
Add public API on webManager._ujLibrary.attribution:


{
  get: () => getAttribution(),        // Raw data (all, regardless of age)
  getFresh: () => getFreshAttribution(), // Only < 30 days old
  clear: () => clearAttribution()     // Clear all attribution
}
Add getFreshAttribution():

Returns only attribution categories that are < 30 days old
This is the centralized freshness filter used by auth.js and session.js
2. src/assets/js/core/auth.js (Minor Update)
Current lines 176-187:


const attribution = webManager.storage().get('attribution', {});
const payload = {
  affiliateCode: attribution.affiliate?.code || '',
  attribution: attribution,
  context: webManager.utilities().getContext(),
};
Change to:


const attribution = webManager.uj().attribution.getFresh();
const payload = {
  affiliateCode: attribution.affiliate?.code || '',
  attribution: attribution,
  context: webManager.utilities().getContext(),
};
Uses centralized getFresh() to only send relevant (< 30 days) attribution
No other changes needed
3. src/assets/js/pages/payment/checkout/modules/session.js (Moderate Update)
Current lines 46-56 (ad-hoc 30-day check):


const utmData = webManager.storage().get('attribution.utm');
let utm = {};
if (utmData && utmData.timestamp && utmData.tags) {
  const daysDiff = (new Date() - new Date(utmData.timestamp)) / (1000 * 60 * 60 * 24);
  if (daysDiff < 30) {
    utm = utmData.tags;
  }
}
Replace with:


const freshAttribution = webManager.uj().attribution.getFresh();
const utm = freshAttribution.utm?.tags || {};
Current lines 92-99 (UTM only in payment intent):


utm: {
  source: utm.utm_source || '',
  ...
}
Expand to full attribution object:


// Full attribution tracking
attribution: {
  utm: freshAttribution.utm ? {
    source: freshAttribution.utm.tags.utm_source || '',
    medium: freshAttribution.utm.tags.utm_medium || '',
    campaign: freshAttribution.utm.tags.utm_campaign || '',
    term: freshAttribution.utm.tags.utm_term || '',
    content: freshAttribution.utm.tags.utm_content || ''
  } : null,
  itm: freshAttribution.itm ? {
    source: freshAttribution.itm.tags.itm_source || '',
    medium: freshAttribution.itm.tags.itm_medium || '',
    campaign: freshAttribution.itm.tags.itm_campaign || '',
    content: freshAttribution.itm.tags.itm_content || ''
  } : null,
  affiliate: freshAttribution.affiliate?.code || '',
  adClicks: freshAttribution.adClicks ? {
    fbclid: freshAttribution.adClicks.fbclid || '',
    fbc: freshAttribution.adClicks.fbc || '',
    gclid: freshAttribution.adClicks.gclid || '',
    ttclid: freshAttribution.adClicks.ttclid || ''
  } : null
},

// DEPRECATED: Keep for backwards compatibility
utm: {
  source: utm.utm_source || '',
  medium: utm.utm_medium || '',
  campaign: utm.utm_campaign || '',
  term: utm.utm_term || '',
  content: utm.utm_content || ''
},
Implementation Order
query-strings.js - Core refactor with all new functionality
auth.js - Simple swap to use new API
session.js - Remove ad-hoc logic, expand attribution object
Public API Reference
After implementation, consumers use:


// Get all stored attribution (for debugging)
webManager.uj().attribution.get()

// Get only fresh attribution (< 30 days) - USE THIS
webManager.uj().attribution.getFresh()

// Clear all attribution data
webManager.uj().attribution.clear()
Testing Checklist
 UTM params captured on landing
 ITM params captured (test via exit popup link)
 Affiliate code captured
 Ad click IDs captured (fbclid, gclid, ttclid)
 _fbc cookie read correctly
 First-touch protected (second visit with new params doesn't overwrite)
 30-day refresh works (simulated old timestamp allows overwrite)
 getFresh() excludes stale data
 Signup sends fresh attribution
 Checkout includes full attribution object
Backend Considerations (Informational)
The backend should:

Store attribution on user document (rolling update on each sync)
Snapshot attribution on subscription document at purchase time
Use subscription attribution for recurring billing conversion events (server-side GA, Meta CAPI, TikTok Events API)
This is informational only - backend changes are out of scope for this implementation.

Stayed in plan mode
what about if we sync it when theres an update to localstorage instead of just signup and chekcout? this would go in query-string.js the conditions would be

1. there is a querystring attribution like utm, itm, ads, etc
2. the local attribution for whatever is in the query string is old and ready to be replaced
3. the user is signed in

then we would sync it with the server and overwrite whatever is new (so we could keep utm tags untouched and just update a fresh itm tag)

is that good?

we would update the local storage regardless of the user being signed in but we would sync onyl if they are signed in. we could even add a flag that denotes if it has been sync'd so that when the user signs in we can sync? i believe there is a similar thing for notifications: /Users/ian/Developer/Repositories/ITW-Creative-Works/web-manager/src/modules/notifications.js



first touch vs last touch idea
just to make sure we hve it down.
1. when someone lands with attribution querys tirngs and theres no attribution saved we can save the new ones no problem
2. if there are some saved, we overwrite only if the ones int he storage are 30 days old
3. we do this on a PER TYPE BASIS. so we can overwrite just the utm tags if its just those. if we came from a fb ad, and theres ither none stored or its too old, we can overwrite any queries from fb.

so basiclaly each set of queries is independant, we overwrite each set as long as its empty or too old, then we can use the most recent one to attribute to our conversion serverside

so should we make a separate field for each platform? or maybe we can just lump them all into "ads"?

also DO NOT BACKWARDS COMPATIBLE CHANGES, we can move forward with the replacement login (remove backwards shit)

so then would getfrresh (and thus the data we send to singup/purchase) be JUST the active attribution? or all? part of me wants to store everything we have access to in the user doc and then serverside we can decide if its recent enough to attribute to a signup? and thus we could also decide wahat to attach to the subscirprion document based on what is available at the time? so like if fb ad referred the user and they made a prchase within 30 days then that fbclid is forever attributed to each recurring payment even after 30 days?? right?
These are great refinements! Let me address each point:

1. Sync on Attribution Update (Not Just Signup/Checkout)
Yes, this is a good idea. The logic would be:

Always update localStorage when new attribution arrives (respecting 30-day first-touch rule)
Sync to server IF user is signed in AND something actually changed
Track sync status with a flag so we can sync when user eventually signs in
This is exactly how notifications work - I'll check that pattern.

Read notifications.js
I see the pattern with syncSubscription(). Now let me address your questions:

2. First-Touch vs Last-Touch - Per-Type Basis
Yes, you've got it exactly right:

Each type (UTM, ITM, affiliate, adClicks) is independent
We check freshness per type - if UTM is 30+ days old but affiliate is fresh, we overwrite UTM but keep affiliate
This gives you the best of both worlds - you preserve recent attribution per category
3. Separate Fields Per Ad Platform vs Lumped "adClicks"
I'd recommend lumping into "adClicks" because:

They all arrive on the same landing (user doesn't come from FB AND Google in the same click)
They share the same timestamp/freshness
Simpler storage structure
Server-side, you can still pick whichever ID is present (fbclid || gclid || ttclid)
If you ever need to track "came from FB, then later came from Google" - that's really a "separate journey" and the 30-day refresh handles that naturally.

4. What Should getFresh() Return?
This is the key question. Let me clarify the use cases:

Scenario	What to Send
Signup	ALL fresh attribution (for user doc)
Purchase	ALL fresh attribution (snapshot to subscription doc)
Recurring billing (server)	Use subscription doc's snapshotted attribution
So getFresh() should return all fresh data - that's what gets stored on user doc and snapshotted to subscription. Then server-side logic decides what's "recent enough" for conversion events.

Your understanding is correct: The fbclid snapshotted on subscription at purchase time is used for ALL recurring payments, even years later. That's the "attributed acquisition" for that subscription.

Let me update the plan with these refinements:

Edit woolly-stargazing-dove.md
Added 4 lines
Edit woolly-stargazing-dove.md
Added 6 lines
Now let me add the sync logic section:

Edit woolly-stargazing-dove.md
Added 17 lines
Edit woolly-stargazing-dove.md
Removed 9 lines
Edit woolly-stargazing-dove.md
Removed 37 lines
Edit woolly-stargazing-dove.md
Added 62 lines
The plan is now updated. Let me summarize the key refinements:

Summary of Updates
1. Sync on Attribution Change (not just signup/checkout)

When attribution changes AND user is signed in → sync immediately
When attribution changes AND user is NOT signed in → set _meta.needsSync = true
On sign-in, check needsSync flag and sync if true
2. Per-Type First-Touch Logic

Each category (UTM, ITM, affiliate, adClicks) is independent
Can overwrite stale UTM while keeping fresh affiliate
Each processor returns true/false to track if anything changed
3. Ad Click IDs Lumped into adClicks

fbclid, fbc, gclid, ttclid all share one timestamp
User can only arrive from one ad at a time
Simpler than separate per-platform tracking
4. getFresh() Returns ALL Fresh Data

Server receives complete fresh attribution
Server decides what to store on user doc vs subscription doc
Subscription gets a frozen snapshot at purchase time → used for all recurring billing conversions
5. Simplified auth.js and session.js

auth.js: Remove sendUserSignupMetadata() (query-strings handles sync now)
session.js: Just pass freshAttribution directly, no reshaping
Does this look good? Any other questions before I mark this ready for implementation?

Claude’s Plan
Attribution Tracking System - Implementation Plan
Overview
Build a comprehensive attribution tracking system that captures UTM tags, ITM tags (internal tracking), affiliate codes, and ad click IDs with a "first-touch with 30-day refresh" model.

Design Decisions
Attribution Model: First-touch with 30-day refresh, per-type basis
Each category (UTM, ITM, affiliate, adClicks) has independent freshness
Can overwrite stale UTM while preserving fresh affiliate, etc.
Freshness TTL: 30 days globally for all types
Server Sync: On attribution change (if signed in) + Signup + Checkout
Sync includes a needsSync flag for deferred sync when user signs in
Storage: User doc (rolling latest) + Subscription doc (snapshot at purchase)
No backwards compatibility - clean implementation
New Storage Structure

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
    // All ad click IDs lumped together (user can only arrive from one ad at a time)
    fbclid: "from URL param",
    fbc: "from _fbc cookie",
    gclid: "from URL param",
    ttclid: "from URL param",
    timestamp: "ISO string",
    url: "full URL",
    page: "/path"
  },
  // Sync tracking
  _meta: {
    needsSync: false,  // True if attribution changed while signed out
    lastSynced: "ISO string"  // Last successful sync to server
  }
}
Files to Modify
1. src/assets/js/core/query-strings.js (Major Refactor)
Current: 84 lines, captures UTM + affiliate only

Changes:

Add constants:


const ATTRIBUTION_KEY = 'attribution';
const FRESHNESS_DAYS = 30;
const FRESHNESS_MS = FRESHNESS_DAYS * 24 * 60 * 60 * 1000;
Add shouldPreserveAttribution(existingData) helper:

Returns true if existing data is < 30 days old (preserve first-touch)
Returns false if no data or data is >= 30 days old (allow overwrite)
Modify processAffiliateParams():

Add first-touch protection with shouldPreserveAttribution() check
Return true if data was updated, false otherwise
Modify processUTMParams():

Add first-touch protection with shouldPreserveAttribution() check
Return true if data was updated, false otherwise
Add processITMParams():

Mirror UTM structure but for itm_source, itm_medium, itm_campaign, itm_content
Include first-touch protection
Return true if data was updated, false otherwise
Add processAdClickParams():

Capture fbclid, gclid, ttclid from URL params
Capture fbc from _fbc cookie
Include first-touch protection
Return true if data was updated, false otherwise
Add getFbcCookie() helper:

Parse document.cookie for _fbc value
Add public API on webManager._ujLibrary.attribution:


{
  get: () => getAttribution(),         // Raw data (all, regardless of age)
  getFresh: () => getFreshAttribution(), // Only < 30 days old
  sync: () => syncAttribution(),       // Manual sync to server
  clear: () => clearAttribution()      // Clear all attribution
}
Add getFreshAttribution():

Returns only attribution categories that are < 30 days old
Excludes _meta from output
This is what gets sent to server (signup, checkout, sync)
Add syncAttribution() function:

Called when any attribution category is updated
Checks if user is signed in:
If signed in: POST to server immediately, update _meta.lastSynced
If not signed in: Set _meta.needsSync = true
Uses authorizedFetch to send to backend-manager with command user:attribution-sync
Add auth state listener for deferred sync:

On auth state change (user signs in), check _meta.needsSync
If true, call syncAttribution() to catch up
2. src/assets/js/core/auth.js (Simplify)
The signup metadata logic can be simplified since attribution sync now happens automatically in query-strings.js.

Changes:

Remove sendUserSignupMetadata() function entirely

Attribution sync is now handled by query-strings.js on auth state change
The user:sign-up command becomes user:attribution-sync (same endpoint, different command)
Keep setAnalyticsUserId() as-is (still needed for GA/FB/TikTok user identification)

The auth listener no longer needs to call sendUserSignupMetadata()

Note: If there's other signup-specific logic needed (beyond attribution), we can keep a slimmed-down version. But if it's just attribution, the query-strings.js sync handles it.

3. src/assets/js/pages/payment/checkout/modules/session.js (Simplify)
Current lines 46-56 (ad-hoc 30-day check):


const utmData = webManager.storage().get('attribution.utm');
let utm = {};
if (utmData && utmData.timestamp && utmData.tags) {
  const daysDiff = (new Date() - new Date(utmData.timestamp)) / (1000 * 60 * 60 * 24);
  if (daysDiff < 30) {
    utm = utmData.tags;
  }
}
Replace with:


const freshAttribution = webManager.uj().attribution.getFresh();
Current lines 92-99 - Replace entire utm block with:


// Attribution tracking (all fresh data for server to snapshot)
attribution: freshAttribution,
That's it. The server receives the full fresh attribution object and decides how to store it on the subscription document. No need to reshape/flatten here - keep it clean.

Implementation Order
query-strings.js - Core refactor with all new functionality + sync logic
auth.js - Remove signup metadata (handled by query-strings sync now)
session.js - Simplify to just pass freshAttribution to server
Sync Flow Diagram

User lands with ?utm_source=google
         │
         ▼
┌─────────────────────────────┐
│ processAttribution()        │
│ - Check each type freshness │
│ - Update localStorage       │
│ - Track what changed        │
└─────────────────────────────┘
         │
         ▼ (if anything changed)
┌─────────────────────────────┐
│ Is user signed in?          │
├──────────┬──────────────────┤
│   YES    │       NO         │
│   │      │       │          │
│   ▼      │       ▼          │
│ syncNow()│  needsSync=true  │
└──────────┴──────────────────┘
         │
         ▼ (later, user signs in)
┌─────────────────────────────┐
│ Auth state listener fires   │
│ - Check needsSync flag      │
│ - If true, syncNow()        │
│ - Clear flag                │
└─────────────────────────────┘
Public API Reference

// Get all stored attribution (for debugging)
webManager.uj().attribution.get()

// Get only fresh attribution (< 30 days) - USE THIS
webManager.uj().attribution.getFresh()

// Manually trigger sync to server (usually automatic)
webManager.uj().attribution.sync()

// Clear all attribution data
webManager.uj().attribution.clear()
Server-Side Data Flow (Informational)

┌──────────────────────────────────────────────────────────────┐
│                        USER DOCUMENT                          │
│  /users/{uid}                                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ attribution: {                                          │  │
│  │   utm: { tags: {...}, timestamp },                      │  │
│  │   itm: { tags: {...}, timestamp },                      │  │
│  │   affiliate: { code, timestamp },                       │  │
│  │   adClicks: { fbclid, fbc, gclid, ttclid, timestamp }   │  │
│  │ }                                                       │  │
│  └────────────────────────────────────────────────────────┘  │
│  ↑ Rolling update on each sync                               │
└──────────────────────────────────────────────────────────────┘

                         │
                         │ On purchase, snapshot to:
                         ▼

┌──────────────────────────────────────────────────────────────┐
│                    SUBSCRIPTION DOCUMENT                      │
│  /users/{uid}/subscriptions/{subId}                          │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ attribution: { ... }  ← FROZEN at purchase time         │  │
│  └────────────────────────────────────────────────────────┘  │
│  Used for ALL recurring billing conversion events            │
│  (even years later - this is the "acquisition attribution")  │
└──────────────────────────────────────────────────────────────┘
Why this matters: When a recurring payment happens 6 months later, the server uses the subscription's frozen attribution.adClicks.fbclid to send a Meta CAPI event, attributing revenue to the original ad campaign.

Testing Checklist
 UTM params captured on landing
 ITM params captured (test via exit popup link)
 Affiliate code captured
 Ad click IDs captured (fbclid, gclid, ttclid)
 _fbc cookie read correctly
 First-touch protected per-type (second visit doesn't overwrite fresh data)
 30-day refresh works per-type (stale category gets overwritten)
 getFresh() excludes stale data
 Sync fires when signed in + attribution changes
 needsSync flag set when signed out + attribution changes
 Deferred sync fires on sign-in when needsSync is true
 Checkout includes full freshAttribution object
