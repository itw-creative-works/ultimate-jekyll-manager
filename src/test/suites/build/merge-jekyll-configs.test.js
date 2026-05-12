// mergeJekyllConfigs from src/gulp/tasks/utils/merge-jekyll-configs.js.
// Critical for Jekyll's --config chain: project's `collections` + `defaults`
// must coexist with UJM's, not silently override. Regression here means
// custom collections vanish at build time.

const path = require('path');
const fs = require('fs');
const os = require('os');

module.exports = {
  layer: 'build',
  description: 'mergeJekyllConfigs (utils/merge-jekyll-configs.js)',
  type: 'group',
  tests: [
    {
      name: 'merges collections from both configs (project additions win)',
      run: async (ctx) => {
        const mergeJekyllConfigs = require('../../../gulp/tasks/utils/merge-jekyll-configs.js');
        const yaml = require('js-yaml');

        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ujm-merge-'));
        const ujmPath = path.join(dir, 'ujm.yml');
        const projPath = path.join(dir, 'proj.yml');
        const outPath = path.join(dir, 'merged.yml');

        fs.writeFileSync(ujmPath, 'collections:\n  posts:\n    output: true\n  team:\n    output: true\n', 'utf8');
        fs.writeFileSync(projPath, 'collections:\n  posts:\n    output: false\n  blog:\n    output: true\n', 'utf8');

        try {
          const result = mergeJekyllConfigs(ujmPath, projPath, outPath, { log: () => {} });
          ctx.expect(result).toBe(outPath);
          const merged = yaml.load(fs.readFileSync(outPath, 'utf8'));
          ctx.expect(merged.collections.team.output).toBe(true);   // UJM-only retained
          ctx.expect(merged.collections.blog.output).toBe(true);   // project addition
          ctx.expect(merged.collections.posts.output).toBe(false); // project wins on conflict
        } finally {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      },
    },
    {
      name: 'dedups defaults by scope key (project wins)',
      run: async (ctx) => {
        const mergeJekyllConfigs = require('../../../gulp/tasks/utils/merge-jekyll-configs.js');
        const yaml = require('js-yaml');

        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ujm-merge-'));
        const ujmPath = path.join(dir, 'ujm.yml');
        const projPath = path.join(dir, 'proj.yml');
        const outPath = path.join(dir, 'merged.yml');

        fs.writeFileSync(ujmPath, `defaults:
  - scope: { path: "dist/pages", type: "draft" }
    values: { layout: "ujm-layout" }
  - scope: { path: "dist/blog", type: "posts" }
    values: { layout: "blog" }
`, 'utf8');
        fs.writeFileSync(projPath, `defaults:
  - scope: { path: "dist/pages", type: "draft" }
    values: { layout: "project-layout" }
`, 'utf8');

        try {
          mergeJekyllConfigs(ujmPath, projPath, outPath, { log: () => {} });
          const merged = yaml.load(fs.readFileSync(outPath, 'utf8'));
          const draft = merged.defaults.find((d) => d.scope.path === 'dist/pages' && d.scope.type === 'draft');
          const blog  = merged.defaults.find((d) => d.scope.path === 'dist/blog');
          ctx.expect(draft.values.layout).toBe('project-layout');  // project wins
          ctx.expect(blog.values.layout).toBe('blog');             // UJM-only retained
        } finally {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      },
    },
    {
      name: 'returns null when there is nothing to merge',
      run: async (ctx) => {
        const mergeJekyllConfigs = require('../../../gulp/tasks/utils/merge-jekyll-configs.js');
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ujm-merge-'));
        const ujmPath = path.join(dir, 'ujm.yml');
        const projPath = path.join(dir, 'proj.yml');
        const outPath = path.join(dir, 'merged.yml');
        fs.writeFileSync(ujmPath, '# no collections or defaults\n', 'utf8');
        fs.writeFileSync(projPath, '# also empty\n', 'utf8');
        try {
          const result = mergeJekyllConfigs(ujmPath, projPath, outPath, { log: () => {} });
          ctx.expect(result).toBeNull();
          ctx.expect(fs.existsSync(outPath)).toBe(false);
        } finally {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      },
    },
  ],
};
