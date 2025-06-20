// Libraries
const Manager = new (require('../../build.js'));
const logger = Manager.logger('imagemin');
const { src, dest, watch, series } = require('gulp');
const glob = require('glob').globSync;
const responsive = require('gulp-responsive-modern');

// Load package
const package = Manager.getPackage('main');
const project = Manager.getPackage('project');
const rootPathPackage = Manager.getRootPath('main');
const rootPathProject = Manager.getRootPath('project');

// Glob
const input = [
  // Files to include
  'src/assets/images/**/*.{jpg,jpeg,png}',

  // Files to exclude
  // '!dist/**',
];
const output = 'dist/assets/images';
const delay = 250;

// Main task
function imagemin(complete) {
  // Log
  logger.log('Starting...');

  // Use glob to get file count for matching files
  const files = glob(input);

  // If there's no files, complete
  if (files.length === 0) {
    // Log
    logger.log('Found 0 images to process');

    // Complete
    return complete();
  }

  // Log
  logger.log(`Found ${files.length} images to process`, files);

  // Filter out files that already exist in the destination
  // const filesToProcess = files.filter(file => {
  //   const fileName = path.basename(file);
  //   const destFile = path.join(output, fileName);
  //   return !jetpack.exists(destFile);
  // });

  // If there's no files to process, complete
  // if (filesToProcess.length === 0) {
  //   // Log
  //   logger.log('No new images to process');

  //   // Complete
  //   return complete();
  // }

  // Log
  // logger.log(`Processing ${filesToProcess.length} images`, filesToProcess);

  // Process images: resize and convert to webp
  return src(files)
    .pipe(
      responsive({
        '**/*.{jpg,jpeg,png}': [
          // 1024 resized version in original format
          {
            width: 1024,
            rename: { suffix: '-1024px' }
          },
          // 1024 resized webp version
          {
            width: 1024,
            format: 'webp',
            rename: { suffix: '-1024px' }
          },
          // Mobile resized version (e.g., 640px wide) in original format
          {
            width: 425,
            rename: { suffix: '-425px' }
          },
          // Mobile resized webp version
          {
            width: 425,
            format: 'webp',
            rename: { suffix: '-425px' }
          },
          // Original size webp version
          {
            format: 'webp',
            rename: { suffix: '' }
          },
          // Original size in original format
          {
            rename: { suffix: '' }
          }
        ]
      }, {
        quality: 80,
        progressive: true,
        withMetadata: false,
        withoutEnlargement: false,
        skipOnEnlargement: false,
      })
    )
    .pipe(dest(output))
    .on('end', () => {
      // Log
      logger.log('Finished!');

      // Complete
      return complete();
    });
}

// Watcher task
function imageminWatcher(complete) {
  // Quit if in build mode
  if (Manager.isBuildMode()) {
    logger.log('[watcher] Skipping watcher in build mode');
    return complete();
  }

  // Log
  logger.log('[watcher] Watching for changes...');

  // Watch for changes
  watch(input, { delay: delay, dot: true }, imagemin)
  .on('change', (path) => {
    logger.log(`[watcher] File changed (${path})`);
  });

  // Complete
  return complete();
}

// Default Task
module.exports = series(imagemin, imageminWatcher);
