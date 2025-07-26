I need help designing some pages for Ultimate Jekyll.

Heres some notes
* All pages you design should USE BOOTSTRAP 5.3.1 and be responsive. Use Bootstrap classes for layout and styling
  * Layouts, grids, sectioons, dropdowns, buttons, etc.
* Bootstrap is already included in the project, so you can use its classes directly.
* Avoid using custom CSS unless absolutely necessary.
* Use proper classes for light/dark mode support (avoid bg-light/bg-dark and use classes like bg-body-secondary, bg-body-tertiary, etc.)

Page html location:
* src/defaults/dist/_layouts/themes/bootstrap/frontend/pages/{page}.html
* These pages hoist a layout that includes header and footer so JUST FOCUS ON THE CONTENT OF THE PAGE.

Page JS location:
* src/assets/js/pages/{page}/index.js

Page CSS location:
* src/assets/css/pages/{page}/index.scss
