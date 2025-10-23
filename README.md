<p align="center">
  <a href="https://itwcreativeworks.com">
    <img src="https://cdn.itwcreativeworks.com/assets/itw-creative-works/images/logo/itw-creative-works-brandmark-black-x.svg" width="100px">
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/github/package-json/v/itw-creative-works/ultimate-jekyll-manager.svg">
  <br>
  <img src="https://img.shields.io/librariesio/release/npm/ultimate-jekyll-manager.svg">
  <img src="https://img.shields.io/bundlephobia/min/ultimate-jekyll-manager.svg">
  <img src="https://img.shields.io/codeclimate/maintainability-percentage/itw-creative-works/ultimate-jekyll-manager.svg">
  <img src="https://img.shields.io/npm/dm/ultimate-jekyll-manager.svg">
  <img src="https://img.shields.io/node/v/ultimate-jekyll-manager.svg">
  <img src="https://img.shields.io/website/https/itwcreativeworks.com.svg">
  <img src="https://img.shields.io/github/license/itw-creative-works/ultimate-jekyll-manager.svg">
  <img src="https://img.shields.io/github/contributors/itw-creative-works/ultimate-jekyll-manager.svg">
  <img src="https://img.shields.io/github/last-commit/itw-creative-works/ultimate-jekyll-manager.svg">
  <br>
  <br>
  <a href="https://itwcreativeworks.com">Site</a> | <a href="https://www.npmjs.com/package/ultimate-jekyll-manager">NPM Module</a> | <a href="https://github.com/itw-creative-works/ultimate-jekyll-manager">GitHub Repo</a>
  <br>
  <br>
  <strong>Ultimate Jekyll</strong> is a template that helps you jumpstart your Jekyll sites and is fueled by an intuitive incorporation of npm, gulp, and is fully SEO optimized and blazingly fast.
</p>

## 🦄 Features
* **SEO Optimized**: Ultimate Jekyll is fully SEO optimized.
* **Blazingly Fast**: Ultimate Jekyll is blazingly fast.
* **NPM & Gulp**: Ultimate Jekyll is fueled by an intuitive incorporation of npm and gulp.

## 🚀 Getting started
1. [Create a repo](https://github.com/itw-creative-works/ultimate-jekyll/generate) from the **Ultimate Jekyll** template.
2. Clone the repo to your local machine.
3. Run these commands to get everything setup and sync'd!
```bash
npm install
npx uj setup
npm start
```

## 📦 How to sync with the template
1. Simply run `npm start` in Terminal to get all the latest updates from the **Ultimate Jekyll template** and launch your website in the browser.

## 🌎 Publishing your website
1. Change the `url` in `_config.yml` to your domain.
2. Push your changes to GitHub using `npm run dist` in Terminal.

## ⛳️ Flags
* `--browser=false` - Disables the browser from opening when running `npm start`.
```bash
npm start -- --browser=false
```
* `--debug=true` - Enables logging of extra information when running `npm start`.
```bash
npm start -- --debug=true
```
* `--ujPluginDevMode=true` - Enables the development mode for the [Ultimate Jekyll Ruby plugin](https://github.com/itw-creative-works/jekyll-uj-powertools).
```bash
npm start -- --ujPluginDevMode=true
```

### Other ENV variables
```bash
UJ_PURGECSS=true # Enables PurgeCSS to remove unused CSS (normally only happens in production builds)
```

## Running Specific Tasks
You can run specific tasks using the `npm run gulp` command with the appropriate task name.

Some of these require environment variables to be set and other tasks to be run first.

Here are some examples:

### Run the `audit` task:
```bash
# Run the audit task
npx uj audit

# Run with a Lighthouse URL (defaults to "/" if not provided)
npx uj audit -- --lighthouseUrl="/contact"

# Add autoExit to continue developing and testing AFTER the audit
npx uj audit -- --lighthouseUrl="/contact" --autoExit=false
```

### Run the `translation` task:
```bash
# Test translation with GitHub cache (requires GH_TOKEN and GITHUB_REPOSITORY)
GH_TOKEN=XXX \
GITHUB_REPOSITORY=XXX \
UJ_TRANSLATION_CACHE=true \
npx uj translation

# Test with only 1 file
UJ_TRANSLATION_ONLY="index.html" \
GH_TOKEN=XXX \
GITHUB_REPOSITORY=XXX \
UJ_TRANSLATION_CACHE=true \
npx uj translation
```

### Run the `imagemin` task:
Test image optimization with GitHub cache in development mode:
```bash
# Test with GitHub cache (requires GH_TOKEN and GITHUB_REPOSITORY)
GH_TOKEN=XXX \
GITHUB_REPOSITORY=XXX \
UJ_IMAGEMIN_CACHE=true \
npx uj imagemin

# Or run locally without cache
npx uj imagemin
```
The imagemin task will:
- Process images from `src/assets/images/**/*.{jpg,jpeg,png}`
- Generate multiple sizes (1024px, 425px) and WebP formats
- Cache processed images in `cache-imagemin` branch (when using GitHub cache)
- Skip already processed images on subsequent runs

<!-- Developing -->
## 🛠 Developing
1. Clone the repo to your local machine.
2. Run these commands
```bash
npm install
npm run prepare:watch
```

### Run the `blogify` task:
Create 12 test blog posts in the `_posts` directory with the `blogify` task. This is useful for testing and development purposes.
```bash
npx uj blogify
```

## Page Frontmatter
You can add the following frontmatter to your pages to customize their behavior:

### All pages
```yaml
---
# Layout and Internals
layout: themes/[ site.theme.id ]/frontend/core/minimal # The layout to use for the page, usually 'default' or 'page'
permalink: /path/to/page # The URL path for the page, can be relative

# Control the page's meta tags
meta:
  index: true # Set to false to disable indexing by search engines
  title: 'Page Title' # Custom meta title for the page
  description: 'Page description goes here.' # Custom meta description for the page
  breadcrumb: '' # Custom breadcrumb for the page

# Control the page's theme and layout
theme:
  nav:
    enabled: true # Enable theme's nav on the page
  footer:
    enabled: true # Enable theme's footer on the page
  body:
    class: '' # Add custom classes to the body tag
    main:
      class: '' # Add custom classes to the main tag
  head:
    content: '' # Injected at the end of the head tag
  foot:
    content: '' # Injected at the end of the foot tag (inside <body>)
---
```

### Post pages
```yaml
---
# Post pages
post:
  title: "Post Title" # Custom post title for the page
  description: "Post description goes here." # Custom post description for the page
  author: "author-id" # ID of the author from _data/authors.yml
  id: 1689484669 # Unique ID for the post, used for permalink
---
```

### Team Member pages
```yaml
---
# Team Member pages
member:
  id: "member-id" # ID of the team member from _data/team.yml
  name: "Member Name" # Name of the team member
---
```

### Special Class
`uj-signin-btn`: Automatically handles signin (just add `data-provider="google.com"` to the button)
`uj-signup-btn`: Automatically handles signup (just add `data-provider="google.com"` to the button)

`uj-language-dropdown`:
`uj-language-dropdown-item`

### Utility Classes

#### Max-Width Utilities
Ultimate Jekyll includes max-width utility classes based on Bootstrap's breakpoint sizes. These classes constrain an element's maximum width to match Bootstrap's standard responsive breakpoints:

- `.mw-sm` - Sets max-width to 576px
- `.mw-md` - Sets max-width to 768px
- `.mw-lg` - Sets max-width to 992px
- `.mw-xl` - Sets max-width to 1200px
- `.mw-xxl` - Sets max-width to 1400px

**Usage Examples:**
```html
<!-- Constrain a form to medium width -->
<form class="mw-md">
  <!-- Form content stays readable at max 768px wide -->
</form>

<!-- Limit content width for better readability -->
<div class="container mw-lg">
  <!-- Content won't exceed 992px even on larger screens -->
</div>

<!-- Combine with margin utilities for centering -->
<div class="mw-sm mx-auto">
  <!-- Content is max 576px wide and centered -->
</div>
```

These utilities are particularly useful for:
- Improving readability by preventing text from spanning too wide
- Creating consistent content widths across different sections
- Constraining forms, cards, and modals to reasonable sizes
- Maintaining design consistency with Bootstrap's grid system

### Page Loading Protection System

Ultimate Jekyll includes an automatic protection system that prevents users from clicking buttons before JavaScript is fully loaded, eliminating race conditions and errors.

#### How It Works
1. Pages start with `data-page-loading="true"` on the HTML element
2. Certain buttons are automatically protected from clicks during this state
3. When JavaScript finishes loading, the attribute is removed and buttons become clickable

#### Protected Elements
During page load, these elements are automatically protected:
- All form buttons (`<button>`, `<input type="submit">`, etc.)
- Elements with `.btn` class (Bootstrap buttons)
- Elements with `.btn-action` class (custom action triggers)

#### Using `.btn-action` Class
Add the `.btn-action` class to protect custom elements that trigger important actions:

```html
<!-- These will be protected during page load -->
<a href="/api/delete" class="custom-link btn-action">Delete Item</a>
<div onclick="saveData()" class="btn-action">Save</div>

<!-- Regular navigation links are NOT protected -->
<a href="/about">About Us</a>
<button data-bs-toggle="modal">Show Modal</button>
```

**Use `.btn-action` for:** API calls, form submissions, data modifications, payments, destructive actions
**Don't use for:** Navigation, UI toggles, modals, accordions, harmless interactions

### Special Query Parameters

#### Authentication
* `authReturnUrl`: Redirects to this URL after authentication.

#### Testing Parameters

##### Account Page (`/account`)
* `_test_subscription`: Override subscription data for testing (e.g., `_test_subscription=premium`)
* `_test_prefill=true`: Adds fake test data for development:
  - Inserts fake referral data in the Referrals section
  - Inserts fake session data in the Security section (active sessions)

##### Checkout Page (`/payment/checkout`)
* `_test_appId`: Override the application ID for testing (e.g., `_test_appId=test-app`)
* `_test_trialEligible`: Force trial eligibility status:
  - `_test_trialEligible=true`: User is eligible for trial
  - `_test_trialEligible=false`: User is not eligible for trial
* `_test_cardProcessor`: Force a specific payment processor for testing (e.g., `_test_cardProcessor=stripe` or `_test_cardProcessor=paypal`)

### Icons
* Fontawesome
  * https://fontawesome.com/search
* Flags
  * https://www.freepik.com/icon/england_4720360#fromView=resource_detail&position=1
* More
  * Language
    * https://www.freepik.com/icon/language_484531#fromView=family&page=1&position=0&uuid=651a2f0f-9023-4063-a495-af9a4ef72304

### Webpack
## Dev Flags
Add this to any js file to ONLY run in development mode (it will be excluded in production builds):
```
  /* @dev-only:start */
  {
    // Your development-only code goes here
  }
  /* @dev-only:end */
```

> This project is "ultimate-jekyll", an NPM module that helps   │
│   streamline development of Jekyll websites. A "consuming       │
│   project" will require this NPM module to take advantage of    │
│   its features like automatic folder structure setup, themes,   │
│   and default pages to get a website up and running in          │
│   seconds, while allowing further customization down the line.  │
│   Right now i am struggling on the theme portion of this        │
│   project. I want the user to be able to define the theme in    │
│   their _config.yml (which currently they do by setting         │
│   theme.id). I have some themes from the official bootstrap     │
│   team. usually a theme comes with a frontend, a backend/admin  │
│   dashboard, and docs. these 3 subparts of the theme have       │
│   different html structure and css and js requirements. so i    │
│   need a super easy system that allows me to make a file in     │
│   the consuming project, say its the index.html for example,    │
│   and i should easily be able to put which subseciton (or       │
│   target as i call it) of the theme to use. so for an agency    │
│   website i will probably use the frontend target, while for a  │
│   chat app i will probably use the backend target. however, i   │
│   need to be able to use
