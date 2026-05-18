# Page Loading Protection System

Ultimate Jekyll prevents race conditions by disabling buttons during JavaScript initialization.

## How It Works

1. HTML element starts with `data-page-loading="true"` and `aria-busy="true"` (`src/defaults/dist/_layouts/core/root.html`)
2. Protected elements are automatically disabled during this state
3. Attributes are removed when JavaScript completes (`src/assets/js/core/complete.js`)

## Protected Elements

- All form buttons (`<button>`, `<input type="submit">`, `<input type="button">`, `<input type="reset">`)
- Elements with `.btn` class (Bootstrap buttons)
- Elements with `.btn-action` class (custom action triggers)

## The `.btn-action` Class

Selectively protect non-standard elements that trigger important actions:

```html
<!-- Protected during page load -->
<a href="/api/delete" class="custom-link btn-action">Delete Item</a>
<div class="card-action btn-action" onclick="processData()">Process</div>

<!-- NOT protected (regular navigation/UI) -->
<a href="/about" class="btn btn-primary">About Us</a>
<button data-bs-toggle="modal">Show Info</button>
```

**Use `.btn-action` for:**
- API calls
- Form submissions
- Data modifications
- Payment processing
- Destructive actions

**Don't use for:**
- Navigation links
- UI toggles (modals, accordions, tabs)
- Harmless interactions

## Implementation

- **CSS:** `src/assets/css/core/utilities.scss` — Disabled styling
- **Click Prevention:** `src/defaults/dist/_includes/core/body.html` — Inline script
- **State Removal:** `src/assets/js/core/complete.js` — Removes loading state

## Form Protection Standards

All JS-managed forms use a layered protection strategy to prevent native form submission before JavaScript takes control:

### Layer 1: `onsubmit="return false"` on ALL JS-managed forms

Every `<form>` that will be managed by FormManager MUST include `onsubmit="return false"`:

```html
<form id="my-form" onsubmit="return false">
```

This is a zero-cost safety net that prevents native form submission if a user clicks submit before FormManager attaches its `e.preventDefault()` handler. FormManager's own submit handling overrides this — there is no conflict.

**Exception:** Traditional forms with an `action` attribute that intentionally navigate (e.g., search forms, external form submissions) should NOT include this.

### Layer 2: Button initial state based on use case

| Use Case | Initial State | Mechanism |
|----------|---------------|-----------|
| Buttons dependent on async data (checkout payment methods) | `hidden` | `data-wm-bind="@show ..."` reveals when data loads |
| Buttons on auth/sensitive forms | `disabled` | FormManager's `ready()` removes `disabled` |
| Buttons on simple forms (contact, newsletter) | Default (visible) | FormManager's `autoReady: true` enables quickly |

### Layer 3: FormManager `autoReady` configuration

| Scenario | `autoReady` | `ready()` call |
|----------|-------------|----------------|
| No async work before form init | `true` (default) | Automatic on DOM ready |
| Async work before form init (API calls, redirects) | `false` | Explicit call after async completes |

**Reference implementations:**
- Simple form: `src/assets/js/pages/contact/index.js`
- Auth form: `src/assets/js/libs/auth.js`
- Async data form: `src/assets/js/pages/payment/checkout/index.js`

See also [docs/javascript-libraries.md → FormManager](javascript-libraries.md#formmanager-library) for the FormManager API itself.
