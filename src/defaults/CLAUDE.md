This is a jekyll site that is "consuming" a jekyll template project called Ultimate Jekyll--a collection of components that can be used to build a Jekyll site quickly and efficiently.

Ultimate Jekyll expects this project to be in the following structure:
/src = Editable files that are compiled to /dist by Ultimate Jekyll
/dist = Compiled files that are copied to _site by Ultimate Jekyll (DO NOT EDIT THESE FILES)
/_site = Compiled files that are served by Jekyll (DO NOT EDIT THESE FILES)

Other files you should NOT edit:
Gemfile = This is managed by Ultimate Jekyll and should not be edited by the user.

Other important folders:
src/pages = This is where we create pages
src/redirects = This is where we create redirects

CSS and JS files:
src/assets/css/pages = This is where we create page-specific stylesheets (src/assets/css/pages/terms/index.scss will load with site.com/terms)
src/assets/js/pages = This is where we create page-specific JavaScript files (src/assets/js/pages/terms/index.js will load with site.com/terms)
src/assets/css/pages/index.scss = Stylesheet for the homepage (site.com/)
src/assets/js/pages/index.js = JavaScript for the homepage (site.com/)

src/assets/css/main.scss = Main stylesheet for the site (all pages will load this file)
src/assets/js/main.js = Main JavaScript file for the site (all pages will load this file)
