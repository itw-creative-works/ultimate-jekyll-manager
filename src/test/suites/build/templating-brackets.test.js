// UJM templating uses node-powertools' `template()`. Two bracket configs are
// in active use:
//   `{ x }`    — default (used wherever defaults.js / others omit `brackets`)
//   `[ x ]`    — distribute.js theme fallback + template-transform.js
//
// This suite locks in those conventions so a node-powertools upgrade or an
// accidental reconfiguration would fail loudly here rather than silently
// breaking Jekyll output. (Liquid syntax `{{ }}` is handled by Jekyll itself,
// NOT node-powertools — those placeholders pass through node-powertools
// untouched.)

module.exports = {
  layer: 'build',
  description: 'node-powertools templating brackets ({} and [])',
  type: 'group',
  tests: [
    {
      name: 'default { } brackets resolve nested keys',
      run: async (ctx) => {
        const { template } = require('node-powertools');
        const out = template('hello {name.first} {name.last}', {
          name: { first: 'Ian', last: 'Wiedenman' },
        });
        ctx.expect(out).toBe('hello Ian Wiedenman');
      },
    },
    {
      name: '[ ] brackets resolve nested keys when explicitly configured',
      run: async (ctx) => {
        const { template } = require('node-powertools');
        const out = template('themes/[site.theme.id]/file', {
          site: { theme: { id: 'classy' } },
        }, { brackets: ['[', ']'] });
        ctx.expect(out).toBe('themes/classy/file');
      },
    },
    {
      name: '[ ] brackets leave Jekyll {{ }} placeholders alone',
      run: async (ctx) => {
        const { template } = require('node-powertools');
        const out = template('a [x] b {{ x }} c', { x: 'X' }, { brackets: ['[', ']'] });
        ctx.expect(out).toBe('a X b {{ x }} c');
      },
    },
  ],
};
