# SEO — Alternatives Pages & Structured Data

This doc covers two SEO-focused subsystems:

1. **Alternatives Collection** — competitor comparison landing pages.
2. **Schema / Structured Data (JSON-LD)** — `SoftwareApplication` and `FAQPage` JSON-LD blocks.

## Alternatives Collection (SEO Competitor Comparison Pages)

UJ provides an `alternatives` collection for SEO landing pages that target users searching for competitors (e.g., "ExampleApp alternatives"). These pages are entirely frontmatter-driven and designed to convert visitors who are comparing products.

### How It Works

1. The `alternatives` collection is registered in `src/config/_config_default.yml` (UJM-controlled)
2. Each alternative is a markdown file in the consuming project's `_alternatives/` directory
3. The layout chain: `blueprint/alternatives/alternative` → `themes/classy/frontend/pages/alternatives/alternative`
4. An index page at `/alternatives` lists all alternatives automatically
5. **Shared content lives in the layout** — the theme layout provides default testimonials, stats, FAQs, CTA, and why_switch content so competitor pages only need competitor-specific data
6. The layout frontmatter uses `{{ page.resolved.alternative.competitor.name }}` to dynamically insert the competitor name into shared content (e.g., FAQ questions, CTA headlines)

### Creating an Alternative Page

In the consuming project, create `src/_alternatives/competitor-name.md`. Only competitor-specific data is needed — shared sections are inherited from the layout:

```yaml
---
layout: blueprint/alternatives/alternative
sitemap:
  include: true

alternative:
  competitor:
    name: "Competitor Name"
    description: "Brief description of the competitor (shown on /alternatives listing)"
  comparison:
    features:
      - name: "Feature Name"
        icon: "sparkles"
        ours:
          value: true  # or string like "Unlimited"
        theirs:
          value: false  # or string like "Limited"
---
```

That's it! The layout automatically generates:
- Hero with "Brand vs Competitor Name" headline
- Why Switch section with default differentiator items
- Testimonials, Stats, FAQs, and CTA with shared content
- All text dynamically references the competitor name via `{{ page.resolved.alternative.competitor.name }}`

**To override any inherited section**, define it in the competitor's frontmatter — `page.resolved` merge gives page-level values highest priority.

### Available Sections

All sections are **optional** — omit or leave empty to hide. Sections with `(shared)` have default content in the layout:

| Section | Frontmatter Key | Description |
|---------|----------------|-------------|
| Hero | `alternative.hero` | Gradient animated hero with "Brand vs Competitor" headline (shared) |
| Comparison | `alternative.comparison` | Side-by-side feature table — **must be defined per competitor** |
| Why Switch | `alternative.why_switch` | Alternating image/text showcase blocks (shared) |
| Video | `alternative.video` | YouTube embed (default: hidden, set `youtube_id` to show) |
| Testimonials | `alternative.testimonials` | Reuses `testimonial-scroll.html` component (shared) |
| Stats | `alternative.stats` | Social proof numbers with icons (shared) |
| FAQs | `alternative.faqs` | Accordion with switching-related questions (shared) |
| CTA | `alternative.cta` | Final conversion card with buttons (shared) |

### Dynamic Competitor Name in Frontmatter

The layout uses `{{ page.resolved.alternative.competitor.name }}` in its frontmatter defaults to dynamically reference the competitor. This works because the template pipes these values through `| uj_liquify` to resolve Liquid expressions.

**Example:** The layout's default FAQ includes:

```yaml
question: "Can I import my data from {{ page.resolved.alternative.competitor.name }}?"
```

Which renders as "Can I import my data from ExampleApp?" for an ExampleApp competitor page.

### Reference Implementation

- **Minimal competitor page:** `src/defaults/dist/_alternatives/example-competitor.md` — shows the minimum frontmatter needed (competitor name + comparison features)
- **Layout with all defaults:** `src/defaults/dist/_layouts/themes/classy/frontend/pages/alternatives/alternative.html` — contains shared content for all sections

### File Locations

| Purpose | Path |
|---------|------|
| Theme layout (alternative page) | `src/defaults/dist/_layouts/themes/classy/frontend/pages/alternatives/alternative.html` |
| Theme layout (index/listing page) | `src/defaults/dist/_layouts/themes/classy/frontend/pages/alternatives/index.html` |
| Blueprint (alternative) | `src/defaults/dist/_layouts/blueprint/alternatives/alternative.html` |
| Blueprint (index) | `src/defaults/dist/_layouts/blueprint/alternatives/index.html` |
| Default page (index) | `src/defaults/dist/pages/alternatives/index.md` |
| Sample alternative | `src/defaults/dist/_alternatives/example-competitor.md` |
| CSS | `src/assets/css/pages/alternatives/alternative/index.scss` |
| JS | `src/assets/js/pages/alternatives/alternative/index.js` |

## Schema / Structured Data (JSON-LD)

UJ automatically generates JSON-LD structured data in `foot.html`. The SoftwareApplication schema with AggregateRating is opt-in via frontmatter.

### SoftwareApplication Schema

Renders a `SoftwareApplication` JSON-LD block with deterministic aggregate ratings. Enabled by blueprint layouts (index, pricing, download, alternatives/alternative) — consuming projects can override or disable per page.

**How it works:**

1. **`_config.yml`** sets fallback defaults (no `enabled` key — just field defaults like `application_category`, `price`, etc.)
2. **Blueprint layouts** set `schema.software_application.enabled: true` with page-appropriate `features`
3. **Consuming projects** can override any value in their page frontmatter, or disable with `enabled: false`

This follows the standard `page.resolved` merge: page > layout > site.

**Deterministic ratings:** Uses the `uj_hash` filter (from jekyll-uj-powertools) seeded with `site.url` by default, producing stable values across builds:
- Rating: always `4.8` or `4.9` (deterministic per seed)
- Review count: 200,000–999,999 (deterministic per seed)
- Override seed per page with `hash_seed` to get different values

**Blueprint frontmatter example:**

```yaml
### SCHEMA ###
schema:
  software_application:
    enabled: true
    features:
      - "Free to use"
      - "24/7 availability"
      - "User-friendly interface"
```

**Consuming project override example:**

```yaml
schema:
  software_application:
    application_category: "EducationalApplication"
    features:
      - "AI-powered solutions"
      - "24/7 availability"
```

**Consuming project disable example:**

```yaml
schema:
  software_application:
    enabled: false
```

**Available fields:**

| Field | Default | Description |
|-------|---------|-------------|
| `enabled` | (set by blueprint) | Enable/disable the schema block |
| `name` | `site.brand.name` | Application name |
| `description` | `page.resolved.meta.description` | Application description |
| `application_category` | `WebApplication` | Schema.org application category |
| `operating_system` | `Web-based` | Target OS |
| `price` | `0` | Price (string) |
| `price_currency` | `USD` | Currency code |
| `features` | `[]` | Feature list for `featureList` field |
| `hash_seed` | `site.url` | Seed for deterministic rating/count generation |

**File locations:**

| Purpose | Path |
|---------|------|
| Schema block (rendering) | `src/defaults/dist/_includes/core/foot.html` |
| Site-level defaults | `src/defaults/src/_config.yml` (under `schema:`) |
| Blueprint activation | `src/defaults/dist/_layouts/blueprint/{index,pricing,download}.html`, `blueprint/alternatives/alternative.html` |
| Hash filter | `jekyll-uj-powertools/lib/filters/main.rb` (`uj_hash`) |

### FAQPage Schema

Renders a `FAQPage` JSON-LD block for pages with FAQ/accordion sections. Enabled by the alternatives blueprint — consuming projects can also enable it on any page with FAQ content.

**How it works:**

1. **`_config.yml`** sets `faq_page.items: []` as fallback
2. **Blueprint layouts** set `schema.faq_page.enabled: true`
3. **Items source (fallback chain):** `schema.faq_page.items` → `page.resolved.faqs.items` → `page.resolved.alternative.faqs.items`. Pages with generic `faqs.items` (like pricing) and alternatives pages both get FAQPage schema automatically without duplicating content
4. Questions/answers are processed through `uj_liquify` (supports Liquid expressions like competitor names) and `uj_json_escape`

**Blueprint activation:** Enabled by default in `blueprint/pricing.html`, `blueprint/contact.html`, `blueprint/download.html`, `blueprint/extension/index.html`, and `blueprint/alternatives/alternative.html`.

**Consuming project usage — provide items directly:**

```yaml
schema:
  faq_page:
    enabled: true
    items:
      - question: "How do I get started?"
        answer: "Sign up for free and follow the onboarding guide."
      - question: "Is there a free plan?"
        answer: "Yes, our basic plan is completely free."
```

**Available fields:**

| Field | Default | Description |
|-------|---------|-------------|
| `enabled` | (set by blueprint) | Enable/disable the schema block |
| `items` | `[]` | Array of `{question, answer}` objects. Falls back to `alternative.faqs.items` if empty |
