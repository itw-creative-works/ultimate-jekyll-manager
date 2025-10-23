// Libraries
const Manager = new (require('../build.js'));
const logger = Manager.logger('migrate');
const { execute } = require('node-powertools');
const path = require('path');
const jetpack = require('fs-jetpack');

// Load package
const package = Manager.getPackage('main');

module.exports = async function () {
  // Log
  logger.log(`Starting migration to Ultimate Jekyll v${package.version}...`);
  logger.log(`Current working directory: ${process.cwd()}`);

  try {
    // Run migration tasks
    await migratePosts();
    await migrateAssets();
    await fixPostsLayout();
    await fixPostFilenames();

    // Log completion
    logger.log(logger.format.green('✓ Migration complete!'));
  } catch (e) {
    logger.error('Migration failed:', e);
    throw e;
  }
};

async function migratePosts() {
  const sourcePath = path.join(process.cwd(), '_posts');
  const targetPath = path.join(process.cwd(), 'src', '_posts');

  // Check if _posts exists in root
  const sourceExists = jetpack.exists(sourcePath);

  if (!sourceExists) {
    logger.log('No _posts directory found in root - skipping posts migration');
    return;
  }

  // Check if target already exists
  const targetExists = jetpack.exists(targetPath);

  if (targetExists) {
    logger.warn(`Target directory ${targetPath} already exists!`);
    logger.log('Checking for conflicts...');

    // Get list of files in both directories
    const sourceFiles = jetpack.list(sourcePath) || [];
    const targetFiles = jetpack.list(targetPath) || [];

    // Find conflicts
    const conflicts = sourceFiles.filter((file) => targetFiles.includes(file));

    if (conflicts.length > 0) {
      logger.warn(`Found ${conflicts.length} conflicting file(s):`);
      conflicts.forEach((file) => logger.warn(`  - ${file}`));
      throw new Error('Cannot migrate _posts: conflicts detected. Please resolve manually.');
    }
  }

  // Log the migration
  logger.log(`Migrating _posts from root to src/...`);
  logger.log(`  Source: ${sourcePath}`);
  logger.log(`  Target: ${targetPath}`);

  // Ensure target directory exists
  jetpack.dir(path.dirname(targetPath));

  // Move the directory
  jetpack.move(sourcePath, targetPath);

  // Verify the move
  const moveSuccessful = jetpack.exists(targetPath)
    && !jetpack.exists(sourcePath);

  if (moveSuccessful) {
    logger.log(logger.format.green('✓ Successfully migrated _posts to src/_posts'));
  } else {
    throw new Error('Failed to migrate _posts directory');
  }
}

async function migrateAssets() {
  const sourcePath = path.join(process.cwd(), 'assets');
  const targetPath = path.join(process.cwd(), 'src', 'assets');

  // Check if assets exists in root
  const sourceExists = jetpack.exists(sourcePath);

  if (!sourceExists) {
    logger.log('No assets directory found in root - skipping assets migration');
    return;
  }

  // Check if target already exists
  const targetExists = jetpack.exists(targetPath);

  if (targetExists) {
    logger.warn(`Target directory ${targetPath} already exists!`);
    logger.log('Merging assets directories...');

    // Get list of files in both directories (recursively)
    const sourceFiles = jetpack.find(sourcePath, { matching: '**/*' }) || [];
    const targetFiles = jetpack.find(targetPath, { matching: '**/*' }) || [];

    // Convert to relative paths for comparison
    const sourceRelative = sourceFiles.map((f) => path.relative(sourcePath, f));
    const targetRelative = targetFiles.map((f) => path.relative(targetPath, f));

    // Find conflicts
    const conflicts = sourceRelative.filter((file) => targetRelative.includes(file));

    if (conflicts.length > 0) {
      logger.warn(`Found ${conflicts.length} conflicting file(s):`);
      conflicts.slice(0, 10).forEach((file) => logger.warn(`  - ${file}`));
      if (conflicts.length > 10) {
        logger.warn(`  ... and ${conflicts.length - 10} more`);
      }
      throw new Error('Cannot migrate assets: conflicts detected. Please resolve manually.');
    }

    // Move all files from source to target
    logger.log('Moving files...');
    sourceRelative.forEach((file) => {
      const src = path.join(sourcePath, file);
      const dest = path.join(targetPath, file);

      // Only move files, not directories
      if (jetpack.exists(src) === 'file') {
        jetpack.move(src, dest);
      }
    });

    // Remove the old assets directory
    jetpack.remove(sourcePath);

    logger.log(logger.format.green('✓ Successfully merged assets into src/assets'));
  } else {
    // Log the migration
    logger.log(`Migrating assets from root to src/...`);
    logger.log(`  Source: ${sourcePath}`);
    logger.log(`  Target: ${targetPath}`);

    // Ensure target directory parent exists
    jetpack.dir(path.dirname(targetPath));

    // Move the directory
    jetpack.move(sourcePath, targetPath);

    // Verify the move
    const moveSuccessful = jetpack.exists(targetPath)
      && !jetpack.exists(sourcePath);

    if (moveSuccessful) {
      logger.log(logger.format.green('✓ Successfully migrated assets to src/assets'));
    } else {
      throw new Error('Failed to migrate assets directory');
    }
  }
}

async function fixPostsLayout() {
  const postsPath = path.join(process.cwd(), 'src', '_posts');

  // Check if posts directory exists
  const postsExists = jetpack.exists(postsPath);

  if (!postsExists) {
    logger.log('No src/_posts directory found - skipping layout fix');
    return;
  }

  // Get all post files
  const postFiles = jetpack.find(postsPath, {
    matching: ['*.md', '*.html', '*.markdown'],
  }) || [];

  if (postFiles.length === 0) {
    logger.log('No post files found in src/_posts - skipping layout fix');
    return;
  }

  // Log
  logger.log(`Fixing ${postFiles.length} post file(s)...`);

  let updatedCount = 0;

  // Process each post file
  postFiles.forEach((file) => {
    const content = jetpack.read(file);

    if (!content) {
      return;
    }

    // Match frontmatter
    const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      logger.warn(`  Skipping ${path.basename(file)} - no frontmatter found`);
      return;
    }

    let frontmatter = match[1];
    let restOfContent = content.slice(match[0].length);
    let modified = false;

    // 1. Fix layout if needed
    if (!frontmatter.includes('layout: blueprint/blog/post')) {
      frontmatter = frontmatter.replace(
        /^layout:\s*.+$/m,
        'layout: blueprint/blog/post'
      );
      modified = true;
    }

    // 2. Change excerpt to description
    if (frontmatter.includes('excerpt:')) {
      frontmatter = frontmatter.replace(
        /^excerpt:/m,
        'description:'
      );
      modified = true;
    }

    // 3. Remove affiliate-search-term line
    if (frontmatter.includes('affiliate-search-term:')) {
      frontmatter = frontmatter.replace(
        /^affiliate-search-term:.*\r?\n/m,
        ''
      );
      modified = true;
    }

    // 4. Remove ad unit includes from content
    const adUnitRegex = /{%\s*include\s+\/master\/modules\/adunits\/adsense-in-article\.html\s+index="[^"]*"\s*%}/g;
    const cleanedContent = restOfContent.replace(adUnitRegex, '');

    if (cleanedContent !== restOfContent) {
      restOfContent = cleanedContent;
      modified = true;
    }

    // Only write if modifications were made
    if (!modified) {
      return;
    }

    // Write back to file
    const updatedContent = `---\n${frontmatter}\n---${restOfContent}`;
    jetpack.write(file, updatedContent);

    updatedCount++;
    logger.log(`  ✓ Updated ${path.basename(file)}`);
  });

  if (updatedCount > 0) {
    logger.log(logger.format.green(`✓ Fixed ${updatedCount} post file(s)`));
  } else {
    logger.log('All posts are already up to date');
  }
}

async function fixPostFilenames() {
  const postsPath = path.join(process.cwd(), 'src', '_posts');

  // Check if posts directory exists
  const postsExists = jetpack.exists(postsPath);

  if (!postsExists) {
    logger.log('No src/_posts directory found - skipping filename fix');
    return;
  }

  // Get all post files
  const postFiles = jetpack.find(postsPath, {
    matching: ['*.md', '*.html', '*.markdown'],
  }) || [];

  if (postFiles.length === 0) {
    logger.log('No post files found in src/_posts - skipping filename fix');
    return;
  }

  // Log
  logger.log(`Checking post filenames for trailing and leading dashes...`);

  let renamedCount = 0;

  // Process each post file
  postFiles.forEach((file) => {
    const dir = path.dirname(file);
    const basename = path.basename(file);
    const ext = path.extname(basename);
    const nameWithoutExt = basename.slice(0, -ext.length);

    // Remove leading and trailing dashes only
    const cleanedName = nameWithoutExt.replace(/^-+|-+$/g, '');

    // Check if name changed
    if (cleanedName === nameWithoutExt) {
      return;
    }

    // Build new filename
    const newFilename = `${cleanedName}${ext}`;
    const newPath = path.join(dir, newFilename);

    // Check if target already exists
    if (jetpack.exists(newPath)) {
      logger.warn(`  Cannot rename ${basename} - ${newFilename} already exists`);
      return;
    }

    // Rename the file
    jetpack.move(file, newPath);

    renamedCount++;
    logger.log(`  ✓ Renamed ${basename} → ${newFilename}`);
  });

  if (renamedCount > 0) {
    logger.log(logger.format.green(`✓ Renamed ${renamedCount} post file(s)`));
  } else {
    logger.log('All post filenames are already clean');
  }
}
