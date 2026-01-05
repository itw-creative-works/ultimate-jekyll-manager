// Libraries
const Manager = new (require('../../build.js'));
const logger = Manager.logger('distribute');
const { src, dest, watch, series } = require('gulp');
const through2 = require('through2');
const path = require('path');
const jetpack = require('fs-jetpack');
const { template } = require('node-powertools');
const createTemplateTransform = require('./utils/template-transform');

// Load package
const package = Manager.getPackage('main');
const project = Manager.getPackage('project');
const config = Manager.getConfig('project');
const rootPathPackage = Manager.getRootPath('main');
const rootPathProject = Manager.getRootPath('project');

// Constants
const LOUD = process.env.UJ_LOUD_LOGS === 'true';
const FALLBACK_THEME = 'classy';

// Glob
const input = [
  // Files to include
  'src/**/*',

  // Files to exclude
  // Images handled by imagemin
  '!src/**/*.{jpg,jpeg,png,gif,svg,webp}',
  // JS files handled by webpack
  '!src/**/*.js',
  // CSS/SCSS files handled by sass task
  '!src/**/*.{css,scss,sass}',
  // Exlcude .DS_Store files
  '!**/.DS_Store',
  // Exclude any temp files
];
const output = 'dist';
const delay = 250;

// Index
let index = -1;

// Main task
function distribute() {
  return new Promise(async function(resolve, reject) {
    // Increment index
    index++;

    // Log
    logger.log('Starting...');
    Manager.logMemory(logger, 'Start');

    // Complete
    return src(input, {
      base: 'src',
      dot: true,
      encoding: false
    })
      .pipe(customTransform())
      .pipe(createTemplateTransform({site: config}))
      .pipe(dest(output, { encoding: false }))
      .on('finish', () => {
        // Copy missing theme files (layouts and includes) from classy fallback
        copyFallbackThemeFiles();

        // Log
        logger.log('Finished!');

        // Complete
        return resolve();
      });
  });
}

/**
 * Copy missing theme files (layouts and includes) from classy to current theme
 * This ensures all themes have access to default files without needing to create them
 */
function copyFallbackThemeFiles() {
  const currentTheme = config.theme?.id;

  // Skip if no theme or already using classy
  if (!currentTheme || currentTheme === FALLBACK_THEME) {
    return;
  }

  // Define folders to check for fallback (both _layouts and _includes)
  const folders = [
    { type: '_layouts', srcFolder: 'src/_layouts/themes', distFolder: 'dist/_layouts/themes' },
    { type: '_includes', srcFolder: 'src/_includes/themes', distFolder: 'dist/_includes/themes' },
  ];

  let totalCopied = 0;

  for (const folder of folders) {
    // Paths to check for classy files
    const classyInPackage = path.join(rootPathPackage, `dist/defaults/${folder.distFolder}`, FALLBACK_THEME);
    const classyInProject = path.join(rootPathProject, folder.distFolder, FALLBACK_THEME);

    // Target path for current theme
    const targetThemeFolder = path.join(rootPathProject, folder.distFolder, currentTheme);

    // Get all classy files from both locations
    const classyFiles = [
      ...getFilesRecursive(classyInPackage),
      ...getFilesRecursive(classyInProject),
    ];

    for (const classyFile of classyFiles) {
      // Get relative path from classy theme folder
      const relativePath = classyFile.includes(classyInPackage)
        ? path.relative(classyInPackage, classyFile)
        : path.relative(classyInProject, classyFile);

      // Target path in current theme
      const targetPath = path.join(targetThemeFolder, relativePath);

      // Check if file already exists in current theme (in src or dist)
      const existsInSrc = jetpack.exists(path.join(rootPathProject, folder.srcFolder, currentTheme, relativePath));
      const existsInDist = jetpack.exists(targetPath);

      // Skip if already exists
      if (existsInSrc || existsInDist) {
        continue;
      }

      // Read the file content and replace theme references with current theme
      let content = jetpack.read(classyFile);

      // Replace hardcoded classy references
      content = content.replace(
        new RegExp(`themes/${FALLBACK_THEME}/`, 'g'),
        `themes/${currentTheme}/`
      );

      // Replace template variable references (e.g., [ site.theme.id ])
      content = template(content, { site: config }, { brackets: ['[', ']'] });

      // Write the transformed content to the target path
      jetpack.write(targetPath, content);
      totalCopied++;

      if (LOUD) {
        logger.log(`  Fallback ${folder.type}: themes/${FALLBACK_THEME}/${relativePath} -> themes/${currentTheme}/${relativePath}`);
      }
    }
  }

  if (totalCopied > 0) {
    logger.log(`Copied ${totalCopied} fallback files from '${FALLBACK_THEME}' to '${currentTheme}' theme`);
  }
}

/**
 * Recursively get all files in a directory
 */
function getFilesRecursive(dir) {
  if (!jetpack.exists(dir)) {
    return [];
  }

  const files = [];
  const items = jetpack.list(dir) || [];

  for (const item of items) {
    const itemPath = path.join(dir, item);
    const stat = jetpack.inspect(itemPath);

    if (stat?.type === 'dir') {
      files.push(...getFilesRecursive(itemPath));
    } else if (stat?.type === 'file') {
      files.push(itemPath);
    }
  }

  return files;
}

function customTransform() {
  return through2.obj(function (file, _, callback) {
    // Skip if it's a directory
    if (file.isDirectory()) {
      return callback(null, file);
    }

    // Get relative path from src base
    const relativePath = path.relative(file.base, file.path).replace(/\\/g, '/');

    // Log
    if (LOUD) {
      logger.log(`Processing file: ${relativePath}`);
    }

    // Change path if it starts with 'pages/'
    // if (relativePath.startsWith('pages/')) {
    //   // Remove 'pages/' prefix
    //   const newRelativePath = relativePath.replace(/^pages\//, '');

    //   // Update file path to remove pages directory
    //   // This will make src/pages/index.html -> dist/index.html
    //   file.path = path.join(file.base, newRelativePath);

    //   // Log
    //   logger.log(`  -> Moving from pages/ to root: ${newRelativePath}`);
    // }

    // Push the file
    this.push(file);

    // Continue
    callback();
  });
}

// Watcher task
function distributeWatcher(complete) {
  // Quit if in build mode
  if (Manager.isBuildMode()) {
    logger.log('[watcher] Skipping watcher in build mode');
    return complete();
  }

  // Log
  logger.log('[watcher] Watching for changes...');

  // Watch for changes
  watch(input, { delay: delay, dot: true }, distribute)
  .on('change', (path) => {
    logger.log(`[watcher] File changed (${path})`);
  });

  // Complete
  return complete();
}

// Default Task
module.exports = series(
  // Manager.wrapTask('distribute', distribute),
  distribute,
  distributeWatcher
);
