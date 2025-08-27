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

// Variables
let githubCache;

// Glob
const input = [
  // Files to include
  'src/assets/images/**/*.{jpg,jpeg,png,gif,svg,webp}',

  // Files to exclude
  // '!dist/**',
];
const output = 'dist/assets/images';
const delay = 250;

// Set index
let index = -1;

// Picture sizes configuration
const PICTURE_SIZES = [
  { width: 1024, suffix: '-1024px', formats: ['original', 'webp'] },
  { width: 640, suffix: '-640px', formats: ['original', 'webp'] },
  { width: 320, suffix: '-320px', formats: ['original', 'webp'] },
  { width: null, suffix: '', formats: ['original', 'webp'] }, // Original size
];

// Get responsive configs once
const responsiveConfigs = getResponsiveConfigs();

// Main task
async function imagemin(complete) {
  // Increment index
  index++;

  // Log
  logger.log('Starting...');

  // Initialize cache on first run
  if (index === 0) {
    // Log responsive configurations
    logger.log('📏 Responsive configurations:', responsiveConfigs);

    // Initialize cache
    githubCache = await initializeCache();
  }

  // Get all images
  const files = glob(input);
  if (files.length === 0) {
    logger.log('Found 0 images to process');
    return complete();
  }

  logger.log(`Found ${files.length} images to process`);

  // Load metadata
  const metaPath = path.join(CACHE_DIR, 'meta.json');
  let meta = githubCache ? githubCache.loadMetadata(metaPath) : {};

  // Clean metadata of deleted files
  if (githubCache) {
    githubCache.cleanDeletedFromMetadata(meta, files, rootPathProject);
  }

  // Determine what needs processing
  const { filesToProcess, validCachePaths } = await determineFilesToProcess(files, meta, githubCache);

  // Handle case where all files are from cache
  if (filesToProcess.length === 0) {
    logger.log('✅ All images from cache');
    await handleCacheOnlyUpdate(githubCache, metaPath, meta, validCachePaths, files.length);
    return complete();
  }

  logger.log(`🔄 Processing ${filesToProcess.length} images`);

  // Process images
  return src(filesToProcess, { base: 'src/assets/images' })
    .pipe(responsive({
      '**/*.{jpg,jpeg,png}': responsiveConfigs
    }, {
      quality: 80,
      progressive: true,
      withMetadata: false,
      withoutEnlargement: false,
      skipOnEnlargement: false,
    }))
    .pipe(dest(output))
    .on('data', (file) => {
      // Save to cache
      const relativePath = path.relative(path.join(rootPathProject, output), file.path);
      const cachePath = path.join(CACHE_DIR, 'images', relativePath);
      jetpack.copy(file.path, cachePath, { overwrite: true });
    })
    .on('finish', async () => {
      // Save metadata and push cache
      if (githubCache && githubCache.hasCredentials()) {
        githubCache.saveMetadata(metaPath, meta);

        // Collect all cache files to push (metadata will be auto-included)
        const allCacheFiles = glob(path.join(CACHE_DIR, '**/*'), { nodir: true });

        // Push to GitHub with atomic replacement
        await githubCache.pushBranch(allCacheFiles, {
          validFiles: validCachePaths,
          stats: {
            timestamp: new Date().toISOString(),
            sourceCount: files.length,
            cachedCount: allCacheFiles.length - 1,
            processedNow: filesToProcess.length,
            fromCache: files.length - filesToProcess.length
          }
        });
      }

      logger.log('✅ Finished!');
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
module.exports = series(
  imagemin,
  imageminWatcher
);

// ============================================================================
// Helper Functions
// ============================================================================

// Build responsive configurations from PICTURE_SIZES
function getResponsiveConfigs() {
  const configs = [];
  PICTURE_SIZES.forEach(size => {
    size.formats.forEach(format => {
      const config = {};

      if (size.width) {
        config.width = size.width;
      }

      config.rename = { suffix: size.suffix };

      if (format === 'webp') {
        config.format = 'webp';
      }

      configs.push(config);
    });
  });
  return configs;
}

// Initialize or get cache
async function initializeCache() {
  const useCache = process.env.UJ_IMAGEMIN_CACHE !== 'false';
  if (!useCache) {
    return null;
  }

  const cache = new GitHubCache({
    branchName: CACHE_BRANCH,
    cacheDir: CACHE_DIR,
    logger: logger,
    cacheType: 'Image',
    description: 'processed image cache for faster builds'
  });

  // Fetch cache from GitHub if credentials available
  if (cache.hasCredentials()) {
    await cache.fetchBranch();
    logger.log(`📦 Cache initialized with ${glob(path.join(CACHE_DIR, '**/*'), { nodir: true }).length} files`);
  } else {
    logger.log('📦 Cache enabled (local only - no GitHub credentials)');
  }

  return cache;
}

// Determine which files need processing
async function determineFilesToProcess(files, meta, githubCache) {
  const filesToProcess = [];
  const validCachePaths = new Set();

  for (const file of files) {
    const relativePath = path.relative(rootPathProject, file);
    const hash = githubCache ? githubCache.calculateHash(file) : null;

    // Track expected outputs for this file
    const baseName = path.basename(file, path.extname(file));
    const dirName = path.dirname(relativePath).replace(/^src\/assets\/images\/?/, '');
    const originalExt = path.extname(file).slice(1); // Remove the dot

    const outputs = [];
    PICTURE_SIZES.forEach(size => {
      size.formats.forEach(format => {
        if (format === 'original') {
          outputs.push(`${baseName}${size.suffix}.${originalExt}`);
        } else if (format === 'webp') {
          outputs.push(`${baseName}${size.suffix}.webp`);
        }
      });
    });

    // Track as valid cache files
    outputs.forEach(name => validCachePaths.add(path.join('images', dirName, name)));

    // Check if cached and all outputs exist
    const useCached = meta[relativePath]?.hash === hash;
    if (useCached) {
      const allExist = outputs.every(name =>
        jetpack.exists(path.join(CACHE_DIR, 'images', dirName, name))
      );

      if (allExist) {
        // Copy from cache to output
        outputs.forEach(name => {
          const src = path.join(CACHE_DIR, 'images', dirName, name);
          const dst = path.join(output, dirName, name);
          jetpack.copy(src, dst, { overwrite: true });
        });
        logger.log(`📦 Using cache: ${relativePath}`);
        continue;
      }
    }

    // Needs processing
    filesToProcess.push(file);
    meta[relativePath] = { hash, timestamp: new Date().toISOString() };
  }

  return { filesToProcess, validCachePaths };
}

// Handle cache-only update (when no files need processing)
async function handleCacheOnlyUpdate(githubCache, metaPath, meta, validCachePaths, fileCount) {
  if (!githubCache || !githubCache.hasCredentials()) {
    return;
  }

  // Save metadata
  githubCache.saveMetadata(metaPath, meta);

  // Check for orphans locally to decide if we need to push
  const orphanCheck = await githubCache.checkForOrphans(validCachePaths);
  if (orphanCheck.hasOrphans) {
    logger.log(`🗑️ Found ${orphanCheck.orphanedCount} orphaned files - updating cache`);

    // Collect all valid cache files
    const allCacheFiles = glob(path.join(CACHE_DIR, '**/*'), { nodir: true });

    // Push to GitHub (pushBranch will handle orphan detection internally)
    await githubCache.pushBranch(allCacheFiles, {
      validFiles: validCachePaths,
      stats: {
        timestamp: new Date().toISOString(),
        sourceCount: fileCount,
        cachedCount: allCacheFiles.length - 1, // Subtract meta.json
        processedNow: 0,
        fromCache: fileCount
      }
    });
  }
}
