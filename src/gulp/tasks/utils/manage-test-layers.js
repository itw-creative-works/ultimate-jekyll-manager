// Test-layer manager (dev only)
// Powers the CONSUMER layer of the /test/libraries/layers asset-cascade panel.
//
// The Consumer dots only go green if the consuming project has its own page files
// at src/assets/{css,js}/pages/test/libraries/layers/index.*. To prove that layer
// live WITHOUT permanently adding files to the consumer, this is OPT-IN via the
// UJ_TEST_LAYERS=true env flag:
//
//   - ALWAYS (every run): remove any previously-generated consumer test-layer files,
//     so they never persist or get committed even if the flag is later unset.
//   - WHEN UJ_TEST_LAYERS=true: (re)generate them into the consumer's src/ at build
//     START — before sass + jekyll run — so the real __project_assets__ / consumer
//     page-CSS path picks them up exactly like any other consumer page file. This is
//     the honest mechanism (no aliases/shims); the files are just real, briefly.
//
// Generated files carry a GENERATED marker so the cleaner only ever deletes its own.
const path = require('path');
const jetpack = require('fs-jetpack');

// Page path the panel lives at → where its consumer-layer assets must sit.
const REL_CSS = 'src/assets/css/pages/test/libraries/layers/index.scss';
const REL_JS = 'src/assets/js/pages/test/libraries/layers/index.js';

const MARKER = 'GENERATED — UJ_TEST_LAYERS';

// NOTE: a consumer page-CSS file shares the SAME output bundle as the framework's
// base page CSS, so it must @use the base (like every real consumer page file) to
// COMPOSE with it rather than replace it. The base lives at the same page path under
// UJM's css/, importable via the SASS loadPaths (which include UJM's dist/assets/css).
const CSS_CONTENT = `// ${MARKER} (auto-removed on the next build; do not commit)
// Consumer layer of the /test/libraries/layers panel → turns the "css-consumer" dot green.
@use 'pages/test/libraries/layers/index' as *;

.layer-dot[data-layer="css-consumer"] {
  background: #30a46c; // green
}
`;

const JS_CONTENT = `// ${MARKER} (auto-removed on the next build; do not commit)
// Consumer layer of the /test/libraries/layers panel → turns the "js-consumer" dot green.
export default ({ manager, options }) => {
  const dot = document.querySelector('.layer-dot[data-layer="js-consumer"]');
  if (dot) {
    dot.style.background = '#30a46c';
  }
  console.log('[test-layer] consumer JS ran → js-consumer dot green');
};
`;

// Delete a generated file only if it still carries our marker (never clobber a real
// consumer file someone legitimately created at this path).
function removeIfGenerated(absPath) {
  if (!jetpack.exists(absPath)) {
    return false;
  }
  const contents = jetpack.read(absPath) || '';
  if (contents.includes(MARKER)) {
    jetpack.remove(absPath);
    // Clean up now-empty generated dirs (best effort)
    jetpack.remove(path.dirname(absPath) + '/.keep'); // no-op if absent
    return true;
  }
  return false;
}

/**
 * Manage the consumer-layer test fixtures (dev only).
 * Always cleans prior generated files; generates fresh ones when UJ_TEST_LAYERS=true.
 * @param {object} Manager - UJM build Manager
 * @param {object} logger - task logger (optional)
 */
function manageTestLayers(Manager, logger) {
  // Never touch anything in a production build
  if (Manager.isBuildMode()) {
    return;
  }

  const cssPath = path.resolve(process.cwd(), REL_CSS);
  const jsPath = path.resolve(process.cwd(), REL_JS);

  // 1) Always clean previously-generated files
  const removed = [removeIfGenerated(cssPath), removeIfGenerated(jsPath)].filter(Boolean).length;

  // 2) Generate when explicitly requested
  const enabled = process.env.UJ_TEST_LAYERS === 'true';
  if (enabled) {
    jetpack.write(cssPath, CSS_CONTENT);
    jetpack.write(jsPath, JS_CONTENT);
    if (logger) {
      logger.log('UJ_TEST_LAYERS: generated consumer test-layer files (auto-removed next run)');
    }
  } else if (removed > 0 && logger) {
    logger.log(`UJ_TEST_LAYERS: cleaned ${removed} stale generated test-layer file(s)`);
  }
}

module.exports = manageTestLayers;
