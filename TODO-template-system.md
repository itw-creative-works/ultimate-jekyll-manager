I have this tempalte system setup so making sites instantly is possible, with the option to further customize each page. It takes advantage of a multi-tier theme system.

Here's an example:

src/defaults/src/pages/legal/terms.md
* This page is autmatically created in the CONSUMING project's pages at pages/legal/terms.md
* You can see it uses "placeholder/legal/terms" layout

src/defaults/dist/_layouts/placeholder/legal/terms.md
* This is the layout used by the page above
* Looking at it, you can see it uses a SECOND layout "themes/[ site.theme.id ]/frontend/default"
* The theme ID is dynamically inserted by the gulp preprocessor as set in _config.yml

src/defaults/dist/_layouts/themes/bootstrap/frontend/default.html
* This is the layout used by the page above (in this example, the bootstrap theme)
* You can see that it includes a nav.html and footer.html as well as the {{ content }} tag (special processing for markdown vs HTML using a custom "page.extension" check)

What i want to do is create some more layouts in the "src/defaults/dist/_layouts/themes/bootstrap/frontend" directory, such as a legal layout, which would be used by terms, privacy, and cookies pages.

Can you help me create the legal layout and do it in a way that doesnt duplicate too much existing code? Can we somehow take advantage of the existing default.html layout?

I want to make even more layouts, such as a "full screen" layout that that would be for pages that want the content to be centered and take up the full width and height of the screen with no header or footer, just the content.













I have this tempalte system setup so making sites instantly is possible, with the option to further customize each page. It takes advantage of a multi-tier theme system.

Here's an example:

src/defaults/src/pages/legal/terms.md
* This page is autmatically created in the CONSUMING project's pages at pages/legal/terms.md
* You can see it uses "placeholder/legal/terms" layout

src/defaults/dist/_layouts/placeholder/legal/terms.md
* This is the layout used by the page above
* Looking at it, you can see it uses a SECOND layout "themes/[ site.theme.id ]/frontend/legal"
* The theme ID is dynamically inserted by the gulp preprocessor as set in _config.yml

src/defaults/dist/_layouts/themes/bootstrap/frontend/legal.html
* Uses "themes/bootstrap/frontend/base"

src/defaults/dist/_layouts/themes/bootstrap/frontend/base.html
* Uses "core/root"

src/defaults/dist/_layouts/core/root.html
* Includes "components" src/defaults/dist/_includes/core/body.html, src/defaults/dist/_includes/core/nav.html, src/defaults/dist/_includes/core/footer.html
* This is the final layout that is used to render the page and includes all the head meta tags styles, scripts, and some body html like modals and warnings that are dynamically displayed.


Each theme should have a central file that the various other theme layouts use, like in this example
* "src/defaults/dist/_layouts/themes/bootstrap/frontend/legal.html" USES "themes/bootstrap/frontend/base.html"

Each theme's central file will always use "core/root.html"
* And this file will always include the components that are used by all themes, like the header, footer, and body.


I need your help naming ALL these things because i feel like my names are not really fitting or consistent. AND ALSO ORGANIZING THEM.

I initially organized the "themes" and "main" layouts in their own folders because this leaves the ability for the user to created layouts that DONT CONFLICT with the ULTIMATE JEKYLL template layouts.

The only requirement is that each "name" is a SINGLE word. I like short descriptive words.

So for example, i feel like "default" and "base" and "global" are all thrown around a lot and not consistent. Very confusing.
