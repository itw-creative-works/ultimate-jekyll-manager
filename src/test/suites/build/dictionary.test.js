// The spellcheck dictionary at src/gulp/tasks/utils/dictionary.js. Pure data
// array — verify it loads and is non-empty. Acts as a tripwire: if the file
// is deleted or its export shape changes (e.g. someone wraps it in an object),
// audit.js spellcheck silently degrades. This test catches that early.

module.exports = {
  layer: 'build',
  description: 'spellcheck dictionary (utils/dictionary.js)',
  run: async (ctx) => {
    const dict = require('../../../gulp/tasks/utils/dictionary.js');
    ctx.expect(Array.isArray(dict)).toBe(true);
    ctx.expect(dict.length).toBeGreaterThan(50);
    // Spot-check known entries.
    ctx.expect(dict).toContain('webhook');
    ctx.expect(dict).toContain('api');
  },
};
