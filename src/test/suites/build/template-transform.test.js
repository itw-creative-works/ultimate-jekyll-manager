// createTemplateTransform from src/gulp/tasks/utils/template-transform.js.
// A gulp Transform stream that templatizes file contents using node-powertools'
// `[ ]` bracket syntax. Used by defaults.js and distribute.js theme fallback.
//
// We don't run it through gulp — we synthesize a fake vinyl-like file object
// (with .isDirectory(), .path, .contents, .relative) and push it through the
// stream directly.

module.exports = {
  layer: 'build',
  description: 'createTemplateTransform (utils/template-transform.js)',
  type: 'group',
  tests: [
    {
      name: 'replaces [site.theme.id] with config value in .html files',
      run: async (ctx) => {
        const createTemplateTransform = require('../../../gulp/tasks/utils/template-transform.js');
        const tx = createTemplateTransform({ site: { theme: { id: 'classy' } } });

        const file = {
          path:        '/tmp/test.html',
          relative:    'test.html',
          contents:    Buffer.from('themes/[site.theme.id]/file.html'),
          isDirectory: () => false,
        };

        await new Promise((resolve, reject) => {
          tx.write(file);
          tx.end();
          tx.on('data', (f) => {
            try {
              ctx.expect(f.contents.toString()).toBe('themes/classy/file.html');
              resolve();
            } catch (e) { reject(e); }
          });
          tx.on('error', reject);
        });
      },
    },
    {
      name: 'leaves non-matching extensions untouched (e.g. .css)',
      run: async (ctx) => {
        const createTemplateTransform = require('../../../gulp/tasks/utils/template-transform.js');
        const tx = createTemplateTransform({ site: { theme: { id: 'classy' } } });

        const original = 'a { content: "[site.theme.id]"; }';
        const file = {
          path:        '/tmp/test.css',
          relative:    'test.css',
          contents:    Buffer.from(original),
          isDirectory: () => false,
        };

        await new Promise((resolve, reject) => {
          tx.write(file);
          tx.end();
          tx.on('data', (f) => {
            try {
              ctx.expect(f.contents.toString()).toBe(original);
              resolve();
            } catch (e) { reject(e); }
          });
          tx.on('error', reject);
        });
      },
    },
    {
      name: 'passes directories through untouched',
      run: async (ctx) => {
        const createTemplateTransform = require('../../../gulp/tasks/utils/template-transform.js');
        const tx = createTemplateTransform({ site: {} });

        const file = {
          path:        '/tmp/dir',
          relative:    'dir',
          contents:    null,
          isDirectory: () => true,
        };

        await new Promise((resolve, reject) => {
          tx.write(file);
          tx.end();
          tx.on('data', (f) => {
            try {
              ctx.expect(f.contents).toBeNull();
              resolve();
            } catch (e) { reject(e); }
          });
          tx.on('error', reject);
        });
      },
    },
  ],
};
