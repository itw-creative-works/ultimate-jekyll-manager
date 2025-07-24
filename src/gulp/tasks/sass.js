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

// Load package
const package = Manager.getPackage('main');
const project = Manager.getPackage('project');
const config = Manager.getConfig('project');
const rootPathPackage = Manager.getRootPath('main');
const rootPathProject = Manager.getRootPath('project');

// Const
const PAGE_IMPORT = `
  // Styles for { pagePath }
  html[data-page-path="{ pagePath }"] {
    // Main page-specific scss
    { mainImport }

    // Project page-specific scss
    { projectImport }
  }
`

// Glob
const input = [
  // Project entry point
  'src/assets/css/main.scss',

  // Main page css
  `${rootPathPackage}/dist/assets/css/pages/**/*.scss`,

  // Project page css
  'src/assets/css/pages/**/*.scss',

  // Files to exclude
  // '!dist/**',
];
const output = 'dist/assets/css';
const delay = 250;
const compiled = {};

// SASS Compilation Task
function sass(complete) {
  // Log
  logger.log('Starting...');

  // Generate pages scss
  generatePageScss();

  // Compile
  return src(input, { sourcemaps: true })
    // Skip page partials
    .pipe(filter(file => !isPagePartial(file.path), { restore: true }))
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
      ]
    }).on('error', compiler.logError))
    .pipe(cleanCSS({
      format: Manager.isBuildMode() ? 'compressed' : 'beautify',
    }))
    .pipe(rename((file) => {
      file.basename += '.bundle';

      // Track the full output path
      const fullPath = path.resolve(output, `${file.basename}${file.extname}`);
      compiled[fullPath] = true;
    }))
    .pipe(dest(output, { sourcemaps: '.' }))
    // .pipe(dest(output))
    .on('end', () => {
      // Log
      logger.log('Finished!');

      // Trigger rebuild
      Manager.triggerRebuild(compiled, logger);

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
  watch(input, { delay: delay, dot: true }, sass)
  .on('change', (path) => {
    logger.log(`[watcher] File changed (${path})`);
  });

  // Complete
  return complete();
}

function generatePageScss() {
  // Get all JS files
  const files = glob(input).map((f) => path.resolve(f));

  // Create a map to store the pages
  const pagesMap = {};

  // Log files
  // logger.log('Found files:', files);

  files.forEach((file) => {
    // Skip if it's not a page partial
    if (!isPagePartial(file)) {
      return;
    };

    // Extract the page slug from the file path
    const dir = path.dirname(file);
    const parts = dir.split(path.sep);
    let pageSlug = path.basename(dir);

    // Detect homepage: pages/index.scss
    if (pageSlug === 'pages' && file.endsWith('pages/index.scss')) {
      pageSlug = '/';
    } else {
      if (!pageSlug.startsWith('/')) {
        pageSlug = `/${pageSlug}`;
      }
    }

    // Determine if the file is from the main or project package
    const isMain = file.startsWith(rootPathPackage);
    const isProject = file.startsWith(rootPathProject);

    // Normalize the file path
    if (!pagesMap[pageSlug]) {
      pagesMap[pageSlug] = { main: null, project: null };
    }

    // Add the file to the main path
    if (isMain) {
      pagesMap[pageSlug].main = file;
    }

    // Add the file to the project path
    if (isProject) {
      pagesMap[pageSlug].project = file;
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
  Manager.triggerRebuild();
}

function isPagePartial(file) {
  return file.includes('/assets/css/pages/') && file.endsWith('index.scss');
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
module.exports = series(sass, sassWatcher);
