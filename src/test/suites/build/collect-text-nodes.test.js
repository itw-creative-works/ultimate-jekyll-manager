// collectTextNodes from src/gulp/tasks/utils/collectTextNodes.js. Used by
// audit (spellcheck) and translation (i18n) to walk an HTML document and
// extract every renderable text node + translatable attribute. If this
// silently degrades, audit reports zero misspellings and translation
// produces empty output — both regressions that pass CI but break consumers.

module.exports = {
  layer: 'build',
  description: 'collectTextNodes (utils/collectTextNodes.js)',
  type: 'group',
  tests: [
    {
      name: 'extracts page title',
      run: async (ctx) => {
        const cheerio = require('cheerio');
        const collectTextNodes = require('../../../gulp/tasks/utils/collectTextNodes.js');
        const $ = cheerio.load('<html><head><title>Hello World</title></head><body><p>Body</p></body></html>');
        const nodes = collectTextNodes($);
        const titleNode = nodes.find((n) => n.text === 'Hello World');
        ctx.expect(titleNode).toBeTruthy();
      },
    },
    {
      name: 'skips <script> and <style>',
      run: async (ctx) => {
        const cheerio = require('cheerio');
        const collectTextNodes = require('../../../gulp/tasks/utils/collectTextNodes.js');
        const $ = cheerio.load('<html><body><script>secret_script_text</script><style>secret_css_text</style><p>visible</p></body></html>');
        const nodes = collectTextNodes($);
        const texts = nodes.map((n) => n.text).filter(Boolean);
        ctx.expect(texts.some((t) => t.includes('visible'))).toBe(true);
        ctx.expect(texts.some((t) => t.includes('secret_script_text'))).toBe(false);
        ctx.expect(texts.some((t) => t.includes('secret_css_text'))).toBe(false);
      },
    },
  ],
};
