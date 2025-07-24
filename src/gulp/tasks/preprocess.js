// Libraries
const Manager = new (require('../../build.js'));
const logger = Manager.logger('preprocess');
const { watch, series } = require('gulp');
const glob = require('glob').globSync;
const { template } = require('node-powertools');
const jetpack = require('fs-jetpack');
const path = require('path');

// Load package
const package = Manager.getPackage('main');
const project = Manager.getPackage('project');
const config = Manager.getConfig('project');
const rootPathPackage = Manager.getRootPath('main');
const rootPathProject = Manager.getRootPath('project');

// Glob patterns for files to process
const input = [
  // Files to include
  // 'dist/**/*.{html,md,liquid,json}',
  'dist/pages/**/*.{html,md,liquid,json}',
  'dist/redirects/**/*.{html,md,liquid,json}',

  // Files to exclude
  '!dist/.jekyll-cache/**',
  '!dist/.jekyll-metadata',
];
const output = 'dist';
const delay = 250;

const directoriesToExpand = [
  'pages',
  'redirects',
]

// Preprocessing task
async function preprocess(complete) {
  try {
    logger.log('Starting preprocessing...');

    // Step 1: Process template variables
    await processTemplates();

    // Step 2: Move files from dist/pages and dist/redirects up one level
    await moveDirectoryFilesUp();

    logger.log('Preprocessing finished!');
    return complete();
  } catch (error) {
    logger.error('Error during preprocessing:', error);
    return complete();
  }
}

// Process template variables
async function processTemplates() {
  try {
    logger.log('Processing template variables...');

    // Find all files in dist that might contain templates
    const files = glob('dist/**/*.{html,md,liquid,json}', {
      dot: true,
      ignore: ['dist/.jekyll-cache/**', 'dist/.jekyll-metadata']
    });

    logger.log(`Processing templates in ${files.length} files...`);

    let processedCount = 0;

    // Process each file
    for (const filePath of files) {
      try {
        const contents = jetpack.read(filePath);
        if (!contents) continue;

        // Check if file contains template brackets [site.theme...]
        const templated = template(contents, {
          site: {
            theme: {
              id: config?.theme?.id || 'geeks',
              target: config?.theme?.target || 'frontend',
            },
          },
        }, {
          brackets: ['[', ']'],
        });

        // Write back the templated content
        jetpack.write(filePath, templated);
        logger.log(`Processed templates in: ${filePath}`);
        processedCount++;
      } catch (error) {
        logger.error(`Error processing templates in ${filePath}:`, error);
      }
    }

    logger.log(`Processed templates in ${processedCount} files`);
  } catch (error) {
    logger.error('Error during template processing:', error);
  }
}

// Move files from specified directories up one level
async function moveDirectoryFilesUp() {
  try {
    for (const dirName of directoriesToExpand) {
      const dirPath = `dist/${dirName}`;

      // Check if directory exists
      if (!jetpack.exists(dirPath)) {
        logger.log(`No ${dirPath} directory found, skipping`);
        continue;
      }

      logger.log(`Moving files from ${dirPath} up one level...`);

      // Find all files in the directory
      const files = glob(`${dirPath}/**/*`, {
        dot: true,
        nodir: true
      });

      let movedCount = 0;

      // Move each file
      for (const filePath of files) {
        try {
          // Calculate the relative path within the directory
          const relativePath = path.relative(dirPath, filePath);
          const newPath = path.join('dist', relativePath);

          // Check if destination file already exists
          if (jetpack.exists(newPath)) {
            logger.log(`Skipping ${filePath} - destination already exists: ${newPath}`);
            continue;
          }

          // Ensure destination directory exists
          jetpack.dir(path.dirname(newPath));

          // Move the file
          jetpack.move(filePath, newPath);

          logger.log(`Moved: ${filePath} → ${newPath}`);
          movedCount++;
        } catch (error) {
          logger.error(`Error moving file ${filePath}:`, error);
        }
      }

      // Remove empty directory if it exists
      if (jetpack.exists(dirPath)) {
        jetpack.remove(dirPath);
        logger.log(`Removed empty ${dirPath} directory`);
      }

      logger.log(`Moved ${movedCount} files from ${dirPath}`);
    }
  } catch (error) {
    logger.error('Error during directory file movement:', error);
  }
}

// Watch for changes (but exclude this task from watching to prevent infinite loops)
function preprocessWatcher(complete) {
  // Quit if in build mode
  if (Manager.isBuildMode()) {
    logger.log('[watcher] Skipping watcher in build mode');
    return complete();
  }

  // Log
  logger.log('[watcher] Watching for preprocessing changes...');

  // Watch for changes in all input files (including dist/pages)
  watch(input, { delay: delay, dot: true }, preprocess)
  .on('change', (path) => {
    logger.log(`[watcher] File changed: ${path}`);
  })
  .on('add', (path) => {
    logger.log(`[watcher] File added: ${path}`);
  });

  // Complete
  return complete();
}

// Export task with watcher
module.exports = series(preprocess, preprocessWatcher);
