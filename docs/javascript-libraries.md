# JavaScript Libraries

UJM ships two layers of frontend JS infrastructure:

1. **WebManager** — the singleton site-management library (auth, utilities, sentry, dom).
2. **Ultimate Jekyll Libraries** at `src/assets/js/libs/` — helper modules importable via `__main_assets__/js/libs/<name>.js`.

## WebManager

Custom library for site management functionality. **It's a singleton** — import it directly from any file:

```javascript
import webManager from 'web-manager';
```

This returns the same initialized instance everywhere. Do NOT pass it via params, store in module-level variables, or create new instances.

**Documentation:** `/Users/ian/Developer/Repositories/ITW-Creative-Works/web-manager/README.md`

**Available Utilities:**
- `webManager.auth()` — Authentication management
- `webManager.utilities()` — Utility functions (escapeHTML, clipboardCopy, etc.)
- `webManager.sentry()` — Error tracking
- `webManager.dom()` — DOM manipulation
- `webManager.utilities().escapeHTML(text)` — **XSS prevention** — use this instead of writing your own escape function. See [docs/xss-prevention.md](xss-prevention.md).

**Important:** Always check the source code or README before assuming a function exists. Do not guess at API methods.

### Subscription Resolution

Use `webManager.auth().resolveSubscription(account)` to derive calculated subscription state. This is the **single source of truth** for determining a user's effective plan — do NOT manually check `subscription.status`, `trial.claimed`, or `cancellation.pending` separately.

```javascript
const resolved = webManager.auth().resolveSubscription(account);
// Returns: { plan, active, trialing, cancelling }
```

| Field | Description |
|-------|-------------|
| `plan` | Effective plan ID right now (`'basic'` if cancelled/suspended) |
| `active` | Has active access (active, trialing, or cancelling) |
| `trialing` | In active trial |
| `cancelling` | Cancellation pending |

Raw subscription data (product.id, status, trial, cancellation) is on `account.subscription` directly — `resolveSubscription()` returns only the calculated/derived fields.

The same function exists in BEM as `User.resolveSubscription(account)` with identical return shape.

## Ultimate Jekyll Libraries

Ultimate Jekyll provides helper libraries in `src/assets/js/libs/` that can be imported as needed.

### Prerendered Icons Library

Provides access to icons defined in page frontmatter and rendered server-side. See [docs/icons.md](icons.md) for when/why to use prerendered icons.

**Import:**

```javascript
import { getPrerenderedIcon } from '__main_assets__/js/libs/prerendered-icons.js';
```

**Usage:**

```javascript
// With classes (drop-in replacement for uj_icon)
getPrerenderedIcon('apple', 'fa-md me-2');

// Without classes (no size class)
getPrerenderedIcon('apple');
```

**Reference:** `src/assets/js/libs/prerendered-icons.js`

### Authorized Fetch Library

Simplifies authenticated API requests by automatically adding Firebase authentication tokens via Authorization Bearer header.

**Import:**

```javascript
import authorizedFetch from '__main_assets__/js/libs/authorized-fetch.js';
```

**Usage:**

```javascript
const response = await authorizedFetch(url, options);
```

**Key Benefits:**
- No need to manually call `webManager.auth().getIdToken()`
- Automatic token injection as Authorization Bearer header
- Centralized authentication handling
- Automatic usage sync: extracts `bm-properties` header from every response and updates `webManager.bindings()` with fresh usage data under the `usage` key

**Options pass-through:** All `wonderful-fetch` options (`response`, `output`, `body`, `timeout`, etc.) are passed through untouched. Internally, `authorizedFetch` uses `output: 'complete'` to read response headers, then returns only the body by default. If the caller passes `output: 'complete'`, they get the full `{ status, headers, body }` response.

**Automatic Usage Binding Sync:**

After every successful response, `authorizedFetch` reads the `bm-properties` header and updates the `usage` bindings key:

```javascript
// After an API call, bindings are automatically updated:
// usage.credits = { monthly: 5, daily: 2, limit: 100 }
```

This means any `data-wm-bind` elements bound to `usage.*` paths are automatically kept in sync without any manual work. See "Usage Bindings" below.

**⚠️ IMPORTANT: Auth State Requirement**

`authorizedFetch` requires Firebase Auth to have determined the current user's authentication state before being called. On fresh page loads (e.g., OAuth callback pages, deep links), Firebase Auth needs time to restore the session from IndexedDB/localStorage.

**If called before auth state is determined, it will warn: `"No authenticated user found"`**

**Solution:** Wait for auth state before calling `authorizedFetch`:

```javascript
// Wait for auth state to be determined (fires once auth is known)
webManager.auth().listen({ once: true }, async () => {
  // Now safe to use authorizedFetch
  const response = await authorizedFetch(url, options);
});
```

**When this matters:**
- Pages that load and immediately need to make authenticated API calls
- OAuth callback pages (user returns from external auth provider)
- Deep links that require authenticated requests on load

**When NOT needed:**
- User-triggered actions (button clicks, form submissions) — by then auth state is always determined
- Pages that wait for user interaction before making API calls

**Reference:** `src/assets/js/libs/authorized-fetch.js`

### Usage Bindings

Usage data is available in the `usage` bindings key. It is populated from two sources:

1. **On page load (auth settle):** `web-manager` reads `account.usage` from Firestore and resolves plan limits from `config.payment.plans`, then sets `usage` bindings with the merged data.
2. **After API calls:** `authorizedFetch` reads the `bm-properties` response header and merges fresh usage counters + limits into the existing `usage` bindings.

**Bindings structure:**

```javascript
// usage.credits = { monthly: 5, daily: 2, limit: 100 }
// usage.requests = { monthly: 20, limit: 500 }
```

**HTML usage:**

```html
<!-- Show usage counter: "5/100" -->
<span data-wm-bind="@show usage.credits">
  <span data-wm-bind="usage.credits.monthly">–</span>/<span data-wm-bind="usage.credits.limit">–</span>
</span>
```

**Config requirement:** Plan limits must be defined in `_config.yml` under `web_manager.payment.plans`:

```yaml
web_manager:
  payment:
    plans:
      - id: basic
        limits:
          credits: 100
      - id: premium
        limits:
          credits: 500
```

### Payment Config Library

Reads payment configuration (products, processors, prices, limits) from `webManager.config.payment` — populated from `_config.yml` at build time. **Do NOT fetch `/backend-manager/brand` to get payment data.** It's already available instantly via this library.

**Import:**

```javascript
import { getPaymentConfig, getProcessors, getProducts, getProductById, getProductLimits, getCurrency } from '__main_assets__/js/libs/payment-config.js';
```

**Usage:**

```javascript
// Get all products
const products = getProducts();

// Find a specific product
const product = getProductById('plus');

// Get product limits
const limits = getProductLimits('plus'); // { credits: 500, agents: 3, ... }

// Get processors (stripe, paypal, etc.)
const processors = getProcessors();
```

**Config location in `_config.yml`:**

```yaml
web_manager:
  payment:
    processors:
      stripe:
        publishableKey: pk_live_...
      paypal:
        clientId: ...
    products:
      - id: basic
        name: Basic
        limits:
          credits: 100
      - id: plus
        name: Plus
        limits:
          credits: 500
        prices:
          monthly: 19
          annually: 190
```

**How it works:** The `foot.html` Configuration injection serializes all `web_manager` properties into `window.Configuration`, which `webManager.initialize()` stores in `webManager.config`. The payment config is available immediately — no API call needed.

**When to still use the brand API:**
- `oauth2` provider configuration (used by the connections section on the account page)
- Any data that is NOT in `_config.yml` and only exists server-side

**Reference:** `src/assets/js/libs/payment-config.js`

### Pricing Page: Config-Resolved Values

The pricing layout automatically resolves prices and feature limits from `_config.yml` when not explicitly set in frontmatter. This means consuming projects can define ONLY display metadata (name, tagline, icon, features list) and let prices/limits come from the single source of truth.

**Resolution order (frontmatter wins):**
1. `plan.pricing.monthly` / `plan.pricing.annually` from page frontmatter
2. `site.web_manager.payment.products[matching_id].prices.monthly` / `.annually` from config
3. `0` (default)

**Feature value resolution:**
1. `feature.value` from page frontmatter
2. `site.web_manager.payment.products[matching_id].limits[feature.id]` from config (with `-1` → `"Unlimited"`)

**Example: Minimal pricing.md (prices/limits come from config):**

```yaml
---
layout: blueprint/pricing
permalink: /pricing

pricing:
  plans:
    - id: "basic"
      name: "Basic"
      tagline: "best for getting started"
      url: "/dashboard"
      features:
        - id: "credits"
          name: "Credits"
          icon: "sparkles"
        - id: "agents"
          name: "Agents"
          icon: "robot"
    - id: "plus"
      name: "Plus"
      tagline: "best for small websites"
      features:
        - id: "credits"
          name: "Credits"
          icon: "sparkles"
        - id: "agents"
          name: "Agents"
          icon: "robot"
---
```

In this example, `credits` value of 100 and price of $19/mo come from `_config.yml`'s `web_manager.payment.products` — no hardcoding needed.

### FormManager Library

Lightweight form state management library with built-in validation, state machine, and event system. See also [docs/page-loading.md → Form Protection Standards](page-loading.md#form-protection-standards) for the form-protection layering rules.

**Import:**

```javascript
import { FormManager } from '__main_assets__/js/libs/form-manager.js';
```

**Basic Usage:**

```javascript
const formManager = new FormManager('#my-form', options);

formManager.on('submit', async ({ data, $submitButton }) => {
  const response = await fetch('/api', { body: JSON.stringify(data) });
  if (!response.ok) throw new Error('Failed');
  formManager.showSuccess('Form submitted!');
});
```

**State Machine:**

```
initializing → ready ⇄ submitting → ready (or submitted)
```

**Configuration Options:**

```javascript
{
  autoReady: true,           // Auto-transition to initialState when DOM ready
  initialState: 'ready',     // State after autoReady fires
  allowResubmit: true,       // Allow resubmission after success (false = 'submitted' state)
  resetOnSuccess: false,     // Clear form fields after successful submission
  warnOnUnsavedChanges: true, // Warn user before leaving page with unsaved changes
  submittingText: 'Processing...', // Text shown on submit button during submission
  submittedText: 'Processed!', // Text shown on submit button after success (when allowResubmit: false)
  inputGroup: null           // Filter getData() by data-input-group attribute (null = all fields)
}
```

**Events:**

| Event | Payload | Description |
|-------|---------|-------------|
| `submit` | `{ data, $submitButton }` | Form submission (throw error to show failure) |
| `validation` | `{ data, setError }` | Custom validation before submit |
| `change` | `{ field, name, value, data }` | Field value changed |
| `statechange` | `{ state, previousState }` | State transition |
| `honeypot` | `{ data }` | Honeypot triggered (for spam tracking) |

**Validation System:**

FormManager runs validation automatically before `submit`:
1. **HTML5 validation** — Checks `required`, `minlength`, `maxlength`, `min`, `max`, `pattern`, `type="email"`, `type="url"`
2. **Custom validation** — Use `validation` event for business logic

```javascript
fm.on('validation', ({ data, setError }) => {
  if (data.age && parseInt(data.age) < 18) {
    setError('age', 'You must be 18 or older');
  }
});
```

Errors display with Bootstrap's `is-invalid` class and `.invalid-feedback` elements.

**Autofocus:**

When the form transitions to `ready` state, FormManager automatically focuses the field with the `autofocus` attribute (if present and not disabled).

**Methods:**

| Method | Description |
|--------|-------------|
| `on(event, callback)` | Register event listener (chainable) |
| `ready()` | Transition to ready state |
| `getData()` | Get form data as nested object (supports dot notation, respects input group filter) |
| `setData(obj)` | Set form values from nested object |
| `setInputGroup(group)` | Set input group filter (string, array, or null) |
| `getInputGroup()` | Get current input group filter |
| `showSuccess(msg)` | Show success notification |
| `showError(msg)` | Show error notification |
| `submit()` | Programmatically trigger form submission (fires native submit event) |
| `reset()` | Reset form and go to ready state |
| `isDirty()` | Check if form has unsaved changes |
| `setDirty(bool)` | Set dirty state |
| `clearFieldErrors()` | Clear all field validation errors |
| `throwFieldErrors({ field: msg })` | Set and display field errors, throw error |

**Nested Field Names (Dot Notation):**

Use dot notation in field names for nested data:

```html
<input name="user.address.city" value="NYC">
```

Results in:

```javascript
{ user: { address: { city: 'NYC' } } }
```

**Input Groups:**

Filter `getData()` to only return fields matching a specific group. Fields without `data-input-group` are "global" and always included.

```html
<!-- Global fields (no data-input-group) - always included -->
<input name="settings.theme" value="dark">

<!-- Group-specific fields -->
<input name="options.url" data-input-group="url" value="https://example.com">
<input name="options.ssid" data-input-group="wifi" value="MyWiFi">
<input name="options.password" data-input-group="wifi" value="secret123">
```

```javascript
// Set group filter (accepts string or array)
formManager.setInputGroup('url');           // Single group
formManager.setInputGroup(['url', 'wifi']); // Multiple groups
formManager.setInputGroup(null);            // Clear filter (all fields)

// Get current filter
formManager.getInputGroup(); // Returns ['url'] or null

// getData() respects the filter
formManager.setInputGroup('wifi');
formManager.getData();
// Returns: { settings: { theme: 'dark' }, options: { ssid: 'MyWiFi', password: 'secret123' } }
// Note: 'url' field excluded, global 'settings.theme' included
```

Can also be set via config:

```javascript
const fm = new FormManager('#form', { inputGroup: 'wifi' });
```

**Honeypot (Bot Detection):**

FormManager automatically rejects submissions if a honeypot field is filled. Honeypot fields are hidden from users but bots fill them automatically.

```html
<!-- Hidden from users via CSS -->
<input type="text" name="honey" autocomplete="off" tabindex="-1"
       style="position: absolute; left: -9999px;" aria-hidden="true">
```

Fields matching `[data-honey]` or `[name="honey"]` are:
- Excluded from `getData()` output
- Checked during validation — if filled, submission is rejected with generic error

**Checkbox Handling:**
- **Single checkbox:** Returns `true`/`false`
- **Checkbox group (same name):** Returns object `{ value1: true, value2: false }`

**Multiple Submit Buttons:**

Access the clicked button via `$submitButton`:

```html
<button type="submit" data-action="save">Save</button>
<button type="submit" data-action="draft">Save Draft</button>
```

```javascript
fm.on('submit', async ({ data, $submitButton }) => {
  const action = $submitButton?.dataset?.action; // 'save' or 'draft'
});
```

**Reference:** `src/assets/js/libs/form-manager.js`
**Test Page:** `src/assets/js/pages/test/libraries/form-manager/index.js`
**Example:** `src/assets/js/pages/contact/index.js`
