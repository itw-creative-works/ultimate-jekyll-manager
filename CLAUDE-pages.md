CLAUDE

I need help designing the flow of the page/theme/layout system.

src/defaults/src/pages
* These pages are copied over to new sites when they are setup with Ultimate Jekyll so the user can have a site up and running instantly.
* For example, "src/defaults/src/pages/legal/terms.md" is copied to the consuming project so they have a terms of service page ready to go. You can see it uses the layout "blueprint/legal/terms"

src/defaults/dist/_layouts/blueprint/legal/terms.md
* This is the layout file for the terms of service page. It basically just has the ToS text.
* You can see it uses the layout "themes/[ site.theme.id ]/frontend/core/minimal" (id is set in a gulp task)

So: this means that every theme must have a "frontend/core/minimal" layout that can be used for the terms of service page.
* This is a good system but can quickly get out of hand if we need many different layouts.
* For example, I want to make a contact page. Now, we cant do it the same way because we need an actual contact form instead of just text.

Side note: "src/defaults/dist/pages" these pages are copied to the consuming project AS DEFAULTS and anything in the user's project will override the defaults.

My idea is that in the theme frontend folder, we can hve some "base" layouts like "src/defaults/dist/_layouts/themes/bootstrap/frontend/core/minimal.html" and then one for each complex page like "src/defaults/dist/_layouts/themes/bootstrap/frontend/contact.html".
