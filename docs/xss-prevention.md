# XSS Prevention (ZERO TRUST — MANDATORY)

**TREAT ALL DYNAMIC DATA AS UNTRUSTED.** This is a zero-trust policy: any value that did not come directly from a hardcoded literal in the source file MUST be escaped before being inserted into the DOM via `innerHTML` or attribute interpolation.

This includes — but is not limited to:
- Firestore document fields (user names, emails, IDs, descriptions, etc.)
- API response data
- URL parameters (`location.search`, `URLSearchParams`)
- User input from form fields
- OAuth-provided values (displayName, email from Google/GitHub)
- Any variable whose origin is not a hardcoded source-code constant

## The Rule

```javascript
// ✅ ALWAYS escape dynamic data before innerHTML
$el.innerHTML = `<p>${webManager.utilities().escapeHTML(data.title)}</p>`;
$el.innerHTML = `<a href="${webManager.utilities().escapeHTML(url)}">${webManager.utilities().escapeHTML(label)}</a>`;

// ✅ textContent is always safe — no escaping needed
$el.textContent = data.title;

// ❌ NEVER inject dynamic data raw into innerHTML
$el.innerHTML = `<p>${data.title}</p>`;
$el.innerHTML = `<a href="${url}">${label}</a>`;
```

## NEVER Write Your Own Escape Function

Do NOT create a local `escapeHtml` function or any variant. The ONLY allowed escape method is:

```javascript
webManager.utilities().escapeHTML(str)
```

## When Building DOM Programmatically

Prefer `document.createElement` + `textContent` for plain text nodes — it is inherently safe:

```javascript
const $el = document.createElement('div');
$el.textContent = data.message; // Safe — no escaping needed
```

Only use `innerHTML` when you need actual HTML structure (tags, classes, etc.), and escape every dynamic value in it.

## Even "Safe" Values Must Be Escaped

Even values that *seem* safe (like `Date.toLocaleDateString()` output, numeric calculations, or hardcoded config strings) MUST be escaped when inserted via `innerHTML`. This is defense-in-depth — if the data source ever changes, the escaping is already in place.

```javascript
// ✅ CORRECT — escape even "safe" values in innerHTML
$el.innerHTML = `<small>${webManager.utilities().escapeHTML(formatDate(timestamp))}</small>`;
$el.innerHTML = `<span>${webManager.utilities().escapeHTML(reason)}</span>`;

// ❌ WRONG — assuming the value is safe because it's from a date formatter
$el.innerHTML = `<small>${formatDate(timestamp)}</small>`;
```

## Redirects Must Be Validated

Never redirect to a URL from untrusted sources without validation:

```javascript
// ✅ CORRECT — validate before redirect
const url = urlParams.get('returnUrl');
if (url && webManager.isValidRedirectUrl(url)) {
  window.location.href = url;
}

// ✅ CORRECT — validate API response URLs have safe scheme
if (response.url && /^https?:\/\//i.test(response.url)) {
  window.location.href = response.url;
}

// ❌ WRONG — redirect to unvalidated input
window.location.href = urlParams.get('returnUrl');
```

## postMessage Handlers Must Check Origin

Always validate `event.origin` when handling `window.addEventListener('message', ...)`:

```javascript
// ✅ CORRECT
window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin && event.origin !== 'https://trusted-domain.com') {
    return;
  }
  // handle message
});

// ❌ WRONG — any origin can send messages
window.addEventListener('message', (event) => {
  window.location.href = event.data.url; // attacker-controlled redirect
});
```

## Never Use eval() or new Function()

Do not use `eval()`, `new Function()`, `setTimeout(string)`, or `setInterval(string)`. These execute arbitrary code and violate CSP policies.

## Sanitize Markdown/Rich Text Output

When rendering user-authored markdown or rich text, use DOMPurify to sanitize the output:

```javascript
import DOMPurify from 'dompurify';
const safeHTML = DOMPurify.sanitize(md.render(userContent), {
  ALLOWED_TAGS: ['h1', 'h2', 'h3', 'p', 'br', 'a', 'b', 'strong', 'i', 'em', 'ul', 'ol', 'li', 'img', 'code', 'pre'],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'target', 'rel'],
});
```

## Do NOT Escape Values Passed to textContent-Based APIs

`showNotification()`, `formManager.showSuccess()`, `formManager.showError()`, and `textContent` assignments use safe text insertion internally. Pre-escaping these causes double-encoding (e.g., `We'll` displays as `We&#039;ll`).

```javascript
// ✅ CORRECT — these APIs use textContent internally, so they're already safe
webManager.utilities().showNotification('Thank you! We\'ll be in touch.', 'success');
formManager.showSuccess('Message sent successfully!');

// ❌ WRONG — double-escapes
webManager.utilities().showNotification(webManager.utilities().escapeHTML(message), 'success');
```
