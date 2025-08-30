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

// Glob
const input = [
  // Project entry point
  'src/assets/css/main.scss',

  // Page-specific CSS
  `${rootPathPackage}/dist/assets/css/pages/**/*.scss`,
  'src/assets/css/pages/**/*.scss',

  // Files to exclude
  // '!dist/**',
];

// Additional files to watch (but not compile as entry points)
const watchInput = [
  ...input,
  // Theme CSS - watch for changes but don't compile as entry points
  `${rootPathPackage}/dist/assets/themes/**/*.scss`,
  'src/assets/themes/**/*.scss',
];

const output = 'dist/assets/css';
const delay = 250;
const compiled = {};

// Configuration
const MAIN_BUNDLE_PAGE_PARTIALS = false; // Set to true to merge pages into _page-specific.scss, false to compile separately

// SASS Compilation Task
function sass(complete) {
  // Log
  logger.log('Starting...');

  // Generate pages scss
  generatePageScss();

  // Compile
  return src(input, { sourcemaps: true })
    // Skip files based on configuration
    .pipe(filter(file => !shouldSkip(file.path), { restore: true }))
    // Compile SASS
    .pipe(compiler({
      loadPaths: [
        // So we can use "@use 'ultimate-jekyll-manager' as *;"
        path.resolve(rootPathPackage, 'dist/assets/css'),

        // So we can use "@use 'themes/{theme}' as *;" in the project
        path.resolve(rootPathPackage, 'dist/assets/themes', config.theme.id),

        // So we can load _pages.scss from the project's dist
        path.resolve(rootPathProject, 'dist/assets/css'),

        // TODO: Add more load paths like node_modules for things like fontawesome
        // path.resolve(rootPathProject, 'node_modules'),
      ],
      // Suppress deprecation warnings from Bootstrap
      quietDeps: true,
      // Only show warnings once
      verbose: false
    })
    .on('error', complete))
    .pipe(cleanCSS({
      format: Manager.isBuildMode() ? 'compressed' : 'beautify',
    }))
    .pipe(rename((file) => {
      // Add bundle to the name
      file.basename += '.bundle';

      // If its NOT basename === main.bundle, add pages/ before dirname
      if (file.basename !== 'main.bundle') {
        file.dirname = `pages/${file.dirname}`;
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
