// getFileOptions from src/gulp/tasks/defaults.js — the FILE_MAP rules that decide
// which shipped defaults may overwrite consumer files on `npx mgr setup` reruns.
// Regression here silently clobbers consumer-owned files (test/_init.js was reset
// to the stub on every setup because no rule matched it and the fall-through
// default is overwrite: true).

module.exports = {
  layer: 'build',
  description: 'defaults FILE_MAP (gulp/tasks/defaults.js getFileOptions)',
  type: 'group',
  tests: [
    {
      name: 'consumer-owned seeds are copy-once (test/, hooks/, src/)',
      run: async (ctx) => {
        const { getFileOptions } = require('../../../gulp/tasks/defaults.js');

        // The regression case: consumer fixture hook must survive setup reruns
        ctx.expect(getFileOptions('test/_init.js').overwrite).toBe(false);
        ctx.expect(getFileOptions('test/README.md').overwrite).toBe(false);

        ctx.expect(getFileOptions('hooks/build/pre.js').overwrite).toBe(false);
        ctx.expect(getFileOptions('src/assets/js/main.js').overwrite).toBe(false);
        ctx.expect(getFileOptions('src/service-worker.js').overwrite).toBe(false);
      },
    },
    {
      name: 'framework-owned files always overwrite',
      run: async (ctx) => {
        const { getFileOptions } = require('../../../gulp/tasks/defaults.js');

        const workflow = getFileOptions('.github/workflows/build.yml');
        ctx.expect(workflow.overwrite).toBe(true);
        ctx.expect(!!workflow.template).toBe(true);

        // Last-match-wins: team images override the earlier src/**/* (false) rule
        ctx.expect(getFileOptions('src/assets/images/team/rare-ivy/profile.jpg').overwrite).toBe(true);
      },
    },
    {
      name: 'merge and skip rules resolve as declared',
      run: async (ctx) => {
        const { getFileOptions } = require('../../../gulp/tasks/defaults.js');

        ctx.expect(getFileOptions('CLAUDE.md').mergeLines).toBe(true);

        const config = getFileOptions('config/ultimate-jekyll-manager.json');
        ctx.expect(config.overwrite).toBe(true);
        ctx.expect(config.merge).toBe(true);

        ctx.expect(getFileOptions('test/.DS_Store').skip).toBe(true);

        // Unmatched files fall through to overwrite: true — any new consumer-owned
        // default MUST get an explicit rule or setup will clobber it
        ctx.expect(getFileOptions('dist/robots.txt').overwrite).toBe(true);
        ctx.expect(getFileOptions('dist/robots.txt').rule).toBeNull();
      },
    },
  ],
};
