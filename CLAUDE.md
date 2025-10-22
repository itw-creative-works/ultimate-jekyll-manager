# Identity
This is Ultimate Jekyll, it is a template project that other "consuming" projects can use to build a Jekyll site. It comes installed as an NPM module and is helpful for setting up, configuring, and maintaining a Jekyll site with best practices in mind.

It is not a stand-alone project, but rather a collection of components that can be used to build a Jekyll site quickly and efficiently.
* You cannot use `npm start` or `npm run build` in this project.

## Structure
Ultimate Jekll has the following structure:
src/gulp/tasks = Gulp tasks that are used to build the Jekyll site.
src/defaults/src = Default source files that can be used as a starting point for a Jekyll site and ARE meant to be edited by the user. They are copied to the consuming project's "src" directory.
src/defaults/dist = Default distribution files that can be used as a starting point for a Jekyll site and NOT meant to be edited by the user. They are copied to the consuming project's "dist" directory.

The "consuming" project has the following structure:
"src" = Compiled to "dist" with npm
"dist" = Compiled to "_site" with Jekyll.

## Local Development
When working with a consuming project, the local development server URL can be found in the `.temp/_config_browsersync.yml` file in the consuming project's root directory. You should read this file to determine the correct local URL for browsing and testing the site.

Other Ultimate Jekyll Components:
src/assets/css/ultimate-jekyll-manager.scss = Main stylesheet used by Ultimate Jekyll to style the site
src/assets/css/global = Global styles that are used by Ultimate Jekyll
src/assets/css/pages = Page-specific styles that are used by Ultimate Jekyll
* If you are making a page, put the styles in this directory like so: `src/assets/css/pages/[page-name]/index.scss`

src/assets/js/ultimate-jekyll-manager.js = Main JavaScript file used by Ultimate Jekyll to manage the site
src/assets/js/pages = Page-specific JavaScript files that are used by Ultimate Jekyll
* If you are making a page, put the JavaScript in this directory like so: `src/assets/js/pages/[page-name]/index.js`

src/assets/themes = Theme scss and js files that are can be picked and used by the consuming project.

## UJ Powertools
Ultimate Jekyll uses the `jekyll-uj-powertools` gem which provides many custom Liquid filters, tags, and variables. You should review the full documentation to understand all available tools: `/Users/ian/Developer/Repositories/ITW-Creative-works/jekyll-uj-powertools/README.md`

Key features include:
* **Filters**: `uj_strip_ads`, `uj_json_escape`, `uj_title_case`, `uj_content_format`
* **Tags**: `iftruthy`, `iffalsy`, `uj_icon`, `uj_logo`, `uj_image`, `uj_member`, `uj_post`, `uj_readtime`, `uj_social`, `uj_translation_url`, `uj_fake_comments`, `uj_language`
* **Global Variables**: `site.uj.cache_breaker`
* **Page Variables**: `page.random_id`, `page.extension`, `page.layout_data`, `page.resolved`

ALWAYS check the README before assuming a filter or tag exists or how it works.

## SOME SPECIAL LIQUID FUNCTIONS:
* uj_content_format = A custom liquid filter that formats the content like so: first, it LIQUIFIES the content, then, if it's a markdown file, it runs MARKDOWNIFY.
* iftruthy = a custom liquid tag that checks if a variable is truthy in JavaScript terms, meaning it checks if the variable is not null, undefined, or an empty string. Use it like this: `{% iftruthy variable %}`. But it DOES NOT SUPPORT any logical operators and does not support `else` statements. But you CAN put sub-statements inside it.
* iffalsy = same but opposite of iftruthy.
* page.resolved = a custom page object property of all site, layout, and page variables deeply merged together, with page variables taking precedence over layout, and layout variables taking precedence over site variables. This allows a system of site defaults, layout overrides, and page-specific overrides.

### Specifics:
* {% uj_icon icon-name, "fa-md" %} = Custom tag for inserting fontawesome icons. "icon-name" can be a string or a variable. If its a string, put it in quotes like "rocket" (dont include "fa-")
* Set `asset_path: path/to/asset` for layouts or pages to override the default page-specific CSS/JS path. When set, it uses `/assets/css/pages/{{ asset_path }}.bundle.css` instead of deriving the path from `page.canonical.path`. Useful when multiple pages share the same assets like all blog posts using `asset_path: blog/post`.

## Layouts and Pages in Consuming Projects
When creating pages in the consuming project, follow these guidelines:
* **One-off pages** (like `/categories`, `/sitemap`, etc.) should be created directly as pages (e.g., `pages/categories.html`) WITHOUT their own custom layout. These pages should use an existing layout.
* **Repeating page types** (like individual category pages, individual blog posts, etc.) should have a dedicated layout that all instances use (e.g., `_layouts/category.html` used by all category pages).
* **All layouts and pages** must eventually require one of the theme entry points, such as `layout: themes/[ site.theme.id ]/frontend/core/base`. This ensures consistent theming across the site.
  * YES, the "[[ site.theme.id ]]" syntax is correct here; it allows dynamic selection of the theme based on site configuration.
* This approach keeps the codebase maintainable by reusing layouts for similar pages while avoiding unnecessary layout files for unique pages.
* So you should put assets like CSS and JS for a one-off page like `categories.html` in `src/assets/css/pages/categories/index.scss` and `src/assets/js/pages/categories/index.js` respectively, and for repeating page types like an individual category that uses a LAYOUT, put them in `src/assets/css/pages/categories/category.scss` and `src/assets/js/pages/categories/category.js` (and you will of course set the `asset_path: categories/category` frontmatter variable on the layout so that the correct assets are loaded).

## CSS
DO NOT USE `bg-light`, `bg-dark`, `text-light`, or `text-dark`. We support BOTH light and dark mode, so instead use `bg-body`, `bg-body-secondary`, `bg-body-tertiary`, `text-body` and for buttons you can use `btn-adaptive` or `btn-outline-adaptive`.
These classes adapt to light and dark mode automatically.

## Lazy Loading
Ultimate Jekyll uses a custom lazy loading system powered by web-manager. Elements can be lazy-loaded using the `data-lazy` attribute with the following format:

```html
data-lazy="@type value"
```

### Supported Types:
* `@src` - Lazy load the `src` attribute (for images, iframes, videos, source elements)
  ```html
  <img data-lazy="@src /assets/images/hero.jpg" alt="Hero">
  <iframe data-lazy="@src https://example.com/embed"></iframe>
  ```

* `@srcset` - Lazy load the `srcset` attribute (for responsive images)
  ```html
  <img data-lazy="@srcset /img/small.jpg 480w, /img/large.jpg 1024w">
  ```

* `@bg` - Lazy load background images via `background-image` CSS
  ```html
  <div data-lazy="@bg /assets/images/background.jpg"></div>
  ```

* `@class` - Lazy add CSS classes when element comes into view (useful for animations)
  ```html
  <div data-lazy="@class animation-fade-in">Content</div>
  ```

* `@html` - Lazy inject HTML content
  ```html
  <div data-lazy="@html <p>Lazy loaded content</p>"></div>
  ```

* `@script` - Lazy load external scripts with JSON configuration
  ```html
  <div data-lazy='@script {"src": "https://example.com/widget.js", "attributes": {"async": true}}'></div>
  ```

### Features:
* Automatically adds cache busters to URLs using `buildTime`
* Uses IntersectionObserver for performance (starts loading 50px before element enters viewport)
* Adds CSS classes during loading states: `lazy-loading`, `lazy-loaded`, `lazy-error`
* Handles video/audio sources intelligently by observing the parent element
* Automatically re-scans DOM for dynamically added elements

See implementation: [src/assets/js/core/lazy-loading.js](src/assets/js/core/lazy-loading.js)

## Libraries
I have some library preferences that I want you to follow:

### WebManager
We use a custom library called `web-manager` to manage various aspects of the site. Please make yourself familiar with it by reviewing it: `/Users/ian/Developer/Repositories/ITW-Creative-Works/web-manager/src`
It offers various ultities like webManager.auth(), webManager.utilities(), webManager.sentry(), webManager.dom(). You should be using these utilities instead of writing your own code all the time.
DO NOT JUST ASSUME THAT webManager has a function, though, you should CHECK THE SOURCE CODE to see what functions are available and how to use them or check the README: `/Users/ian/Developer/Repositories/ITW-Creative-Works/web-manager/README.md`

## FormManager
We use a custom library called `form-manager` to manage forms on the site. Please make yourself familiar with it by reviewing it: `/Users/ian/Developer/Repositories/ITW-Creative-Works/ultimate-jekyll-manager/src/assets/js/libs/form-manager.js`
* A good example of how to use it is the contact page
  * HTML: `/Users/ian/Developer/Repositories/ITW-Creative-Works/ultimate-jekyll-manager/src/defaults/dist/_layouts/themes/classy/frontend/pages/contact.html`
  * JS: `/Users/ian/Developer/Repositories/ITW-Creative-Works/ultimate-jekyll-manager/src/assets/js/pages/contact/index.js`

## Audits
I may ask you to help me fix problems identified by the AUDIT TASK (@src/gulp/tasks/audit.js)
* In that case, please LOOK AT THE AUDIT FILES (Which I will provide the location to) and help me fix the issues ONE BY ONE.
* Make a TODO list for each category in the audit, then read the ENTIRE AUDIT file and make a plan for what items in that category need to be fixed.
* Remember, these are BIG AUDIT FILES, so you will have to tackle them in parts. DO NOT TRY TO FIX EVERYTHING AT ONCE.
