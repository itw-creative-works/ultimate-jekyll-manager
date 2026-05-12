// The harness ships a single icon in <template id="prerendered-icons">.
// UJM's libs/prerendered-icons.js exposes getPrerenderedIcon(name, classes)
// that pulls SVG from this template. We can't easily import that lib from
// in-tab (it's webpack-bundled ESM), so we reimplement the lookup logic
// inline and assert the template + its data-icon contract.

module.exports = {
  layer: 'page',
  description: 'prerendered icons template lookup',
  type: 'group',
  tests: [
    {
      name: 'template#prerendered-icons exists and has the test icon',
      run: async (ctx) => {
        const tmpl = document.getElementById('prerendered-icons');
        ctx.expect(tmpl).toBeTruthy();
        ctx.expect(tmpl.tagName.toLowerCase()).toBe('template');
        const svg = tmpl.content.querySelector('[data-icon="test"]');
        ctx.expect(svg).toBeTruthy();
        ctx.expect(svg.tagName.toLowerCase()).toBe('svg');
      },
    },
    {
      name: 'looking up a missing icon returns null',
      run: async (ctx) => {
        const tmpl = document.getElementById('prerendered-icons');
        const missing = tmpl.content.querySelector('[data-icon="nope-not-real"]');
        ctx.expect(missing).toBeNull();
      },
    },
  ],
};
