// validateYAMLFrontMatter pure helper from src/gulp/tasks/utils/_validate-yaml.js.
// Used by audit to verify _posts / _layouts have valid frontmatter before Jekyll
// chokes on them with cryptic errors. We test the pure function via a temp file.

const path = require('path');
const fs = require('fs');
const os = require('os');

module.exports = {
  layer: 'build',
  description: 'validateYAMLFrontMatter (utils/_validate-yaml.js)',
  type: 'group',
  tests: [
    {
      name: 'returns { valid: true } for a file with valid frontmatter',
      run: async (ctx) => {
        const { validateYAMLFrontMatter } = require('../../../gulp/tasks/utils/_validate-yaml.js');
        const tmp = path.join(os.tmpdir(), `ujm-test-valid-${Date.now()}.md`);
        fs.writeFileSync(tmp, '---\ntitle: Hello\nlayout: post\n---\nBody text.', 'utf8');
        try {
          const result = validateYAMLFrontMatter(tmp);
          ctx.expect(result.valid).toBe(true);
        } finally {
          fs.unlinkSync(tmp);
        }
      },
    },
    {
      name: 'returns { valid: true } when no frontmatter present',
      run: async (ctx) => {
        const { validateYAMLFrontMatter } = require('../../../gulp/tasks/utils/_validate-yaml.js');
        const tmp = path.join(os.tmpdir(), `ujm-test-noyaml-${Date.now()}.md`);
        fs.writeFileSync(tmp, 'Just markdown, no frontmatter.\n', 'utf8');
        try {
          const result = validateYAMLFrontMatter(tmp);
          ctx.expect(result.valid).toBe(true);
        } finally {
          fs.unlinkSync(tmp);
        }
      },
    },
    {
      name: 'flags malformed YAML frontmatter as invalid with error message',
      run: async (ctx) => {
        const { validateYAMLFrontMatter } = require('../../../gulp/tasks/utils/_validate-yaml.js');
        const tmp = path.join(os.tmpdir(), `ujm-test-invalid-${Date.now()}.md`);
        // Mismatched quotes — js-yaml will refuse to parse this.
        fs.writeFileSync(tmp, '---\ntitle: "Unclosed\ndescription: foo\n---\nBody.', 'utf8');
        try {
          const result = validateYAMLFrontMatter(tmp);
          ctx.expect(result.valid).toBe(false);
          ctx.expect(typeof result.error).toBe('string');
          ctx.expect(result.file).toBe(tmp);
        } finally {
          fs.unlinkSync(tmp);
        }
      },
    },
  ],
};
