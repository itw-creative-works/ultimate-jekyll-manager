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

Other Ultimate Jekyll Components:
src/assets/css/ultimate-jekyll-manager.scss = Main stylesheet used by Ultimate Jekyll to style the site
src/assets/css/global = Global styles that are used by Ultimate Jekyll
src/assets/css/pages = Page-specific styles that are used by Ultimate Jekyll
* If you are making a page, put the styles in this directory like so: `src/assets/css/pages/[page-name]/index.scss`

src/assets/js/ultimate-jekyll-manager.js = Main JavaScript file used by Ultimate Jekyll to manage the site
src/assets/js/pages = Page-specific JavaScript files that are used by Ultimate Jekyll
* If you are making a page, put the JavaScript in this directory like so: `src/assets/js/pages/[page-name]/index.js`

src/assets/themes = Theme scss and js files that are can be picked and used by the consuming project.

## SOME SPECIAL LIQUID FUNCTIONS:
* uj_content_format = A custom liquid filter that formats the content like so: first, it LIQUIFIES the content, then, if it's a markdown file, it runs MARKDOWNIFY.
* iftruthy = a custom liquid tag that checks if a variable is truthy in JavaScript terms, meaning it checks if the variable is not null, undefined, or an empty string. Use it like this: `{% iftruthy variable %}`. But it DOES NOT SUPPORT any logical operators and does not support `else` statements. But you CAN put sub-statements inside it.
* iffalsy = same but opposite of iftruthy.
* page.resolved = a custom page object property of all site, layout, and page variables deeply merged together, with page variables taking precedence over layout, and layout variables taking precedence over site variables. This allows a system of site defaults, layout overrides, and page-specific overrides.

### Specifics:
* {% uj_icon icon-name, "fa-md" %} = Custom tag for inserting fontawesome icons. "icon-name" can be a string or a variable. If its a string, put it in quotes like "rocket" (dont include "fa-")

## CSS
DO NOT USE `bg-light`, `bg-dark`, `text-light`, or `text-dark`. We support BOTH light and dark mode, so instead use `bg-body`, `bg-body-secondary`, `bg-body-tertiary`, `text-body` and for buttons you can use `btn-adaptive` or `btn-outline-adaptive`.
These classes adapt to light and dark mode automatically.

## Libraries
I have some library preferences that I want you to follow:

### WebManager
We use a custom library called `web-manager` to manage various aspects of the site. Please make yourself familiar with it by reviewing it: `/Users/ian/Developer/Repositories/ITW-Creative-Works/web-manager/src`
It offers various ultities like webManager.auth(), webManager.utilities(), webManager.sentry(), webManager.dom(). You should be using these utilities instead of writing your own code all the time.

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
