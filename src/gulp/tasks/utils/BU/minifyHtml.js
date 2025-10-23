// Libraries
const Manager = new (require('../../build.js'));
const logger = Manager.logger('minifyHtml');
const { src, dest, series } = require('gulp');
const { minify } = require('html-minifier-terser');
const through2 = require('through2');

// Load package
const package = Manager.getPackage('main');
const project = Manager.getPackage('project');
const config = Manager.getConfig('project');
const rootPathPackage = Manager.getRootPath('main');
const rootPathProject = Manager.getRootPath('project');

// Glob
const input = [
  // Files to include
  '_site/**/*.html',
];
const output = '_site';

// Helper function to minify a single file's content
async function minifyFileContent(htmlContent, options) {
  // Extract and temporarily replace JSON-LD scripts
  const jsonLdScripts = [];
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  htmlContent = htmlContent.replace(jsonLdRegex, (match, jsonContent) => {
    // Minify the JSON content
    try {
      const parsed = JSON.parse(jsonContent);
      const minifiedJson = JSON.stringify(parsed);
      jsonLdScripts.push(minifiedJson);
    } catch (e) {
      jsonLdScripts.push(jsonContent);
    }
    return `__JSON_LD_PLACEHOLDER_${jsonLdScripts.length - 1}__`;
  });

  // Extract and temporarily replace IE conditional comments
  const conditionalComments = [];
  const conditionalRegex = /<!--\[if[^>]*\]>([\s\S]*?)<!\[endif\]-->/gi;

  htmlContent = htmlContent.replace(conditionalRegex, (match, content) => {
    // Minify the content inside the conditional comment
    try {
      const minifiedContent = content
        .replace(/\s+/g, ' ')
        .replace(/>\s+</g, '><')
        .trim();
      conditionalComments.push(match.replace(content, minifiedContent));
    } catch (e) {
      conditionalComments.push(match);
    }
    return `__CONDITIONAL_COMMENT_PLACEHOLDER_${conditionalComments.length - 1}__`;
  });

  // Minify the HTML content
  const minified = await minify(htmlContent, options);

  // Restore the JSON-LD scripts and conditional comments
  let finalHtml = minified;
  jsonLdScripts.forEach((jsonContent, index) => {
    const scriptTag = `<script type=application/ld+json>${jsonContent}</script>`;
    finalHtml = finalHtml.replace(`__JSON_LD_PLACEHOLDER_${index}__`, scriptTag);
  });

  conditionalComments.forEach((commentContent, index) => {
    finalHtml = finalHtml.replace(`__CONDITIONAL_COMMENT_PLACEHOLDER_${index}__`, commentContent);
  });

  return finalHtml;
}

// Helper function to process files in batches
async function processBatch(batch, options, processed, total) {
  return Promise.all(batch.map(async ({ file }) => {
    try {
      const htmlContent = file.contents.toString();
      const finalHtml = await minifyFileContent(htmlContent, options);
      file.contents = Buffer.from(finalHtml);
      processed.count++;

      // Log progress every 10 files or on last file
      if (processed.count % 10 === 0 || processed.count === total) {
        const percentage = ((processed.count / total) * 100).toFixed(1);
        logger.log(`Progress: ${processed.count}/${total} files (${percentage}%)`);
        Manager.logMemory(logger, `After ${processed.count} files`);
      }

      return file;
    } catch (err) {
      logger.error(`Error minifying ${file.path}: ${err.message}`);
      return file;
    }
  }));
}

// Main task
function minifyHtmlTask(complete) {
  // Check if we should minify
  const shouldMinify = Manager.isBuildMode() || process.env.UJ_MINIFY_HTML_FORCE === 'true';

  if (!shouldMinify) {
    logger.log('Skipping HTML minification (not in production mode and UJ_MINIFY_HTML_FORCE not set)');
    return complete();
  }

  // Get concurrency limit from environment or use default
  const CONCURRENCY_LIMIT = parseInt(process.env.UJ_MINIFY_CONCURRENCY || '10', 10);

  // Log
  logger.log('Starting...');
  logger.log(`Concurrency limit: ${CONCURRENCY_LIMIT} files at a time`);
  Manager.logMemory(logger, 'Start');

  // Configure minify options
  const options = {
    collapseWhitespace: true,
    removeComments: true,
    removeAttributeQuotes: true,
    removeRedundantAttributes: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true,
    useShortDoctype: true,
    removeEmptyAttributes: true,
    removeOptionalTags: false,
    minifyCSS: true,
    minifyJS: true
  };

  // Collect files for batch processing
  const fileQueue = [];
  const processed = { count: 0 };

  // Process HTML files
  return src(input)
    .pipe(through2.obj(function(file, _enc, callback) {
      if (file.isBuffer()) {
        fileQueue.push({ file });
        callback();
      } else {
        callback(null, file);
      }
    }, async function(callback) {
      // This function is called when all files have been queued
      if (fileQueue.length === 0) {
        logger.log('No HTML files to minify');
        return callback();
      }

      const totalFiles = fileQueue.length;
      logger.log(`Minifying ${totalFiles} HTML files...`);

      try {
        // Process files in batches
        for (let i = 0; i < fileQueue.length; i += CONCURRENCY_LIMIT) {
          const batch = fileQueue.slice(i, i + CONCURRENCY_LIMIT);
          const processedFiles = await processBatch(batch, options, processed, totalFiles);

          // Push processed files to the stream
          processedFiles.forEach(file => this.push(file));
        }

        callback();
      } catch (err) {
        logger.error(`Batch processing error: ${err.message}`);
        callback(err);
      }
    }))
    .pipe(dest(output))
    .on('finish', () => {
      // Log
      logger.log('Finished!');
      Manager.logMemory(logger, 'End');

      // Complete
      complete();
    });
}

// Default Task (no watcher for minifyHtml as it runs after Jekyll build)
module.exports = minifyHtmlTask;
