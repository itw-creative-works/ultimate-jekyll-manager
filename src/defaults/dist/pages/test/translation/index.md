---
### ALL PAGES ###
layout: themes/[ site.theme.id ]/frontend/core/minimal
permalink: /test/translation

sitemap:
  include: true

### REGULAR PAGES ###
meta:
  title: "Test Translation Page"
  description: "This is a test Translation page for the Ultimate Jekyll Manager."
  breadcrumb: "Test Translation Page"

web_manager:
  exitPopup:
    enabled: false
---

{% capture brand %}**{{ site.brand.name | liquify }}**{% endcapture %}
{% capture breadcrumb %}{{ page.resolved.meta.breadcrumb | liquify }}{% endcapture %}

### Effective date: <span class="text-primary">8th of April, 2017</span>
<hr>

Welcome to [{{ site.url }}]({{ site.url }}). This website is owned and operated by {{ brand }} ("{{ brand }}", "we", "us", or "our"), a brand that is a part of our parent company, **ITW Creative Works**.

By vising {{ brand }}, you agree to comply.

## Test External URL
- External URL: [https://www.google.com](https://www.google.com)

## Test Internal URL
- Relative URL: [/test-page](/test-page)
- Absolute URL: [{{ site.url }}/test-page]({{ site.url }}/test-page)

## Test Anchor URL
- Anchor URL: [#test-anchor](#test-anchor)
- Blank Anchor URL: [#](#)

## Test Ignored URL
- Account page: [/account](/account)
- Admin page: [/admin](/admin)
- Admin sub-page: [/admin/subpage](/admin/subpage)

## This is an input
<div class="form-group">
  <input type="email" name="slap_honey" class="form-control" placeholder="Your Email">
</div>

## This button has a title
<a href="https://itwcreativeworks.com" class="btn btn-primary" title="Visit ITW Creative Works">Visit ITW Creative Works</a>
