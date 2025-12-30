// Libraries
const Manager = new (require('../../build.js'));
const logger = Manager.logger('sass');
const { src, dest, watch, series } = require('gulp');
const glob = require('glob').globSync;
const path = require('path');
const jetpack = require('fs-jetpack');
const compiler = require('gulp-sass')(require('sass'));
const cleanCSS = require('gulp-clean-css');
const rename = require('gulp-rename');
const filter = require('gulp-filter').default;
const { template } = require('node-powertools');
const yaml = require('js-yaml');
const postcss = require('gulp-postcss');
const purgeCss = require('@fullhuman/postcss-purgecss').default;

// Load package
const package = Manager.getPackage('main');
const project = Manager.getPackage('project');
const config = Manager.getConfig('project');
const rootPathPackage = Manager.getRootPath('main');
const rootPathProject = Manager.getRootPath('project');

// Const
const PAGE_IMPORT = `
  /* Main CSS for { pagePath } */
  html[data-page-path="{ pagePath }"] {
    { mainImport }
  }

  /* Project CSS for { pagePath } */
  html[data-page-path="{ pagePath }"] {
    { projectImport }
  }
`

// Define bundle files separately for easier tracking
const bundleFiles = [
  // Main bundles
  `${rootPathPackage}/dist/assets/css/bundles/*.scss`,

  // Project bundles
  'src/assets/css/bundles/*.scss',
];

// Glob
const input = [
  // Bundle files (admin, and any future bundles)
  ...bundleFiles,

  // Project entry point (main.scss)
  'src/assets/css/main.scss',

  // Page-specific CSS
  `${rootPathPackage}/dist/assets/css/pages/**/*.scss`,
  'src/assets/css/pages/**/*.scss',

  // Files to exclude
  // '!dist/**',
];

// Additional files to watch (but not compile as entry points)
const watchInput = [
  // Watch the paths we're compiling
  ...input,

  // Core CSS - watch for changes but don't compile as entry points
  `${rootPathPackage}/dist/assets/css/**/*.scss`,

  // Theme CSS - watch for changes but don't compile as entry points
  `${rootPathPackage}/dist/assets/themes/**/*.scss`,
  'src/assets/themes/**/*.scss',
];

const output = 'dist/assets/css';
const delay = 250;
const compiled = {};

// Configuration
const MAIN_BUNDLE_PAGE_PARTIALS = false; // Set to true to merge pages into _page-specific.scss, false to compile separately
// Enable PurgeCSS via environment variable or in production mode
const ENABLE_PURGECSS = Manager.isBuildMode() || process.env.UJ_PURGECSS === 'true';

// SASS Compilation Task
function sass(complete) {
  // Log
  logger.log('Starting...');
  Manager.logMemory(logger, 'Start');

  // Generate pages scss
  generatePageScss();

  // Compile
  let stream = src(input, { sourcemaps: true })
    // Skip files based on configuration
    .pipe(filter(file => !shouldSkip(file.path), { restore: true }))
    // Compile SASS
    .pipe(compiler({
      loadPaths: [
        // So we can use "@use 'ultimate-jekyll-manager' as *;"
        path.resolve(rootPathPackage, 'dist/assets/css'),

        // Project theme FIRST (higher priority) - allows consuming projects to define custom themes
        path.resolve(rootPathProject, 'src/assets/themes', config.theme.id),

        // UJM theme as fallback - for built-in themes like "classy", "bootstrap"
        path.resolve(rootPathPackage, 'dist/assets/themes', config.theme.id),

        // UJM themes root - allows themes to reference sibling themes (e.g., ../bootstrap)
        path.resolve(rootPathPackage, 'dist/assets/themes'),

        // So we can load _pages.scss from the project's dist
        path.resolve(rootPathProject, 'dist/assets/css'),

        // TODO: Add more load paths like node_modules for things like fontawesome
        path.resolve(rootPathProject, 'node_modules'),
      ],
      // Suppress deprecation warnings from Bootstrap
      quietDeps: true,
      // Only show warnings once
      verbose: false
    })
    .on('error', (error) => Manager.reportBuildError(Object.assign(error, { plugin: 'SASS' }), complete)));

  // Apply PurgeCSS if enabled
  if (ENABLE_PURGECSS) {
    logger.log('PurgeCSS enabled - removing unused CSS');

    // Define content patterns for PurgeCSS
    const contentPatterns = [
      // All Ultimate Jekyll defaults EXCEPT themes subdirectories
      `${rootPathPackage}/dist/defaults/**/*.{html,liquid,md}`,

      // Explicitly exclude ALL theme directories, then include only the active theme
      `!${rootPathPackage}/dist/defaults/**/_includes/themes/**`,
      `!${rootPathPackage}/dist/defaults/**/_layouts/themes/**`,

      // Exclude test pages that include components we don't normally use (would prevent PurgeCSS from working)
      `!${rootPathPackage}/dist/defaults/**/pages/test/**/*.{html,liquid,md}`,

      // Include ONLY the active theme's files from UJM
      `${rootPathPackage}/dist/defaults/**/_includes/themes/${config.theme.id}/**/*.{html,liquid,md}`,
      `${rootPathPackage}/dist/defaults/**/_layouts/themes/${config.theme.id}/**/*.{html,liquid,md}`,

      // Project theme layouts/includes (for project-defined themes)
      `src/_layouts/themes/${config.theme.id}/**/*.{html,liquid,md}`,
      `src/_includes/themes/${config.theme.id}/**/*.{html,liquid,md}`,

      // Project HTML
      'src/**/*.{html,liquid,md}',
      'dist/**/*.{html,liquid,md}',

      // Main JS
      `${rootPathPackage}/dist/assets/js/**/*.js`,
      `${rootPathPackage}/node_modules/web-manager/**/*.js`,

      // Project theme JS (for project-defined themes)
      `src/assets/themes/${config.theme.id}/**/*.js`,

      // UJM theme JS
      `${rootPathPackage}/dist/assets/themes/${config.theme.id}/**/*.js`,

      // Project JS
      'src/assets/js/**/*.js',
    ];

    // // Log the files that will be analyzed
    // logger.log('PurgeCSS content patterns:', contentPatterns);

    // // Separate inclusion and exclusion patterns for glob
    // const includePatterns = contentPatterns.filter(p => !p.startsWith('!'));
    // const excludePatterns = contentPatterns.filter(p => p.startsWith('!')).map(p => p.substring(1));

    // // Use glob to get the actual files (respecting exclusions)
    // const allFiles = glob(includePatterns, { ignore: excludePatterns });

    // logger.log(`PurgeCSS will analyze ${allFiles.length} total files:`);

    // // Group files by type for better readability
    // const fileGroups = {
    //   'HTML/Liquid/MD files': allFiles.filter(f => /\.(html|liquid|md)$/.test(f)),
    //   'JavaScript files': allFiles.filter(f => /\.js$/.test(f))
    // };

    // Object.entries(fileGroups).forEach(([groupName, files]) => {
    //   if (files.length > 0) {
    //     logger.log(`  ${groupName}: ${files.length} files`);
    //     // Show first 5 files as examples
    //     files.forEach(file => {
    //       logger.log(`    - ${file}`);
    //     });
    //   }
    // });

    // Apply PurgeCSS
    stream = stream.pipe(postcss([
      purgeCss({
        content: contentPatterns,
        // Safelist patterns for dynamic classes
        safelist: {
          standard: [
            // Bootstrap JavaScript components
            /^modal-/,
            /^bs-/,
            /^data-bs-/,
            /^carousel-/,
            /^collapse/,
            /^dropdown-/,
            /^offcanvas-/,
            /^tooltip-/,
            /^popover-/,
            /^toast-/,
            /^show$/,
            /^showing$/,
            /^hide$/,
            /^fade$/,
            /^active$/,
            /^disabled$/,

            // Accordion specific
            /^accordion/,
            /^collapsed$/,
            /^collapsing$/,

            // Common dynamic classes
            /^is-/,
            /^has-/,
            /^was-/,

            // Animations
            /^animation-/,

            // Utilities that might be added dynamically
            /^[mp][trblxy]?-[0-9]+$/,
            /^text-/,
            /^bg-/,
            /^border-/,
            /^rounded-/,
            /^shadow-/,
            /^d-/,
            /^flex-/,
            /^justify-/,
            /^align-/,
            /^order-/,
            /^overflow-/,
            /^position-/,
            /^w-/,
            /^h-/,
            /^mw-/,
            /^mh-/,
            /^min-/,
            /^max-/,

            // Utilities
            /^ratio-/,
            /^object-/,

            // Libraries
            // Cookies
            /^cookie-consent-/,

            // Font Awesome
            /^fa-/,

            // Lazy
            /^lazy-/,

            // Social
            /^social-share-/,
          ],
          deep: [
            // Preserve input state pseudo-selectors (checkbox, radio, etc.)
            /:checked/,
            /:disabled/,
            /:enabled/,
            /:focus/,
            /:hover/,
            /:valid/,
            /:invalid/,
          ],
          greedy: [],
          // Preserve keyframe animations
          keyframes: [
            /^spinner-/,
            // /^accordion/,
            // /^fade-/,
            // /^slide-/,
            // /^collapse/
          ]
        },
        // Don't remove CSS variables
        variables: true,
        // Keep keyframes
        keyframes: true,
        // Keep font-face rules
        fontFace: true
      })
    ]));
  }

  // Process
  return stream
    .pipe(cleanCSS({
      format: Manager.actLikeProduction() ? 'compressed' : 'beautify',
    }))
    .pipe(rename((file) => {
      // Add bundle to the name
      file.basename += '.bundle';

      // Get list of expected bundle names from the bundle files glob
      // These are files that should be in the root CSS directory
      const bundleNames = glob(bundleFiles).map(f => path.basename(f, '.scss'));
      bundleNames.push('main'); // main.scss is always a root bundle

      // Check if this is a root-level bundle
      const baseName = file.basename.replace('.bundle', '');
      const isBundle = bundleNames.includes(baseName);

      // Check
      if (isBundle) {
        // Root-level bundles (main, admin, or any future bundle in bundles/ directory)
        // Keep in root directory
        file.dirname = '.';
      } else {
        // All other files are page bundles
        // Add pages/ prefix if not already there
        if (!file.dirname.startsWith('pages/')) {
          file.dirname = `pages/${file.dirname}`;
        }
      }

      // Track the full output path
      const fullPath = path.resolve(output, file.dirname, `${file.basename}${file.extname}`);
      compiled[fullPath] = true;
    }))
    .pipe(dest(output, { sourcemaps: '.' }))
    // .pipe(dest(output))
    .on('finish', () => {
      // Log
      logger.log('Finished!');

      // Trigger rebuild
      Manager.triggerRebuild(compiled);

      // Complete
      return complete();
    });
}

// Watcher Task
function sassWatcher(complete) {
  // Quit if in build mode
  if (Manager.isBuildMode()) {
    logger.log('[watcher] Skipping watcher in build mode');
    return complete();
  }

  // Log
  logger.log('[watcher] Watching for changes...');

  // Watch for changes
  watch(watchInput, { delay: delay, dot: true }, sass)
  .on('change', (path) => {
    logger.log(`[watcher] File changed (${path})`);
  });

  // Complete
  return complete();
}

function parseFrontmatter(filePath) {
  try {
    const content = jetpack.read(filePath);
    if (!content) return null;

    // Check if file has frontmatter
    if (!content.startsWith('---')) return null;

    // Find the end of frontmatter
    const frontmatterEnd = content.indexOf('---', 3);
    if (frontmatterEnd === -1) return null;

    // Extract frontmatter content
    const frontmatterContent = content.substring(3, frontmatterEnd).trim();

    // Parse YAML frontmatter
    const frontmatter = yaml.load(frontmatterContent);
    return frontmatter || {};
  } catch (error) {
    logger.log(`Error parsing frontmatter for ${filePath}:`, error.message);
    return null;
  }
}

function getPagePermalink(pageFilePath) {
  const frontmatter = parseFrontmatter(pageFilePath);

  if (frontmatter && frontmatter.permalink) {
    return frontmatter.permalink;
  }

  // Fallback to path-based permalink
  const relativePath = pageFilePath.replace(/.*\/pages\//, '/').replace(/\.(md|html)$/, '');
  return relativePath === '/index' ? '/' : relativePath;
}

function findPageFiles() {
  const pagePatterns = [
    // Main package pages
    `${rootPathPackage}/dist/defaults/dist/pages/**/*.{md,html}`,

    // Project package pages
    `${rootPathProject}/src/pages/**/*.{md,html}`,
  ];

  const pageFiles = [];
  pagePatterns.forEach(pattern => {
    const files = glob(pattern);
    pageFiles.push(...files.map(f => path.resolve(f)));
  });

  return pageFiles;
}

function generatePageScss() {
  // Only generate _page-specific.scss if we're skipping page partials
  if (!MAIN_BUNDLE_PAGE_PARTIALS) {
    // When compiling pages separately, we can either:
    // 1. Create an empty file with a comment
    // 2. Create imports to the compiled page bundles (for backwards compatibility)
    const outputPath = path.resolve(rootPathProject, 'dist/assets/css/_page-specific.scss');
    const content = '/*\n  AUTO-GENERATED PAGE-SPECIFIC SCSS\n  Pages are now compiled separately when MAIN_BUNDLE_PAGE_PARTIALS = false\n  Find compiled page CSS in dist/assets/css/pages/\n*/\n\n';

    jetpack.write(outputPath, content);
    Manager.triggerRebuild(outputPath);
    return;
  }

  // Original behavior when MAIN_BUNDLE_PAGE_PARTIALS is true
  // Get all page files to extract permalinks
  const pageFiles = findPageFiles();

  // Create a map to store the pages based on their permalinks
  const pagesMap = {};

  // Process each page file to find its permalink and corresponding SCSS files
  pageFiles.forEach((pageFile) => {
    const permalink = getPagePermalink(pageFile);

    // Skip if we already processed this permalink
    if (pagesMap[permalink]) {
      return;
    }

    // Look for corresponding SCSS files based on the permalink
    const scssBasePath = permalink === '/' ? '/index' : permalink;

    // Construct potential SCSS file paths
    const mainScssPath = path.resolve(rootPathPackage, `dist/assets/css/pages${scssBasePath}/index.scss`);
    const projectScssPath = path.resolve(rootPathProject, `src/assets/css/pages${scssBasePath}/index.scss`);

    // Check if SCSS files exist
    const mainExists = jetpack.exists(mainScssPath);
    const projectExists = jetpack.exists(projectScssPath);

    // Only add to map if at least one SCSS file exists
    if (mainExists || projectExists) {
      pagesMap[permalink] = {
        main: mainExists ? mainScssPath : null,
        project: projectExists ? projectScssPath : null
      };
    }
  });

  // Set the output file
  let content = '/*\n  AUTO-GENERATED PAGE-SPECIFIC SCSS\n*/\n\n';

  // Loop through each page and generate the import statement
  Object.entries(pagesMap).forEach(([page, paths]) => {
    // Skip if both paths are not found
    if (!paths.main && !paths.project) {
      return
    };

    const mainContent = paths.main ? jetpack.read(paths.main) : null;
    const projectContent = paths.project ? jetpack.read(paths.project) : null;

    // Update the file with the correct import paths
    content += template(PAGE_IMPORT, {
      pagePath: page,
      // mainImport: paths.main ? `@use '${paths.main}';` : '// Not found',
      // projectImport: paths.project ? `@use '${paths.project}';` : '// Not found',
      mainImport: mainContent ? indent(mainContent, 2) : '// Not found',
      projectImport: projectContent ? indent(projectContent, 2) : '// Not found',
    });
  });

  // Get the output path
  const outputPath = path.resolve(rootPathProject, 'dist/assets/css/_page-specific.scss');

  // Log
  logger.log('Found pages:', Object.keys(pagesMap));
  // logger.log('Generated content:', content);
  // logger.log('Output path:', outputPath);

  // Write the content to the output file
  jetpack.write(outputPath, content);

  // Trigger a rebuild
  Manager.triggerRebuild(outputPath);
}

function isPagePartial(file) {
  return file.includes('/assets/css/pages/') && file.endsWith('index.scss');
}

function shouldSkip(file) {
  // Skip page partials only if MAIN_BUNDLE_PAGE_PARTIALS is true
  if (MAIN_BUNDLE_PAGE_PARTIALS && isPagePartial(file)) {
    return true;
  }
  return false;
}

// Indentify the output
function indent(str, spaces) {
  const indent = ' '.repeat(spaces);
  return str
    .trim()
    .split('\n')
    .map(line => line.trim() ? `${indent}${line}` : '')
    .join('\n');
}

// Default Task
// Export
module.exports = series(
  // Manager.wrapTask('sass', sass),
  sass,
  sassWatcher
);
