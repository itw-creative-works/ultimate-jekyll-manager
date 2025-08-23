// Libraries
const Manager = new (require('../../build.js'));
const logger = Manager.logger('imagemin');
const { src, dest, watch, series } = require('gulp');
const glob = require('glob').globSync;
const responsive = require('gulp-responsive-modern');
const path = require('path');
const jetpack = require('fs-jetpack');
const GitHubCache = require('./utils/github-cache');

// Load package
const rootPathProject = Manager.getRootPath('project');

// Settings
const CACHE_DIR = '.temp/imagemin';
const CACHE_BRANCH = 'uj-imagemin';
const RECHECK_DAYS = 0; // Set to 0 to always check hash

// Variables
let githubCache;

// Track processed files during development session (file path -> process time)
const processedFiles = new Map();

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
async function imagemin(complete) {
  // Log
  logger.log('Starting...');

  // Use glob to get file count for matching files
  let files = glob(input);

  // If there's no files, complete
  if (files.length === 0) {
    // Log
    logger.log('Found 0 images to process');

    // Complete
    return complete();
  }

  // Log
  logger.log(`Found ${files.length} images to process`);

  // In development mode, filter out already processed images using our Set
  let filteredFiles = files;
  if (!Manager.isBuildMode()) {
    filteredFiles = files.filter(file => {
      // Check if we've already processed this file in this session
      if (processedFiles.has(file)) {
        // Check if the file has been modified since we processed it
        const srcStat = jetpack.inspect(file, { times: true });
        const processedTime = processedFiles.get(file);

        // If file hasn't changed since we processed it, skip
        if (srcStat && processedTime && srcStat.modifyTime <= processedTime) {
          return false;
        }
      }

      // File needs processing
      return true;
    });

    if (filteredFiles.length === 0) {
      logger.log('✅ All images already processed in this session. Skipping.');
      return complete();
    }

    if (filteredFiles.length < files.length) {
      logger.log(`⏭️ Skipping ${files.length - filteredFiles.length} already processed images`);
      logger.log(`🔄 Processing ${filteredFiles.length} new/unprocessed images`);
    }

    // Update files to use filtered list
    files = filteredFiles;
  }

  // Check if we should use cache (build mode OR force flag)
  const forceCache = process.env.UJ_IMAGEMIN_FORCE === 'true';
  const useCache = Manager.isBuildMode() || forceCache;

  if (forceCache) {
    logger.log('🚀 Force cache mode enabled (UJ_IMAGEMIN_FORCE=true)');
  }

  if (useCache) {
    githubCache = new GitHubCache({
      branchName: CACHE_BRANCH,
      cacheDir: CACHE_DIR,
      logger: logger
    });

    if (githubCache.hasCredentials()) {
      // Pull cached images from branch
      await githubCache.fetchBranch();
    } else {
      logger.warn('⚠️ GitHub credentials not available, running without cache');
    }
  }

  // Load or create meta cache
  const metaPath = path.join(CACHE_DIR, 'meta.json');
  let meta = githubCache ? githubCache.loadMetadata(metaPath) : {};

  // Track which files need processing
  const filesToProcess = [];
  const cachedFiles = [];
  const updatedFiles = new Set();

  for (const file of files) {
    const relativePath = path.relative(rootPathProject, file);
    const hash = githubCache ? githubCache.calculateHash(file) : null;

    // Check if file needs processing
    const entry = meta[relativePath];
    const age = entry?.timestamp
      ? (Date.now() - new Date(entry.timestamp).getTime()) / (1000 * 60 * 60 * 24)
      : Infinity;

    const useCached = entry
      && entry.hash === hash
      && (RECHECK_DAYS === 0 || age < RECHECK_DAYS);

    if (useCached) {
      // Check if cached versions exist
      const baseNameWithoutExt = path.basename(file, path.extname(file));
      const dirName = path.dirname(relativePath);

      const expectedOutputs = [
        `${baseNameWithoutExt}-1024px.jpg`,
        `${baseNameWithoutExt}-1024px.webp`,
        `${baseNameWithoutExt}-640px.jpg`,
        `${baseNameWithoutExt}-640px.webp`,
        `${baseNameWithoutExt}-320px.jpg`,
        `${baseNameWithoutExt}-320px.webp`,
        `${baseNameWithoutExt}.webp`,
        path.basename(file), // Original
      ];

      let allCachedExist = true;
      for (const outputFile of expectedOutputs) {
        const cachePath = path.join(CACHE_DIR, 'images', dirName, outputFile);
        const destPath = path.join(output, dirName, outputFile);

        if (jetpack.exists(cachePath)) {
          // Copy from cache to destination
          jetpack.copy(cachePath, destPath, { overwrite: true });
        } else {
          allCachedExist = false;
          break;
        }
      }

      if (allCachedExist) {
        cachedFiles.push(relativePath);
        logger.log(`📦 Using cache: ${relativePath}`);
        continue;
      }
    }

    // File needs processing
    filesToProcess.push(file);

    // Update meta entry
    meta[relativePath] = {
      timestamp: new Date().toISOString(),
      hash,
    };

    updatedFiles.add(metaPath);
  }

  // Log cache summary
  if (cachedFiles.length > 0) {
    logger.log(`📦 Used cache for ${cachedFiles.length} images`);
  }

  // If there's no files to process, complete
  if (filesToProcess.length === 0) {
    logger.log('✅ All images already processed (from cache)');
    return complete();
  }

  // Log
  logger.log(`🔄 Processing ${filesToProcess.length} new/changed images`);

  // Process images: resize and convert to webp
  // Use base option to preserve directory structure
  return src(filesToProcess, { base: 'src/assets/images' })
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
          // Tablet resized version (640px wide) in original format
          {
            width: 640,
            rename: { suffix: '-640px' }
          },
          // Tablet resized webp version
          {
            width: 640,
            format: 'webp',
            rename: { suffix: '-640px' }
          },
          // Mobile resized version (320px wide) in original format
          {
            width: 320,
            rename: { suffix: '-320px' }
          },
          // Mobile resized webp version
          {
            width: 320,
            format: 'webp',
            rename: { suffix: '-320px' }
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
    .on('data', (file) => {
      // Also save to cache
      const relativePath = path.relative(path.join(rootPathProject, output), file.path);
      const cachePath = path.join(CACHE_DIR, 'images', relativePath);

      jetpack.copy(file.path, cachePath, { overwrite: true });
      updatedFiles.add(cachePath);
    })
    .on('finish', async () => {
      // Add processed files to our Set for development mode
      if (!Manager.isBuildMode()) {
        const now = Date.now();
        filesToProcess.forEach(file => {
          processedFiles.set(file, now);
        });
        logger.log(`📝 Tracked ${filesToProcess.length} processed files in session`);
      }

      // Save meta file
      if (githubCache) {
        githubCache.saveMetadata(metaPath, meta);
      }

      // Push to cache branch if in build mode
      if (useCache && githubCache && githubCache.hasCredentials()) {
        await githubCache.pushBranch(updatedFiles, {
          branchReadme: 'This branch stores processed image cache for faster builds\n'
        });
      }

      // Log
      logger.log('✅ Finished!');
      logger.log(`📊 Summary: ${filesToProcess.length} processed, ${cachedFiles.length} from cache`);

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
