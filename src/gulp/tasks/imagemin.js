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
const ujmConfig = Manager.getUJMConfig();

// Settings
const CACHE_DIR = '.temp/cache/imagemin';
const CACHE_BRANCH = 'cache-uj-imagemin';

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
  Manager.logMemory(logger, 'Start');

  // Skip in dev mode - only run during builds
  if (!Manager.isBuildMode()) {
    logger.log('⏭️ Skipping imagemin in dev mode');
    return complete();
  }

  // Skip if disabled in config
  if (ujmConfig?.imagemin?.enabled === false) {
    logger.log('⏭️ Skipping imagemin - disabled in ultimate-jekyll-manager.json');
    return complete();
  }

  // Track timing
  const startTime = Date.now();

  // Initialize cache on first run
  if (index === 0) {
    // Log responsive configurations
    logger.log('📏 Responsive configurations:', responsiveConfigs);

    // Initialize cache
    githubCache = await initializeCache();
  }

  // Short circuit if no GitHub credentials
  if (!githubCache || !githubCache.hasCredentials()) {
    logger.log('⏭️ Skipping imagemin - no GitHub cache credentials');
    return complete();
  }

  // Track statistics
  const stats = {
    totalImages: 0,
    fromCache: 0,
    optimized: 0,
    cachedFiles: [],
    optimizedFiles: [],
    sizeBefore: 0,
    sizeAfter: 0,
    savedBytes: 0
  };

  // Get all images
  const files = glob(input);
  if (files.length === 0) {
    logger.log('Found 0 images to process');
    return complete();
  }

  stats.totalImages = files.length;
  logger.log(`Found ${files.length} images to process`);

  // Load metadata
  const metaPath = path.join(CACHE_DIR, 'meta.json');
  let meta = githubCache ? githubCache.loadMetadata(metaPath) : {};

  // Clean metadata of deleted files
  if (githubCache) {
    githubCache.cleanDeletedFromMetadata(meta, files, rootPathProject);
  }

  // Determine what needs processing
  const { filesToProcess, validCachePaths } = await determineFilesToProcess(files, meta, githubCache, stats);

  // Handle case where all files are from cache
  if (filesToProcess.length === 0) {
    logger.log('✅ All images from cache');

    // Calculate timing
    const endTime = Date.now();
    const elapsedMs = endTime - startTime;

    // Log statistics
    logImageStatistics(stats, startTime, endTime);

    await handleCacheOnlyUpdate(githubCache, metaPath, meta, validCachePaths, files.length, stats, { startTime, endTime, elapsedMs });
    return complete();
  }

  logger.log(`🔄 Processing ${filesToProcess.length} images`);
  stats.optimized = filesToProcess.length;

  // Track sizes for optimization
  for (const file of filesToProcess) {
    const fileStats = jetpack.inspect(file);
    if (fileStats) {
      stats.sizeBefore += fileStats.size;
    }
    stats.optimizedFiles.push(path.relative(rootPathProject, file));
  }

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
      errorOnUnusedImage: false,
      passThroughUnused: true,
    }))
    .pipe(dest(output))
    .on('data', (file) => {
      // Save to cache
      const relativePath = path.relative(path.join(rootPathProject, output), file.path);
      const cachePath = path.join(CACHE_DIR, 'images', relativePath);
      jetpack.copy(file.path, cachePath, { overwrite: true });

      // Track size after optimization
      const fileStats = jetpack.inspect(file.path);
      if (fileStats) {
        stats.sizeAfter += fileStats.size;
      }
    })
    .on('finish', async () => {
      // Calculate final statistics
      stats.savedBytes = stats.sizeBefore - stats.sizeAfter;

      // Calculate timing
      const endTime = Date.now();
      const elapsedMs = endTime - startTime;

      // Log statistics
      logImageStatistics(stats, startTime, endTime);

      // Save metadata and push cache
      if (githubCache && githubCache.hasCredentials()) {
        githubCache.saveMetadata(metaPath, meta);

        logger.log(`📊 Updating cache with ${stats.optimized} new optimizations and README stats...`);

        // Collect all cache files to push (metadata will be auto-included)
        const allCacheFiles = glob(path.join(CACHE_DIR, '**/*'), { nodir: true });

        // Push to GitHub with atomic replacement
        await githubCache.pushBranch(allCacheFiles, {
          validFiles: validCachePaths,
          stats: {
            timestamp: new Date().toISOString(),
            sourceCount: files.length,
            cachedCount: allCacheFiles.length - 1,
            processedNow: stats.optimized,
            fromCache: stats.fromCache,
            newlyProcessed: stats.optimized,
            timing: {
              startTime,
              endTime,
              elapsedMs
            },
            imageStats: {
              totalImages: stats.totalImages,
              optimized: stats.optimized,
              skipped: stats.fromCache,
              totalSizeBefore: stats.sizeBefore,
              totalSizeAfter: stats.sizeAfter,
              totalSaved: stats.savedBytes
            },
            details: `Optimized ${stats.optimized} images, ${stats.fromCache} from cache\n\n### Files from cache:\n${stats.cachedFiles.length > 0 ? stats.cachedFiles.map(f => `- ${f}`).join('\n') : 'None'}\n\n### Newly optimized files:\n${stats.optimizedFiles.length > 0 ? stats.optimizedFiles.map(f => `- ${f}`).join('\n') : 'None'}`
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
async function determineFilesToProcess(files, meta, githubCache, stats) {
  const filesToProcess = [];
  const validCachePaths = new Set();

  // File extensions that get responsive processing (multiple sizes + webp)
  const RESPONSIVE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png']);

  for (const file of files) {
    const relativePath = path.relative(rootPathProject, file);
    const hash = githubCache ? githubCache.calculateHash(file) : null;

    // Track expected outputs for this file
    const baseName = path.basename(file, path.extname(file));
    const dirName = path.dirname(relativePath).replace(/^src\/assets\/images\/?/, '');
    const originalExt = path.extname(file).slice(1); // Remove the dot

    // Only generate responsive outputs for supported formats
    // Other formats (svg, gif, webp) pass through as-is
    const outputs = [];
    if (RESPONSIVE_EXTENSIONS.has(originalExt.toLowerCase())) {
      PICTURE_SIZES.forEach(size => {
        size.formats.forEach(format => {
          if (format === 'original') {
            outputs.push(`${baseName}${size.suffix}.${originalExt}`);
          } else if (format === 'webp') {
            outputs.push(`${baseName}${size.suffix}.webp`);
          }
        });
      });
    } else {
      outputs.push(`${baseName}.${originalExt}`);
    }

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
        stats.fromCache++;
        stats.cachedFiles.push(relativePath);

        // Track size of cached files
        outputs.forEach(name => {
          const cachePath = path.join(CACHE_DIR, 'images', dirName, name);
          const fileStats = jetpack.inspect(cachePath);
          if (fileStats) {
            stats.sizeAfter += fileStats.size;
          }
        });

        // Track original size
        const originalStats = jetpack.inspect(file);
        if (originalStats) {
          stats.sizeBefore += originalStats.size;
        }

        continue;
      }
    }

    // Needs processing
    filesToProcess.push(file);
    meta[relativePath] = { hash, timestamp: new Date().toISOString() };
  }

  return { filesToProcess, validCachePaths, cacheStats: stats };
}

// Handle cache-only update (when no files need processing)
async function handleCacheOnlyUpdate(githubCache, metaPath, meta, validCachePaths, fileCount, stats, timing) {
  if (!githubCache || !githubCache.hasCredentials()) {
    return;
  }

  // Save metadata
  githubCache.saveMetadata(metaPath, meta);

  // ALWAYS update README with latest stats, even if no orphans
  logger.log(`📊 Updating cache README with latest statistics...`);

  // Collect all valid cache files
  const allCacheFiles = glob(path.join(CACHE_DIR, '**/*'), { nodir: true });

  // Push to GitHub (will update README even if no file changes)
  await githubCache.pushBranch(allCacheFiles, {
    validFiles: validCachePaths,
    stats: {
      timestamp: new Date().toISOString(),
      sourceCount: fileCount,
      cachedCount: allCacheFiles.length - 1, // Subtract meta.json
      processedNow: stats.totalImages,
      fromCache: stats.fromCache,
      newlyProcessed: stats.optimized,
      timing: timing,
      imageStats: {
        totalImages: stats.totalImages,
        optimized: stats.optimized,
        skipped: stats.fromCache,
        totalSizeBefore: stats.sizeBefore,
        totalSizeAfter: stats.sizeAfter,
        totalSaved: stats.sizeBefore - stats.sizeAfter
      },
      details: `All ${fileCount} images served from cache`
    }
  });
}

// Log image statistics
function logImageStatistics(stats, startTime, endTime) {
  const elapsedMs = endTime - startTime;
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const elapsedFormatted = elapsedMinutes > 0
    ? `${elapsedMinutes}m ${elapsedSeconds % 60}s`
    : `${elapsedSeconds}s`;

  logger.log('\n📊 Image Optimization Statistics:');
  logger.log('═══════════════════════════════════════');

  // Timing
  logger.log('⏱️  Timing:');
  logger.log(`   Start time:      ${new Date(startTime).toLocaleTimeString()}`);
  logger.log(`   End time:        ${new Date(endTime).toLocaleTimeString()}`);
  logger.log(`   Total elapsed:   ${elapsedFormatted}`);

  // File processing stats
  logger.log('\n📁 File Processing:');
  logger.log(`   Total images:        ${stats.totalImages}`);
  logger.log(`   From cache:          ${stats.fromCache} (${((stats.fromCache / stats.totalImages) * 100).toFixed(1)}%)`);
  logger.log(`   Newly optimized:     ${stats.optimized} (${((stats.optimized / stats.totalImages) * 100).toFixed(1)}%)`);

  // Size reduction stats
  if (stats.sizeBefore > 0 && stats.sizeAfter > 0) {
    const savedPercent = ((stats.savedBytes / stats.sizeBefore) * 100).toFixed(1);
    logger.log('\n💾 Size Reduction:');
    logger.log(`   Original size:       ${formatBytes(stats.sizeBefore)}`);
    logger.log(`   Optimized size:      ${formatBytes(stats.sizeAfter)}`);
    logger.log(`   Total saved:         ${formatBytes(stats.savedBytes)} (${savedPercent}%)`);
  }

  logger.log('═══════════════════════════════════════\n');
}

// Helper to format bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
