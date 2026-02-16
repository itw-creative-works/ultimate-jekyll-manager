// GitHub Cache Utility
// Shared functions for managing cached data in GitHub branches

const path = require('path');
const jetpack = require('fs-jetpack');
const crypto = require('crypto');
const { Octokit } = require('@octokit/rest');
const AdmZip = require('adm-zip');
const detectGitHubRepository = require('./detect-github-repo');

class GitHubCache {
  constructor(options = {}) {
    this.branchName = options.branchName || 'cache-branch';
    this.cacheDir = options.cacheDir || '.temp/cache';
    this.logger = options.logger || console;
    this.octokit = null;
    this.owner = null;
    this.repo = null;
    this.cacheType = options.cacheType || 'Cache'; // For README generation
    this.description = options.description || 'cached files for faster builds';
  }

  // Initialize GitHub API client
  async init() {
    // Ensure GH_TOKEN is set
    if (!process.env.GH_TOKEN) {
      throw new Error('GH_TOKEN environment variable not set');
    }

    // Auto-detect repository if not set
    const repository = await detectGitHubRepository(this.logger);

    // Final check
    if (!repository) {
      throw new Error('GITHUB_REPOSITORY environment variable not set and could not auto-detect from git remote');
    }

    // Set owner and repo
    [this.owner, this.repo] = repository.split('/');

    // Initialize Octokit
    if (!this.octokit) {
      this.octokit = new Octokit({
        auth: process.env.GH_TOKEN,
      });
    }

    return true;
  }

  // Check if credentials are available
  hasCredentials() {
    return !!process.env.GH_TOKEN;
  }

  // Fetch cache branch from GitHub
  async fetchBranch() {
    await this.init();

    this.logger.log(`📥 Fetching cache from branch '${this.branchName}'`);

    // Check if the branch exists
    let branchExists = false;
    try {
      await this.octokit.repos.getBranch({
        owner: this.owner,
        repo: this.repo,
        branch: this.branchName
      });
      branchExists = true;
    } catch (e) {
      if (e.status !== 404) throw e;
    }

    if (!branchExists) {
      this.logger.warn(`⚠️ Cache branch '${this.branchName}' does not exist. Will create on first push.`);
      return false;
    }

    // Download branch as ZIP archive
    const zipBallArchive = await this.octokit.repos.downloadZipballArchive({
      owner: this.owner,
      repo: this.repo,
      ref: this.branchName,
    });

    // Save and extract ZIP
    const zipPath = path.join(path.dirname(this.cacheDir), `${this.repo}-${this.branchName}.zip`);
    const extractDir = path.dirname(this.cacheDir);

    jetpack.write(zipPath, Buffer.from(zipBallArchive.data));

    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractDir, true);

    // Find extracted root folder - just look for the directory that was extracted
    // GitHub zipball extracts to a single folder: {owner}-{repo}-{sha}
    const dirContents = jetpack.list(extractDir);
    const zipFileName = path.basename(zipPath);

    this.logger.log(`📦 Zip file: ${zipFileName}`);
    this.logger.log(`📂 Extract directory: ${extractDir}`);
    this.logger.log(`📁 Directory contents: ${JSON.stringify(dirContents)}`);
    this.logger.log(`🔍 Debug - this.owner: ${this.owner}, this.repo: ${this.repo}`);
    this.logger.log(`🔍 Debug - GITHUB_REPOSITORY env: ${process.env.GITHUB_REPOSITORY}`);

    // GitHub zipball format: {owner}-{repo}-{sha}
    // After repo renames, the folder may use the old repo name, so match any
    // directory starting with the owner and ending with a hex commit SHA
    const githubZipPattern = new RegExp(`^${this.owner}-.+-[a-f0-9]{7,40}$`, 'i');
    this.logger.log(`🔍 Debug - Pattern being used: ${githubZipPattern}`);

    const extractedRoot = dirContents.find(name => {
      const fullPath = path.join(extractDir, name);
      const isDir = jetpack.exists(fullPath) === 'dir';
      const isNotZip = name !== zipFileName;
      const matchesGitHubPattern = githubZipPattern.test(name);
      this.logger.log(`   - ${name}: isDir=${isDir}, isNotZip=${isNotZip}, matchesGitHubPattern=${matchesGitHubPattern}`);
      return isNotZip && isDir && matchesGitHubPattern;
    });

    this.logger.log(`✅ Found extracted root: ${extractedRoot || 'NONE'}`);

    if (!extractedRoot) {
      throw new Error(`Could not find extracted archive folder in: ${JSON.stringify(dirContents)}`);
    }

    const extractedFullPath = path.join(extractDir, extractedRoot);
    const targetPath = this.cacheDir;

    // Move to target location
    if (jetpack.exists(targetPath)) {
      jetpack.remove(targetPath);
    }
    jetpack.move(extractedFullPath, targetPath);

    // Clean up
    jetpack.remove(zipPath);

    // Log what was fetched
    const fetchedFiles = jetpack.find(targetPath, { matching: '**/*', files: true, directories: false });
    this.logger.log(`✅ Fetched cache from branch '${this.branchName}' (${fetchedFiles.length} files total)`);

    return true;
  }

  // Push files to cache branch with automatic orphan detection
  async pushBranch(updatedFiles, options = {}) {
    await this.init();

    // Git is required
    this.requireGitCommands();

    // Convert Set to array if needed
    let files = Array.isArray(updatedFiles) ? updatedFiles : [...updatedFiles];

    // Auto-add metadata file if it exists and not already included
    const metaPath = path.join(this.cacheDir, 'meta.json');
    if (jetpack.exists(metaPath) && !files.includes(metaPath)) {
      files.push(metaPath);
    }

    // Handle orphan detection if validFiles provided
    let forceRecreate = options.forceRecreate || false;
    if (options.validFiles) {
      const orphanCheck = await this.checkForOrphans(options.validFiles);
      if (orphanCheck.hasOrphans) {
        this.logger.log(`🗑️ Found ${orphanCheck.orphanedCount} orphaned files in cache, removing...`);
        // Delete orphaned files locally — git add -A will pick up the deletions
        for (const orphan of orphanCheck.orphanedFiles) {
          jetpack.remove(path.join(this.cacheDir, orphan));
        }
        this.logger.log(`✅ Removed ${orphanCheck.orphanedCount} orphaned files`);
      }
    }

    this.logger.log(`📤 Pushing ${files.length} file(s) to cache branch '${this.branchName}'`);

    // Generate README if stats provided
    const readme = options.stats ? this.generateReadme(options.stats) :
                   options.branchReadme || this.generateDefaultReadme();

    // If forceRecreate is true, we'll handle it in uploadFilesViaGit
    if (forceRecreate) {
      this.logger.log(`🔄 Force recreating cache branch with clean files...`);
      const uploadedCount = await this.uploadFilesViaGit(files, true, readme);
      this.logger.log(`🎉 Recreated cache branch with ${uploadedCount} file(s)`);
      return uploadedCount;
    } else {
      // Normal update
      await this.ensureBranchExists(readme);
      const uploadedCount = await this.uploadFilesViaGit(files, false, readme);

      if (uploadedCount > 0) {
        this.logger.log(`🎉 Pushed ${uploadedCount} file(s) to cache branch`);
      }
      return uploadedCount;
    }
  }

  // Delete a branch
  async deleteBranch(branchName = null) {
    const branch = branchName || this.branchName;
    try {
      this.logger.log(`🗑️ Deleting branch '${branch}'...`);
      await this.octokit.git.deleteRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${branch}`
      });
      this.logger.log(`✅ Deleted branch '${branch}'`);
      return true;
    } catch (e) {
      if (e.status === 404) {
        this.logger.log(`⚠️ Branch '${branch}' doesn't exist, nothing to delete`);
        return false;
      }
      throw e;
    }
  }

  // Replace one branch with another (safe atomic operation)
  async replaceBranch(sourceBranch, targetBranch) {
    try {
      // Get source branch SHA with retries (in case it was just created via git push)
      let source;
      let retries = 5;
      const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

      while (retries > 0) {
        try {
          const result = await this.octokit.git.getRef({
            owner: this.owner,
            repo: this.repo,
            ref: `heads/${sourceBranch}`
          });
          source = result.data;
          break;
        } catch (e) {
          if (e.status === 404 && retries > 1) {
            // Branch might not be synced yet, wait and retry
            this.logger.log(`⏳ Waiting for branch '${sourceBranch}' to sync (${retries - 1} retries left)...`);
            await delay(2000);
            retries--;
          } else {
            throw e;
          }
        }
      }

      // Try to update target branch to source SHA
      try {
        await this.octokit.git.updateRef({
          owner: this.owner,
          repo: this.repo,
          ref: `heads/${targetBranch}`,
          sha: source.object.sha,
          force: true
        });
        this.logger.log(`✅ Replaced '${targetBranch}' with '${sourceBranch}'`);
      } catch (e) {
        if (e.status === 422) {
          // Target doesn't exist, create it
          await this.octokit.git.createRef({
            owner: this.owner,
            repo: this.repo,
            ref: `refs/heads/${targetBranch}`,
            sha: source.object.sha
          });
          this.logger.log(`✅ Created '${targetBranch}' from '${sourceBranch}'`);
        } else {
          throw e;
        }
      }

      // Delete source branch
      await this.deleteBranch(sourceBranch);
      return true;
    } catch (error) {
      this.logger.error(`❌ Failed to replace branch: ${error.message}`);
      throw error;
    }
  }

  // Ensure branch exists, create if needed
  async ensureBranchExists(readmeContent) {
    let branchExists = false;

    try {
      await this.octokit.repos.getBranch({
        owner: this.owner,
        repo: this.repo,
        branch: this.branchName
      });
      branchExists = true;
    } catch (e) {
      if (e.status !== 404) throw e;
    }

    if (!branchExists) {
      this.logger.log(`📝 Creating new cache branch '${this.branchName}'`);

      // Default README content
      const content = readmeContent || `This branch stores cached data for faster builds\n`;

      // Create README blob
      const { data: blob } = await this.octokit.git.createBlob({
        owner: this.owner,
        repo: this.repo,
        content: content,
        encoding: 'utf-8'
      });

      // Create tree
      const { data: tree } = await this.octokit.git.createTree({
        owner: this.owner,
        repo: this.repo,
        tree: [{
          path: 'README.md',
          mode: '100644',
          type: 'blob',
          sha: blob.sha
        }]
      });

      // Create commit
      const { data: commit } = await this.octokit.git.createCommit({
        owner: this.owner,
        repo: this.repo,
        message: `Initial cache branch: ${this.branchName}`,
        tree: tree.sha,
        parents: []
      });

      // Create branch
      await this.octokit.git.createRef({
        owner: this.owner,
        repo: this.repo,
        ref: `refs/heads/${this.branchName}`,
        sha: commit.sha
      });

      this.logger.log(`✅ Created cache branch '${this.branchName}'`);
    }

    return branchExists;
  }



  // Load metadata file
  loadMetadata(metaPath) {
    let meta = {};

    if (jetpack.exists(metaPath)) {
      try {
        meta = jetpack.read(metaPath, 'json');
      } catch (e) {
        this.logger.warn('⚠️ Metadata file corrupted - starting fresh');
      }
    }

    return meta;
  }

  // Save metadata file
  saveMetadata(metaPath, meta) {
    jetpack.write(metaPath, meta);
  }

  // Clean deleted files from metadata
  cleanDeletedFromMetadata(meta, currentFiles, rootPath) {
    const currentFilesSet = new Set(currentFiles.map(f =>
      path.relative(rootPath, f)
    ));
    let removedCount = 0;

    Object.keys(meta).forEach(key => {
      if (!currentFilesSet.has(key)) {
        delete meta[key];
        this.logger.log(`🗑️ Removed deleted file from metadata: ${key}`);
        removedCount++;
      }
    });

    return removedCount;
  }

  // Check if git commands are available (required)
  requireGitCommands() {
    const { execSync } = require('child_process');
    try {
      execSync('git --version', { stdio: 'ignore' });
      return true;
    } catch (e) {
      throw new Error('Git is required but not available. Please ensure git is installed and in PATH.');
    }
  }

  // Upload files using git commands (much faster for multiple files)
  async uploadFilesViaGit(files, forceRecreate = false, readme = null) {
    const { execSync } = require('child_process');

    this.logger.log(`🚀 Using fast git upload for ${files.length} files`);

    try {
      // Work directly in the cache directory
      const gitDir = path.join(this.cacheDir, '.git');

      if (forceRecreate) {
        // For force recreate, remove git dir and init fresh
        this.logger.log(`🆕 Initializing fresh repository in ${this.cacheDir}...`);
        jetpack.remove(gitDir);
        execSync('git init', { cwd: this.cacheDir, stdio: 'ignore' });
        execSync(`git remote add origin https://${process.env.GH_TOKEN}@github.com/${this.owner}/${this.repo}.git`, { cwd: this.cacheDir, stdio: 'ignore' });
        execSync(`git checkout -b ${this.branchName}`, { cwd: this.cacheDir, stdio: 'ignore' });
      } else if (!jetpack.exists(gitDir)) {
        // No .git dir — init locally and fetch the branch ref so we can push incrementally
        // (files are already here from the ZIP fetch, no need to clone)
        this.logger.log(`📥 Initializing git in cache directory...`);
        execSync('git init', { cwd: this.cacheDir, stdio: 'ignore' });
        execSync(`git remote add origin https://${process.env.GH_TOKEN}@github.com/${this.owner}/${this.repo}.git`, { cwd: this.cacheDir, stdio: 'ignore' });

        // Fetch just the branch ref so git knows the remote history
        try {
          execSync(`git fetch --depth 1 origin ${this.branchName}`, { cwd: this.cacheDir, stdio: 'ignore' });
          execSync(`git checkout -b ${this.branchName}`, { cwd: this.cacheDir, stdio: 'ignore' });
          // Reset to the fetched ref to establish history, then overlay our files
          execSync(`git reset origin/${this.branchName}`, { cwd: this.cacheDir, stdio: 'ignore' });
        } catch (e) {
          // Branch might not exist yet remotely — just create it locally
          execSync(`git checkout -b ${this.branchName}`, { cwd: this.cacheDir, stdio: 'ignore' });
        }
      } else {
        // Git dir exists, just pull latest
        this.logger.log(`📥 Pulling latest changes...`);
        try {
          execSync('git fetch origin ' + this.branchName, { cwd: this.cacheDir, stdio: 'ignore' });
          execSync('git reset --hard origin/' + this.branchName, { cwd: this.cacheDir, stdio: 'ignore' });
        } catch (e) {
          // If pull fails, continue anyway - we'll force push if needed
          this.logger.warn('⚠️ Pull failed, will force push if needed');
        }
      }

      // Add README if provided
      let readmeChanged = false;
      if (readme) {
        const readmePath = path.join(this.cacheDir, 'README.md');
        const existingReadme = jetpack.exists(readmePath) ? jetpack.read(readmePath) : '';

        if (existingReadme !== readme) {
          this.logger.log('📝 README content has changed, updating...');
          readmeChanged = true;
        }

        jetpack.write(readmePath, readme);
      }

      // Check if there are changes
      const status = execSync('git status --porcelain', { cwd: this.cacheDir }).toString();
      if (!status.trim()) {
        this.logger.log('⏭️  No changes to commit (including README)');
        return 0;
      }

      // Log what changed
      const changedFiles = status.trim().split('\n').length;
      if (readmeChanged && changedFiles === 1) {
        this.logger.log('📄 Only README.md has changed, committing update...');
      } else if (readmeChanged) {
        this.logger.log(`📄 README.md and ${changedFiles - 1} cache files have changed`);
      } else {
        this.logger.log(`📝 ${changedFiles} files have changed`);
      }

      // Add all changes
      this.logger.log(`📝 Staging changes...`);
      execSync('git add -A', { cwd: this.cacheDir, stdio: 'ignore' });

      // Create commit message based on what changed
      let commitMessage;
      if (readmeChanged && changedFiles === 1) {
        commitMessage = '📊 Update cache statistics in README';
      } else if (readmeChanged) {
        commitMessage = `📦 Update cache: ${changedFiles - 1} files + README stats`;
      } else {
        commitMessage = `📦 Update cache: ${changedFiles} files`;
      }

      // Commit
      execSync(
        `git -c user.name="GitHub Actions" -c user.email="actions@github.com" commit -m "${commitMessage}"`,
        { cwd: this.cacheDir, stdio: 'ignore' }
      );

      // Push
      this.logger.log(`📤 Pushing to GitHub...`);
      try {
        execSync('git push origin ' + this.branchName, { cwd: this.cacheDir, stdio: 'ignore' });
      } catch (e) {
        // If normal push fails, try force push
        this.logger.warn('⚠️ Normal push failed, attempting force push...');
        execSync('git push --force origin ' + this.branchName, { cwd: this.cacheDir, stdio: 'ignore' });
      }

      return changedFiles;
    } catch (error) {
      this.logger.error(`❌ Git command failed: ${error.message}`);
      throw error; // No fallback - git is required
    }
  }

  // Check for orphaned files in cache
  async checkForOrphans(validFiles) {
    const validSet = new Set(validFiles);
    const cacheFiles = jetpack.find(this.cacheDir, {
      matching: ['**/*', '!.git/**'],
      files: true,
      directories: false
    });

    const orphanedFiles = [];
    const validCacheFiles = [];

    cacheFiles.forEach(file => {
      const relativePath = path.relative(this.cacheDir, file);
      if (validSet.has(relativePath) || relativePath === 'meta.json' || relativePath === 'README.md') {
        validCacheFiles.push(file);
      } else {
        orphanedFiles.push(relativePath);
        if (process.env.UJ_LOUD_LOGS === 'true') {
          this.logger.log(`  - Orphaned: ${relativePath}`);
        }
      }
    });

    return {
      hasOrphans: orphanedFiles.length > 0,
      orphanedCount: orphanedFiles.length,
      validFiles: validCacheFiles,
      orphanedFiles
    };
  }

  // Generate default README
  generateDefaultReadme() {
    return `# ${this.cacheType} Cache Branch

This branch stores ${this.description}.

---
*Generated automatically by build process*
`;
  }

  // Generate README with stats
  generateReadme(stats = {}) {
    const date = new Date(stats.timestamp || Date.now());
    const formattedDate = date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    let readme = `# ${this.cacheType} Cache Branch

This branch stores ${this.description}.

## Cache Information

- **Last Updated:** ${formattedDate}
`;

    // Add custom stats
    if (stats.sourceCount !== undefined) {
      readme += `- **Source Files:** ${stats.sourceCount}\n`;
    }
    if (stats.cachedCount !== undefined) {
      readme += `- **Cached Files:** ${stats.cachedCount}\n`;
    }

    // Add timing information if provided
    if (stats.timing) {
      const { startTime, endTime, elapsedMs } = stats.timing;
      const elapsedFormatted = this.formatElapsedTime(elapsedMs);
      readme += `
## Timing Information

- **Start Time:** ${new Date(startTime).toLocaleTimeString()}
- **End Time:** ${new Date(endTime).toLocaleTimeString()}
- **Total Elapsed:** ${elapsedFormatted}
`;
    }

    // Add last run stats if provided
    if (stats.processedNow !== undefined || stats.fromCache !== undefined || stats.newlyProcessed !== undefined) {
      readme += `
## Last Run Statistics

- **Total Files Processed:** ${stats.processedNow || 0}
- **Files From Cache:** ${stats.fromCache || 0}
- **Newly Processed:** ${stats.newlyProcessed || 0}
`;

      // Add percentage if both values exist
      if (stats.processedNow && stats.fromCache !== undefined) {
        const cacheRate = ((stats.fromCache / stats.processedNow) * 100).toFixed(1);
        readme += `- **Cache Hit Rate:** ${cacheRate}%\n`;
      }
    }

    // Add language breakdown for translation
    if (stats.languageBreakdown && stats.languageBreakdown.length > 0) {
      readme += `
## Language Breakdown

`;
      stats.languageBreakdown.forEach(lang => {
        const cacheRate = lang.total > 0 ? ((lang.fromCache / lang.total) * 100).toFixed(1) : 0;
        readme += `### ${lang.language.toUpperCase()}\n`;
        readme += `- **Total Files:** ${Math.round(lang.total)}\n`;
        readme += `- **From Cache:** ${lang.fromCache} (${cacheRate}%)\n`;
        readme += `- **Newly Translated:** ${lang.newlyTranslated}\n`;
        if (lang.failed > 0) {
          readme += `- **Failed:** ${lang.failed}\n`;
        }
        readme += '\n';
      });
    }

    // Add token usage and costs for translation
    if (stats.tokenUsage) {
      const { inputTokens, outputTokens, totalTokens, inputCost, outputCost, totalCost } = stats.tokenUsage;
      readme += `
## Token Usage & Costs

- **Input Tokens:** ${(inputTokens || 0).toLocaleString()}
- **Output Tokens:** ${(outputTokens || 0).toLocaleString()}
- **Total Tokens:** ${(totalTokens || 0).toLocaleString()}

### Cost Breakdown
- **Input Cost:** $${(inputCost || 0).toFixed(4)}
- **Output Cost:** $${(outputCost || 0).toFixed(4)}
- **Total Cost:** $${(totalCost || 0).toFixed(4)}
`;
    }

    // Add image optimization stats if provided
    if (stats.imageStats) {
      const { totalImages, optimized, skipped, totalSizeBefore, totalSizeAfter, totalSaved } = stats.imageStats;
      readme += `
## Image Optimization Statistics

- **Total Images:** ${totalImages || 0}
- **Optimized:** ${optimized || 0}
- **Skipped (from cache):** ${skipped || 0}
`;

      if (totalSizeBefore && totalSizeAfter) {
        const savedPercent = ((totalSaved / totalSizeBefore) * 100).toFixed(1);
        readme += `
### Size Reduction
- **Original Size:** ${this.formatBytes(totalSizeBefore)}
- **Optimized Size:** ${this.formatBytes(totalSizeAfter)}
- **Total Saved:** ${this.formatBytes(totalSaved)} (${savedPercent}%)
`;
      }
    }

    // Add custom details section if provided
    if (stats.details) {
      readme += `
## Details

${stats.details}
`;
    }

    readme += `
---
*Generated automatically by build process*
`;

    return readme;
  }

  // Helper to format elapsed time
  formatElapsedTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // Helper to format bytes
  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  // Calculate file hash
  calculateHash(filePath) {
    const content = jetpack.read(filePath, 'buffer');
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}

module.exports = GitHubCache;
