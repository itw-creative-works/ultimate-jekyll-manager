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
    await migrateBlogImages();
    await fixPostsLayout();
    await fixPostFilenames();
    await cleanupOldDirectories();
    await cleanupDeprecatedAuthors();

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

  logger.log(`Migrating _posts from root to src/...`);

  // Get all files recursively from source (not directories)
  const sourceFiles = jetpack.find(sourcePath, { matching: '**/*', directories: false }) || [];

  if (sourceFiles.length === 0) {
    logger.log('No files found in _posts directory');
    jetpack.remove(sourcePath);
    return;
  }

  let movedCount = 0;
  let overwrittenCount = 0;

  // Just move everything, overwrite if needed
  sourceFiles.forEach((sourceFile) => {
    const relativePath = path.relative(sourcePath, sourceFile);
    const targetFile = path.join(targetPath, relativePath);

    // Check if target exists
    const targetExists = jetpack.exists(targetFile);

    // Ensure parent directory exists
    jetpack.dir(path.dirname(targetFile));

    // Move the file (this overwrites if target exists)
    jetpack.move(sourceFile, targetFile, { overwrite: true });

    if (targetExists) {
      overwrittenCount++;
      logger.log(`  ✓ Overwrote: ${relativePath}`);
    } else {
      movedCount++;
      logger.log(`  ✓ Moved: ${relativePath}`);
    }
  });

  // Remove the source directory
  jetpack.remove(sourcePath);

  logger.log(logger.format.green(`✓ Successfully migrated _posts: ${movedCount} moved, ${overwrittenCount} overwritten`));
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
    logger.log(`Target directory ${targetPath} already exists - will merge contents...`);

    // Get all files recursively from source (not directories)
    const sourceFiles = jetpack.find(sourcePath, { matching: '**/*', directories: false }) || [];

    let movedCount = 0;
    let identicalCount = 0;
    const conflicts = [];

    // First pass: check for conflicts
    sourceFiles.forEach((sourceFile) => {
      const relativePath = path.relative(sourcePath, sourceFile);
      const targetFile = path.join(targetPath, relativePath);

      // Only care about file conflicts, not directory existence
      if (jetpack.exists(targetFile) === 'file') {
        // Check if files are identical
        const sourceStats = jetpack.inspect(sourceFile);
        const targetStats = jetpack.inspect(targetFile);

        // Compare file sizes first (faster than reading content)
        if (sourceStats.size !== targetStats.size) {
          // Different sizes, definitely a conflict
          conflicts.push(relativePath);
        } else {
          // Same size, need to compare content for small files
          if (sourceStats.size < 1024 * 1024) { // Less than 1MB
            const sourceContent = jetpack.read(sourceFile, 'buffer');
            const targetContent = jetpack.read(targetFile, 'buffer');

            if (Buffer.compare(sourceContent, targetContent) !== 0) {
              // Files differ - this is a real conflict
              conflicts.push(relativePath);
            }
          }
          // For large files with same size, we assume they're identical
        }
      }
    });

    // If we have actual file conflicts, throw error
    if (conflicts.length > 0) {
      logger.error(`Found ${conflicts.length} conflicting file(s) with different content:`);
      conflicts.slice(0, 10).forEach((file) => logger.error(`  - ${file}`));
      if (conflicts.length > 10) {
        logger.error(`  ... and ${conflicts.length - 10} more`);
      }
      throw new Error('Cannot migrate assets: duplicate files with different content detected. Please resolve manually.');
    }

    // No conflicts, proceed with migration
    sourceFiles.forEach((sourceFile) => {
      const relativePath = path.relative(sourcePath, sourceFile);
      const targetFile = path.join(targetPath, relativePath);

      if (jetpack.exists(targetFile) === 'file') {
        // Files are identical (we checked above), just remove source
        jetpack.remove(sourceFile);
        identicalCount++;
        logger.log(`  ✓ Skipped identical file: ${relativePath}`);
      } else {
        // No file conflict, move it (directory will be created if needed)
        jetpack.dir(path.dirname(targetFile));
        jetpack.move(sourceFile, targetFile);
        movedCount++;
        logger.log(`  ✓ Moved: ${relativePath}`);
      }
    });

    // Clean up empty directories in source
    const remainingItems = jetpack.list(sourcePath) || [];
    if (remainingItems.length === 0) {
      jetpack.remove(sourcePath);
      logger.log(`  ✓ Removed empty source directory`);
    } else {
      // Try to clean up empty subdirectories
      const remainingDirs = jetpack.find(sourcePath, { matching: '*/', directories: true, files: false }) || [];
      remainingDirs.reverse().forEach((dir) => {
        const contents = jetpack.list(dir) || [];
        if (contents.length === 0) {
          jetpack.remove(dir);
        }
      });

      // Check again if root is empty
      const finalCheck = jetpack.list(sourcePath) || [];
      if (finalCheck.length === 0) {
        jetpack.remove(sourcePath);
        logger.log(`  ✓ Removed empty source directory after cleanup`);
      }
    }

    logger.log(logger.format.green(`✓ Successfully merged assets: ${movedCount} moved, ${identicalCount} identical files skipped`));
  } else {
    // Simple move when target doesn't exist
    logger.log(`Migrating assets from root to src/...`);
    logger.log(`  Source: ${sourcePath}`);
    logger.log(`  Target: ${targetPath}`);

    // Ensure target directory parent exists
    jetpack.dir(path.dirname(targetPath));

    // Move the directory
    jetpack.move(sourcePath, targetPath);

    // Verify the move
    const moveSuccessful = jetpack.exists(targetPath) && !jetpack.exists(sourcePath);

    if (moveSuccessful) {
      logger.log(logger.format.green('✓ Successfully migrated assets to src/assets'));
    } else {
      throw new Error('Failed to migrate assets directory');
    }
  }
}

async function migrateBlogImages() {
  const sourcePath = path.join(process.cwd(), 'src', 'assets', '_src', 'images', 'blog', 'posts');
  const targetPath = path.join(process.cwd(), 'src', 'assets', 'images', 'blog');

  if (!jetpack.exists(sourcePath)) {
    logger.log('No src/assets/_src/images/blog/posts directory found - skipping blog images migration');
    return;
  }

  logger.log('Migrating blog images to src/assets/images/blog...');

  // Ensure target directory exists
  jetpack.dir(targetPath);

  // Copy contents (overwrite) then remove source
  jetpack.copy(sourcePath, targetPath, { overwrite: true });
  jetpack.remove(sourcePath);

  logger.log(logger.format.green('✓ Blog images migrated'));
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

    // 2. Change excerpt to description (handles both root level and nested under post:)
    if (frontmatter.includes('excerpt:')) {
      frontmatter = frontmatter.replace(
        /^(\s*)excerpt:/gm,
        '$1description:'
      );
      modified = true;
    }

    // 3. Remove affiliate-search-term line
    if (frontmatter.includes('affiliate-search-term:')) {
      frontmatter = frontmatter.replace(
        /^(\s*)affiliate-search-term:.*\r?\n/m,
        ''
      );
      modified = true;
    }

    // 4. Migrate post.author from old format to new format (first-last)
    const alexAuthors = ['alex-raeburn', 'rare-ivy', 'christina-hill'];
    const authorMigrations = {
      'alex': () => alexAuthors[Math.floor(Math.random() * alexAuthors.length)],
      'ian': () => 'ian-wiedenman',
    };

    Object.entries(authorMigrations).forEach(([oldAuthor, getNewAuthor]) => {
      const authorRegex = new RegExp(`^(\\s*author:\\s*)(['"]?)${oldAuthor}\\2\\s*$`, 'gm');
      if (frontmatter.match(authorRegex)) {
        frontmatter = frontmatter.replace(authorRegex, `$1${getNewAuthor()}`);
        modified = true;
      }
    });

    // 5. Remove ad unit includes from content
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

async function cleanupOldDirectories() {
  const directoriesToCheck = [
    { path: path.join(process.cwd(), 'assets'), name: 'assets' },
    { path: path.join(process.cwd(), '_posts'), name: '_posts' },
    { path: path.join(process.cwd(), 'src', 'assets', '_src'), name: 'src/assets/_src' },
  ];

  logger.log('Checking for empty old directories to clean up...');

  let deletedCount = 0;

  directoriesToCheck.forEach(({ path: dirPath, name }) => {
    // Check if directory exists
    const exists = jetpack.exists(dirPath);

    if (!exists) {
      return;
    }

    // Check if directory has any FILES (not just subdirectories)
    const files = jetpack.find(dirPath, { matching: '**/*', directories: false }) || [];

    if (files.length === 0) {
      // Directory has no files (might have empty subdirectories), delete it
      jetpack.remove(dirPath);
      logger.log(`  ✓ Deleted empty ${name} directory`);
      deletedCount++;
    } else {
      logger.warn(`  ⚠ ${name} directory still exists with ${files.length} file(s)`);
      logger.warn(`    Please manually review: ${dirPath}`);
    }
  });

  if (deletedCount > 0) {
    logger.log(logger.format.green(`✓ Cleaned up ${deletedCount} empty director${deletedCount === 1 ? 'y' : 'ies'}`));
  } else {
    logger.log('No empty directories to clean up');
  }
}

async function cleanupDeprecatedAuthors() {
  // Deprecated author directories that used first-name only format
  const deprecatedAuthors = ['ian', 'alex'];

  const directoriesToDelete = deprecatedAuthors.map((author) => ({
    path: path.join(process.cwd(), 'src', 'assets', 'images', 'team', author),
    name: `team/${author}`,
  }));

  logger.log('Checking for deprecated author directories to remove...');

  let deletedCount = 0;

  directoriesToDelete.forEach(({ path: dirPath, name }) => {
    const exists = jetpack.exists(dirPath);

    if (!exists) {
      return;
    }

    // Delete the directory and all its contents
    jetpack.remove(dirPath);
    logger.log(`  ✓ Deleted deprecated ${name} directory`);
    deletedCount++;
  });

  if (deletedCount > 0) {
    logger.log(logger.format.green(`✓ Removed ${deletedCount} deprecated author director${deletedCount === 1 ? 'y' : 'ies'}`));
  } else {
    logger.log('No deprecated author directories found');
  }
}
