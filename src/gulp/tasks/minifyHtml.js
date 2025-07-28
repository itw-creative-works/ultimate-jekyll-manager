// Libraries
const Manager = new (require('../../build.js'));
const logger = Manager.logger('minifyHtml');
const { src, dest, series } = require('gulp');
const { minify } = require('html-minifier-terser');
const through2 = require('through2');
const terser = require('terser');

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

// Main task
function minifyHtmlTask(complete) {
  // Check if we should minify
  const shouldMinify = Manager.isBuildMode() || process.env.UJ_MINIFY_HTML_FORCE === 'true';

  if (!shouldMinify) {
    logger.log('Skipping HTML minification (not in production mode and UJ_MINIFY_HTML_FORCE not set)');
    return complete();
  }

  // Log
  logger.log('Starting HTML minification...');

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

  // Process HTML files
  return src(input)
    .pipe(through2.obj(async function(file, enc, callback) {
      if (file.isBuffer()) {
        try {
          let htmlContent = file.contents.toString();

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

          file.contents = Buffer.from(finalHtml);
        } catch (err) {
          logger.error(`Error minifying ${file.path}: ${err.message}`);
        }
      }
      callback(null, file);
    }))
    .pipe(dest(output))
    .on('finish', () => {
      // Log
      logger.log('Finished HTML minification!');

      // Complete
      return complete();
    });
}

// Default Task (no watcher for minifyHtml as it runs after Jekyll build)
module.exports = minifyHtmlTask;
