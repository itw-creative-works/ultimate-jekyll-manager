where could we put a small section about how to use the defualt css classes? some come with bootstrap and some come from our core, and some come from the theme. when building websites, we should be using the premde classes not creating copies of custom classes that do the same thing

Looking at the CLAUDE.md structure, I think the best place for a CSS classes section would be after the "CSS Guidelines" section (which currently only covers Theme-Adaptive Classes). We could expand that section or add a new subsection. Let me check what's currently in the CSS Guidelines section and the surrounding context:
Grep "## CSS Guidelines" (in /Users/ian/Developer/Repositories/ITW-Creative-Works/ultimate-jekyll-manager/CLAUDE.md)
51 lines of output
The CSS Guidelines section is currently small (lines 423-443), focusing only on theme-adaptive classes. I'd recommend expanding this section with a new subsection about class hierarchy and usage. Here's where I'd suggest placing it and what it could contain: Suggested location: After "Theme-Adaptive Classes" (line 443), before "Page Loading Protection System" (line 445) Suggested content:
### CSS Class Hierarchy

When styling elements, always prefer existing classes over creating custom ones. Classes come from three sources (in order of precedence):

**1. Bootstrap Classes (Foundation)**
Use Bootstrap's utility classes for common patterns:
- Spacing: `m-*`, `p-*`, `mt-3`, `px-4`, `gap-2`
- Flexbox: `d-flex`, `justify-content-center`, `align-items-center`
- Grid: `row`, `col-*`, `container`, `container-fluid`
- Text: `text-center`, `fw-bold`, `fs-5`, `text-muted`
- Display: `d-none`, `d-md-block`, `visually-hidden`

**Documentation:** https://getbootstrap.com/docs/5.3/utilities/

**2. UJ Core Classes (Global)**
Located in `src/assets/css/global/` and `src/assets/css/core/`:
- Theme-adaptive: `bg-body`, `btn-adaptive`, `text-body`
- Utilities: (list common ones here)

**3. Theme Classes (Theme-Specific)**
Located in `src/assets/themes/[theme-id]/`:
- Theme-specific components and overrides

### Best Practices

**DO:**
- Search existing classes before creating new ones
- Use Bootstrap utilities for spacing, layout, typography
- Use UJ adaptive classes for theme compatibility

**DON'T:**
- Create `.my-centered-text` when `text-center` exists
- Create `.my-margin-top` when `mt-3` exists
- Duplicate functionality that Bootstrap or UJ already provides
Would you like me to add this section to the CLAUDE.md file? I can also explore the actual CSS files to document the specific UJ core utility classes that are available.
