# Project tests

Drop your project test suites here. The framework auto-runs them alongside its own when you run `npx mgr test`.

## Layers

Match the framework's three layers — Ultimate Jekyll Manager's test runner discovers files by the directory they sit in:

| Directory | Runtime | Use for |
|---|---|---|
| `test/build/` | Plain Node | Build-time logic, config validation, pure utilities |
| `test/page/` | Browser page served from a local HTTP server | DOM, frontend Manager, page-specific scripts, `data-wm-bind` directives |
| `test/boot/` | Consumer's actual built `_site/` | End-to-end smoke tests (does the site boot, does the service worker register, do dynamic pages load) |

## Quick example

```js
// test/build/my-feature.test.js
const assert = require('ultimate-jekyll-manager/test/assert');

module.exports = {
  'my feature does the thing': async () => {
    const result = await doTheThing();
    assert.equal(result, 'expected');
  },
};
```

## See also

`node_modules/ultimate-jekyll-manager/docs/test-framework.md` — full reference for the test framework (layers, assert API, fixtures, runner internals).
