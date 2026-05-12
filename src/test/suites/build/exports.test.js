// Verify every entry in package.json#exports is require()-able from the built
// dist/. Catches packaging mistakes where dist/ is missing a file referenced
// from exports (which would explode at consumer install-time).
//
// We resolve relative to dist/test/runner.js — same context the framework
// runs in.

module.exports = {
  layer: 'build',
  description: 'package.json exports resolve to real files in dist/',
  run: async (ctx) => {
    const path = require('path');
    const fs   = require('fs');
    // distRoot is the directory containing this very test file's grandparent
    // → dist/test/suites/build/exports.test.js → ../../../ = dist/.
    const distRoot = path.resolve(__dirname, '..', '..', '..');
    const pkgPath  = path.resolve(distRoot, '..', 'package.json');
    const pkg      = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    ctx.expect(typeof pkg.exports).toBe('object');

    for (const [subpath, target] of Object.entries(pkg.exports)) {
      // target is './dist/<...>.js' — verify the file exists.
      const targetPath = path.resolve(path.dirname(pkgPath), target);
      ctx.expect(fs.existsSync(targetPath)).toBe(true);
    }

    // Spot-check the canonical entry — require() it and verify shape.
    const Manager = require('../../../build.js');
    ctx.expect(typeof Manager).toBe('function');
  },
};
