// Libraries
const Manager = new (require('../../build.js'));
const logger = Manager.logger('json-to-html');
const { src, dest, watch, series } = require('gulp');
const through2 = require('through2');
const path = require('path');
const jetpack = require('fs-jetpack');
const { template } = require('node-powertools');
const JSON5 = require('json5');

// Load package
const package = Manager.getPackage('main');
const project = Manager.getPackage('project');
const config = Manager.getConfig('project');
const rootPathPackage = Manager.getRootPath('main');
const rootPathProject = Manager.getRootPath('project');

// Constants
const INCLUDE_TEMPLATE = `
  {% assign data = site.data.{ dataPath } %}
  {% include { templatePath } data=data %}
`;

// Glob
const input = [
  // Main JSON files
  'dist/_includes/**/*.json',

  // Project JSON files
  'src/_includes/**/*.json',
];
const output = 'dist/_includes';
const dataOutput = 'dist/_data/_includes';
const delay = 250;
const compiled = {};

// JSON to HTML Task
function jsonToHtml(complete) {
  // Log
  logger.log('Starting...');
  Manager.logMemory(logger, 'Start');

  // First, copy JSON files to _data directory
  const jsonCopy = src(input)
    .pipe(through2.obj(function (file, _, callback) {
      if (file.isDirectory()) {
        return callback(null, file);
      }

      try {
        // Parse JSON5 content
        const json5Content = file.contents.toString();
        const parsedData = JSON5.parse(json5Content);

        // Convert to regular JSON (pretty printed for readability)
        const regularJson = JSON.stringify(parsedData, null, 2);

        // Also write to _data directory for Jekyll to pick up
        const relativePath = path.relative(file.base, file.path);
        const dataPath = path.join(dataOutput, relativePath);
        const dataDir = path.dirname(dataPath);

        // Ensure directory exists
        jetpack.dir(dataDir);

        // Write regular JSON file to _data
        jetpack.write(dataPath, regularJson);

        // Track compiled files
        compiled[dataPath] = true;

        // Update file contents with regular JSON
        file.contents = Buffer.from(regularJson);

        callback(null, file);
      } catch (err) {
        logger.error(`Error parsing JSON5 file ${file.path}: ${err.message}`);
        callback(err);
      }
    }))
    .pipe(dest(dataOutput));

  // Then create HTML wrapper files
  const htmlGeneration = src(input)
    .pipe(through2.obj(function (file, _, callback) {
      // Skip if it's a directory
      if (file.isDirectory()) {
        return callback(null, file);
      }

      // Get relative path from src/_includes
      const relativePath = path.relative(file.base, file.path);
      const relativeDir = path.dirname(relativePath);
      const basename = path.basename(file.path, '.json');

      // Convert path for Jekyll data reference
      // _includes/frontend/sections/nav.json -> _includes.frontend.sections.nav
      const dataPath = '_includes.' + relativePath
        .replace(/\\/g, '/')
        .replace('.json', '')
        .split('/')
        .join('.');

      // Determine the template path
      // Look for corresponding template in themes/{theme}/{target}/...
      const templatePath = `themes/${config.theme.id}/${relativeDir}/${basename}.html`;

      // Create the HTML content
      const htmlContent = template(INCLUDE_TEMPLATE, {
        dataPath: dataPath,
        templatePath: templatePath
      });

      // Update file contents and extension
      file.contents = Buffer.from(htmlContent);
      file.path = file.path.replace('.json', '.html');

      // Log transformation
      logger.log(`Converting: ${relativePath} -> ${path.basename(file.path)}`);
      logger.log(`  Data path: site.data.${dataPath}`);
      logger.log(`  Template: ${templatePath}`);

      // Track the full output path
      const fullPath = path.resolve(output, path.relative(file.base, file.path));
      compiled[fullPath] = true;

      // Continue
      callback(null, file);
    }))
    .pipe(dest(output));

  // Wait for both streams to complete
  return Promise.all([
    new Promise((resolve) => jsonCopy.on('finish', resolve)),
    new Promise((resolve) => htmlGeneration.on('finish', resolve))
  ]).then(() => {
    // Log
    logger.log('Finished!');

    // Trigger rebuild
    Manager.triggerRebuild(compiled);

    // Complete
    return complete();
  });
}

// Watcher Task
function jsonToHtmlWatcher(complete) {
  // Quit if in build mode
  if (Manager.isBuildMode()) {
    logger.log('[watcher] Skipping watcher in build mode');
    return complete();
  }

  // Log
  logger.log('[watcher] Watching for changes...');

  // Watch for changes
  watch(input, { delay: delay, dot: true }, jsonToHtml)
  .on('change', (path) => {
    logger.log(`[watcher] File changed (${path})`);
  });

  // Complete
  return complete();
}

// Default Task
module.exports = series(
  // Manager.wrapTask('jsonToHtml', jsonToHtml),
  jsonToHtml,
  jsonToHtmlWatcher
);
