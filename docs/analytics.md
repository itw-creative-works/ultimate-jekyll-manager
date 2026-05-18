# Analytics & Tracking

Ultimate Jekyll uses three tracking platforms: Google Analytics (gtag), Facebook Pixel (fbq), and TikTok Pixel (ttq).

## ITM (Internal Tracking Medium)

Internal tracking system modeled after UTM for cross-property user journey tracking.

| Parameter | Purpose | Examples |
|-----------|---------|----------|
| `itm_source` | Platform/origin | `website`, `browser-extension`, `app`, `email` |
| `itm_medium` | Delivery mechanism | `modal`, `prompt`, `banner`, `tooltip` |
| `itm_campaign` | Specific campaign/feature | `exit-popup`, `premium-unlock`, `newsletter-signup` |
| `itm_content` | Specific context | Page path, feature ID, variant |

**Examples:**

```
# Website exit popup
?itm_source=website&itm_medium=modal&itm_campaign=exit-popup&itm_content=/pricing

# Extension premium unlock
?itm_source=browser-extension&itm_medium=prompt&itm_campaign=premium-unlock&itm_content=bulk-export
```

## Tracking Guidelines

**IMPORTANT Rules:**
- Track important user events with `gtag()`, `fbq()`, and `ttq()` functions
- NEVER add conditional checks for tracking functions (e.g., `if (typeof gtag !== 'undefined')`)
- Always assume tracking functions exist — they're globally available or stubbed
- Reference standard events documentation before implementing custom tracking

**Standard Events Documentation:**
- **Google Analytics GA4:** https://developers.google.com/analytics/devguides/collection/ga4/reference/events
- **Facebook Pixel:** https://www.facebook.com/business/help/402791146561655?id=1205376682832142
- **TikTok Pixel:** https://ads.tiktok.com/help/article/standard-events-parameters?redirected=2

## Platform-Specific Requirements

### TikTok Pixel Requirements

TikTok has strict validation requirements:

**Required Parameters:**
- `content_id` — MUST be included in all events

**Valid Content Types:**
- `"product"`
- `"product_group"`
- `"destination"`
- `"hotel"`
- `"flight"`
- `"vehicle"`

Any other content type will generate a validation error.

**Example:**

```javascript
// ✅ CORRECT
ttq.track('ViewContent', {
  content_id: 'product-123',
  content_type: 'product'
});

// ❌ WRONG - Missing content_id
ttq.track('ViewContent', {
  content_type: 'product'
});

// ❌ WRONG - Invalid content_type
ttq.track('ViewContent', {
  content_id: 'product-123',
  content_type: 'custom'  // Not in approved list
});
```

## Tracking Implementation

**IMPORTANT:** Always track events to ALL THREE platforms in this order:
1. Google Analytics (gtag)
2. Facebook Pixel (fbq)
3. TikTok Pixel (ttq)

Track events directly without existence checks. All three tracking calls should be made together for every event.

**Development Mode:**

In development mode, all tracking calls are intercepted and logged to the console for debugging. See `src/assets/js/libs/dev.js` for implementation.
