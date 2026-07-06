// Theme contract — structural invariants every shipped theme must satisfy
// (docs/themes.md conventions turned into executable assertions). Globs the
// theme directories, so a new theme is covered the moment it lands:
//   1. Entry files exist ($avatar-sizes map, shared bootstrap overrides import)
//   2. Layouts are swappable (parent refs use [ site.theme.id ] brackets,
//      no theme-prefixed classes in markup, no inline <script> bodies)
//   3. Cross-theme JS contracts hold (pricing data attributes, blog-post-content)
//   4. Page asset files use a shape the layouts' asset_path frontmatter declares
//      (wrong shape = silent bundle skip)

const path = require('path');
const jetpack = require('fs-jetpack');
const glob = require('glob').globSync;

const ROOT = path.join(__dirname, '../../../..');
const ASSETS = path.join(ROOT, 'src/assets/themes');
const LAYOUTS = path.join(ROOT, 'src/defaults/dist/_layouts/themes');
const INCLUDES = path.join(ROOT, 'src/defaults/dist/_includes/themes');

// _template is held to the asset contract too — it's what theme authors copy.
// bootstrap is the shared Bootstrap source, not a theme.
// The published package ships no src/ (package.json files: assets/bin/dist/docs),
// so in consumer projects this framework-source suite has nothing to assert
// against — it degrades to a single skip (see module.exports) instead of crashing.
const themes = (jetpack.list(ASSETS) || []).filter((t) => t !== 'bootstrap');

// Class tokens that would couple markup to one theme (markup must stay
// swappable; theme prefixes live only in SCSS internals)
const THEME_PREFIXES = ['nf-', 'nb-', 'classy-', 'newsflash-', 'neobrutalism-', 'broadsheet-', 'template-'];

// Markers the framework pricing JS reads — identical across themes by contract
// (see docs/themes.md "Pricing page JS contract")
const PRICING_MARKERS = ['data-plan-id', 'billing-info', 'price-per-unit', 'pricing-promo-banner', 'card-title', 'data-monthly'];

// All markup files (layouts + includes) for a theme
function markupFiles(theme) {
  return [
    ...glob(`${LAYOUTS}/${theme}/**/*.html`),
    ...glob(`${INCLUDES}/${theme}/**/*.html`),
  ];
}

// Inline <script> bodies are banned in theme markup (ld+json and src loaders OK)
function findInlineScript(html) {
  const scripts = html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g);

  for (const [, attrs, body] of scripts) {
    if (attrs.includes('src=')) {
      continue;
    }
    if (attrs.includes('application/ld+json')) {
      continue;
    }
    if (body.trim() === '') {
      continue;
    }

    return body.trim().slice(0, 80);
  }

  return null;
}

// Flat page-asset names declared by ANY theme layout's asset_path frontmatter
// (the fallback means classy's declarations apply to every theme)
function declaredAssetPaths() {
  const paths = new Set();

  for (const file of glob(`${LAYOUTS}/*/**/*.html`)) {
    const match = jetpack.read(file).match(/^asset_path:\s*(\S+)/m);
    if (match) {
      paths.add(match[1].replace(/['"]/g, ''));
    }
  }

  return paths;
}

module.exports = {
  layer: 'build',
  description: 'theme contract (structure, swappability, cross-theme JS contracts)',
  type: 'group',
  tests: themes.length === 0 ? [
    {
      name: 'theme sources present (framework repo only)',
      run: (ctx) => ctx.skip('src/assets/themes is not shipped in the published package — this suite runs in the UJM repo'),
    },
  ] : [
    ...themes.map((theme) => ({
      name: `${theme}: entry files + config contract`,
      run: (ctx) => {
        const config = jetpack.read(`${ASSETS}/${theme}/_config.scss`);
        const entry = jetpack.read(`${ASSETS}/${theme}/_theme.scss`);

        ctx.expect(config).toBeTruthy();
        ctx.expect(entry).toBeTruthy();
        ctx.expect(jetpack.exists(`${ASSETS}/${theme}/_theme.js`)).toBeTruthy();

        // Shared nav/account includes depend on the avatar size map
        ctx.expect(config).toContain('$avatar-sizes');

        // Universal Bootstrap overrides must close the cascade
        ctx.expect(entry).toContain("@import '../bootstrap/overrides'");
      },
    })),

    ...themes.map((theme) => ({
      name: `${theme}: layouts swappable, markup clean`,
      run: (ctx) => {
        for (const file of markupFiles(theme)) {
          const html = jetpack.read(file);
          const rel = path.relative(ROOT, file);

          // Parent layout refs resolve via bracket templating, never a
          // hardcoded theme id (swappability: change theme.id, done)
          const parent = html.match(/^layout:\s*themes\/(.+)$/m);
          if (parent) {
            ctx.expect(`${rel}: ${parent[1]}`).toMatch(/\[\s*site\.theme\.id\s*\]/);
          }

          // No theme-prefixed classes in markup
          for (const [, classes] of html.matchAll(/class="([^"]*)"/g)) {
            for (const token of classes.split(/\s+/)) {
              const prefixed = THEME_PREFIXES.some((p) => token.startsWith(p));
              ctx.expect(prefixed ? `${rel}: class "${token}"` : '').toBeFalsy();
            }
          }

          // No inline script bodies
          const inline = findInlineScript(html);
          ctx.expect(inline ? `${rel}: inline <script> "${inline}"` : null).toBeFalsy();
        }
      },
    })),

    ...themes.map((theme) => ({
      name: `${theme}: cross-theme JS contracts`,
      run: (ctx) => {
        // A theme that ships its own pricing/post layouts must keep the
        // markers the framework JS targets; absent layouts inherit classy's,
        // so the contract holds by definition.
        const pricing = jetpack.read(`${LAYOUTS}/${theme}/frontend/pages/pricing.html`);
        if (pricing) {
          for (const marker of PRICING_MARKERS) {
            ctx.expect(pricing).toContain(marker);
          }
        }

        const post = jetpack.read(`${LAYOUTS}/${theme}/frontend/pages/blog/post.html`);
        if (post) {
          // Load-bearing for ad injection
          ctx.expect(post).toContain('blog-post-content');
        }
      },
    })),

    {
      name: 'page asset files match a declared asset_path shape',
      run: (ctx) => {
        const declared = declaredAssetPaths();

        // Sanity: the derivation itself found the known flat shapes
        ctx.expect(declared.has('blog/post')).toBeTruthy();

        for (const theme of themes) {
          for (const file of glob(`${ASSETS}/${theme}/pages/**/*.{scss,js}`)) {
            const rel = path.relative(`${ASSETS}/${theme}/pages`, file);
            const base = rel.replace(/\.(scss|js)$/, '');

            // index.* shapes resolve by page path; flat shapes must be
            // declared by some layout's asset_path or the bundle never loads
            if (path.basename(base) === 'index') {
              continue;
            }
            ctx.expect(declared.has(base) ? '' : `${theme}/pages/${rel}: no layout declares asset_path "${base}"`).toBeFalsy();
          }
        }
      },
    },
  ],
};
