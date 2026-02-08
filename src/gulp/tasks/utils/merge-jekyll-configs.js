// Libraries
const jetpack = require('fs-jetpack');
const yaml = require('js-yaml');

/**
 * Merges Jekyll collections and defaults from UJM's config with the
 * consuming project's config. Jekyll's --config does a shallow merge
 * of top-level keys, so a project defining its own `collections` would
 * completely override UJM's. This performs a deep merge so both coexist.
 */
function mergeJekyllConfigs(ujmConfigPath, projectConfigPath, outputPath, logger) {
  // Read configs
  const ujmContent = jetpack.read(ujmConfigPath);
  if (!ujmContent) {
    return null;
  }

  const ujmConfig = yaml.load(ujmContent) || {};
  const projectContent = jetpack.read(projectConfigPath);
  const projectConfig = projectContent ? (yaml.load(projectContent) || {}) : {};

  // Extract collections and defaults from both
  const ujmCollections = ujmConfig.collections || {};
  const ujmDefaults = ujmConfig.defaults || [];
  const projectCollections = projectConfig.collections || {};
  const projectDefaults = projectConfig.defaults || [];

  // Nothing to merge
  if (!Object.keys(ujmCollections).length && !ujmDefaults.length) {
    return null;
  }

  const merged = {};

  // Merge collections (object spread: UJM base + project overrides/additions)
  if (Object.keys(ujmCollections).length || Object.keys(projectCollections).length) {
    merged.collections = { ...ujmCollections, ...projectCollections };
  }

  // Merge defaults (concat + dedup by scope key, project wins on conflict)
  if (ujmDefaults.length || projectDefaults.length) {
    const defaultsMap = new Map();

    // UJM defaults first (base)
    for (const entry of ujmDefaults) {
      defaultsMap.set(getDefaultsKey(entry), entry);
    }

    // Project defaults override for same scope
    for (const entry of projectDefaults) {
      defaultsMap.set(getDefaultsKey(entry), entry);
    }

    merged.defaults = Array.from(defaultsMap.values());
  }

  // Write merged config
  const content = `# Auto-generated merged config for collections and defaults\n# DO NOT EDIT - this file is regenerated on every build\n\n${yaml.dump(merged, { lineWidth: -1, noRefs: true })}`;

  jetpack.write(outputPath, content);
  logger.log(`Merged collections config written to ${outputPath}`);

  return outputPath;
}

function getDefaultsKey(entry) {
  const scope = entry.scope || {};
  return `${scope.path || ''}::${scope.type || ''}`;
}

module.exports = mergeJekyllConfigs;
