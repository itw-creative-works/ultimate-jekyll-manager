// Libraries
const Manager = new (require('../../build.js'));
const logger = Manager.logger('minifyHtml');
const { src, dest, series } = require('gulp');
const { minify: minifyRust } = require('@minify-html/node');
const { minify: minifyJs } = require('terser');
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

// Helper function to minify a single file's content using Rust-based minifier
async function minifyFileContent(htmlContent, options, filePath) {
  // Extract and temporarily replace JSON-LD scripts
  const { content: contentAfterJsonLd, extracted: jsonLdScripts } = extractJsonLdScripts(htmlContent);

  // Extract and temporarily replace inline scripts (minified with Terser)
  const { content: contentAfterScripts, extracted: inlineScripts } = await extractInlineScripts(contentAfterJsonLd, filePath);

  // Extract and temporarily replace IE conditional comments
  const { content: contentAfterComments, extracted: conditionalComments } = extractConditionalComments(contentAfterScripts);

  // Minify the HTML content using Rust-based minifier (synchronous, much faster)
  const minifiedBuffer = minifyRust(Buffer.from(contentAfterComments), options);
  const minified = minifiedBuffer.toString();

  // Restore the conditional comments
  let finalHtml = restoreConditionalComments(minified, conditionalComments);

  // Restore the inline scripts
  finalHtml = restoreInlineScripts(finalHtml, inlineScripts);

  // Restore the JSON-LD scripts
  finalHtml = restoreJsonLdScripts(finalHtml, jsonLdScripts);

  return finalHtml;
}

// Main task
function minifyHtmlTask(complete) {
  // Check if we should minify
  const shouldMinify = Manager.isBuildMode() || process.env.UJ_MINIFY_HTML_FORCE === 'true';

  if (!shouldMinify) {
    logger.log('Skipping HTML minification (not in production mode and UJ_MINIFY_HTML_FORCE not set)');
    return complete();
  }

  // Log
  logger.log('Starting...');
  Manager.logMemory(logger, 'Start');

  // Configure minify options for @minify-html/node (Rust-based)
  // NOTE: Inline scripts are extracted before minification to avoid bugs in minify-js
  const options = {
    keep_closing_tags: false,
    keep_comments: false,
    keep_html_and_head_opening_tags: false,
    keep_spaces_between_attributes: false,
    keep_ssi_comments: false,
    minify_css: true,
    minify_js: false, // Disabled - inline scripts are extracted, so nothing to minify
    remove_bangs: false,
    remove_processing_instructions: false
  };

  // Get concurrency limit from environment or use default
  const CONCURRENCY_LIMIT = parseInt(process.env.UJ_MINIFY_CONCURRENCY || '1', 10);
  logger.log(`Concurrency: ${CONCURRENCY_LIMIT} files at a time`);

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

          // Process batch in parallel
          const processedFiles = await Promise.all(
            batch.map(async ({ file }) => {
              try {
                const htmlContent = file.contents.toString();
                const finalHtml = await minifyFileContent(htmlContent, options, file.path);
                file.contents = Buffer.from(finalHtml);
                processed.count++;

                // Log progress every 50 files or on last file
                if (processed.count % 50 === 0 || processed.count === totalFiles) {
                  const percentage = ((processed.count / totalFiles) * 100).toFixed(1);
                  logger.log(`Progress: ${processed.count}/${totalFiles} files (${percentage}%)`);
                  Manager.logMemory(logger, `After ${processed.count} files`);
                }

                return file;
              } catch (err) {
                logger.error(`Error minifying ${file.path}: ${err.message}`);
                return file;
              }
            })
          );

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

// Helper: Extract JSON-LD scripts and replace with placeholders
function extractJsonLdScripts(htmlContent) {
  const extracted = [];
  // Match both quoted and unquoted type attributes (minifier removes quotes)
  const jsonLdRegex = /<script[^>]*type=(?:["']?application\/ld\+json["']?)[^>]*>([\s\S]*?)<\/script>/gi;

  const content = htmlContent.replace(jsonLdRegex, (match, jsonContent) => {
    // Minify the JSON content
    try {
      const parsed = JSON.parse(jsonContent);
      const minifiedJson = JSON.stringify(parsed);
      extracted.push(minifiedJson);
    } catch (e) {
      extracted.push(jsonContent);
    }
    return `__JSON_LD_PLACEHOLDER_${extracted.length - 1}__`;
  });

  return { content, extracted };
}

// Helper: Restore JSON-LD scripts from placeholders
function restoreJsonLdScripts(htmlContent, jsonLdScripts) {
  let content = htmlContent;

  jsonLdScripts.forEach((jsonContent, index) => {
    const scriptTag = `<script type=application/ld+json>${jsonContent}</script>`;
    content = content.replace(`__JSON_LD_PLACEHOLDER_${index}__`, scriptTag);
  });

  return content;
}

// Helper: Extract inline scripts, minify with Terser, and replace with placeholders
async function extractInlineScripts(htmlContent, filePath) {
  const extracted = [];
  const scripts = [];

  // Match <script> tags that are NOT application/ld+json (those are already extracted)
  // This regex excludes external scripts (those with src attribute)
  // Handles both quoted and unquoted type attributes (minifier removes quotes)
  const scriptRegex = /<script(?![^>]*type=(?:["']?application\/ld\+json["']?))(?![^>]*src=)([^>]*)>([\s\S]*?)<\/script>/gi;

  // First pass: collect all scripts and create placeholders
  const content = htmlContent.replace(scriptRegex, (fullMatch, attributes, jsCode) => {
    const index = scripts.length;
    scripts.push({ fullMatch, attributes, jsCode });
    return `__INLINE_SCRIPT_PLACEHOLDER_${index}__`;
  });

  // Second pass: minify all scripts in parallel
  const minifyPromises = scripts.map(async ({ fullMatch, attributes, jsCode }, scriptIndex) => {
    // Skip empty scripts
    if (!jsCode.trim()) {
      return fullMatch;
    }

    // Try to minify the JavaScript with Terser
    try {
      const minified = await minifyJs(jsCode, {
        compress: {
          dead_code: true,
          drop_console: false,
          drop_debugger: true,
          keep_classnames: false,
          keep_fargs: true,
          keep_fnames: false,
          keep_infinity: false,
        },
        mangle: false, // Don't mangle variable names to avoid breaking code
        format: {
          comments: false,
        },
      });

      if (minified && minified.code) {
        return `<script${attributes}>${minified.code}</script>`;
      }

      return fullMatch;
    } catch (err) {
      // Minification failed - use original and log detailed error
      const preview = jsCode.length > 100 ? jsCode.substring(0, 100) + '...' : jsCode;
      const lines = jsCode.split('\n');

      logger.error(`Failed to minify inline script in ${filePath}`);
      logger.error(`  Script #${scriptIndex + 1} (${lines.length} lines)`);
      logger.error(`  Error: ${err.message}`);

      if (err.line !== undefined) {
        logger.error(`  Line ${err.line}, Column ${err.col || '?'}`);
      }

      logger.error(`  Preview: ${preview.replace(/\n/g, ' ')}`);

      return fullMatch;
    }
  });

  // Wait for all minification to complete
  const minifiedScripts = await Promise.all(minifyPromises);

  // Add all minified scripts to extracted array
  minifiedScripts.forEach(script => extracted.push(script));

  return { content, extracted };
}

// Helper: Restore inline scripts from placeholders
function restoreInlineScripts(htmlContent, inlineScripts) {
  let content = htmlContent;

  inlineScripts.forEach((scriptContent, index) => {
    content = content.replace(`__INLINE_SCRIPT_PLACEHOLDER_${index}__`, scriptContent);
  });

  return content;
}

// Helper: Extract IE conditional comments and replace with placeholders
function extractConditionalComments(htmlContent) {
  const extracted = [];
  const conditionalRegex = /<!--\[if[^>]*\]>([\s\S]*?)<!\[endif\]-->/gi;

  const content = htmlContent.replace(conditionalRegex, (match, commentContent) => {
    // Minify the content inside the conditional comment
    try {
      const minifiedContent = commentContent
        .replace(/\s+/g, ' ')
        .replace(/>\s+</g, '><')
        .trim();
      extracted.push(match.replace(commentContent, minifiedContent));
    } catch (e) {
      extracted.push(match);
    }
    return `__CONDITIONAL_COMMENT_PLACEHOLDER_${extracted.length - 1}__`;
  });

  return { content, extracted };
}

// Helper: Restore IE conditional comments from placeholders
function restoreConditionalComments(htmlContent, conditionalComments) {
  let content = htmlContent;

  conditionalComments.forEach((commentContent, index) => {
    content = content.replace(`__CONDITIONAL_COMMENT_PLACEHOLDER_${index}__`, commentContent);
  });

  return content;
}

// Default Task (no watcher for minifyHtml as it runs after Jekyll build)
module.exports = minifyHtmlTask;
