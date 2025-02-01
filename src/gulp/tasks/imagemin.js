// Libraries
const path = require('path');
const { src, dest, watch, series } = require('gulp');
const glob = require('glob').globSync;
const responsive = require('gulp-responsive-modern');
const Manager = new (require('../../index.js'));
const logger = Manager.logger('imagemin');

// Glob
const input = [
  // Files to include
  'site/assets/images/**/*.{jpg,jpeg,png}',

  // Files to exclude
  // '!site/compiled/**',
];
const output = 'site/compiled/images';

// IMAGES Processing Task
function imagemin(complete) {
  // Log
  logger.log('Starting image processing...');

  // Use glob to get file count for msdtching files
  const files = glob(input);

  // If there's no files, complete
  if (files.length === 0) {
    // Log
    logger.log('No images to process');

    // Complete
    return complete();
  }

  // Process images: resize and convert to webp
  return src(input)
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
      logger.log('Finished image processing!');

      // Complete
      return complete();
    });
}

// Watcher Task
function imageminWatcher(complete) {
  // Quit if in build mode
  if (process.env.UJ_BUILD_MODE === 'true') {
    logger.log('Skipping image watcher in build mode');
    return complete();
  }

  // Log
  logger.log('Watching for image changes...');

  // Watch for changes
  watch(input, { delay: 250 }, imagemin);

  // Complete
  return complete();
}

// Default Task
module.exports = series(imagemin, imageminWatcher);
