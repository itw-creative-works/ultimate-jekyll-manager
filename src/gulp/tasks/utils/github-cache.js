// GitHub Cache Utility
// Shared functions for managing cached data in GitHub branches

const path = require('path');
const jetpack = require('fs-jetpack');
const crypto = require('crypto');
const { Octokit } = require('@octokit/rest');
const AdmZip = require('adm-zip');

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
    if (!process.env.GH_TOKEN) {
      throw new Error('GH_TOKEN environment variable not set');
    }
    
    if (!process.env.GITHUB_REPOSITORY) {
      throw new Error('GITHUB_REPOSITORY environment variable not set');
    }

    [this.owner, this.repo] = process.env.GITHUB_REPOSITORY.split('/');
    
    if (!this.octokit) {
      this.octokit = new Octokit({
        auth: process.env.GH_TOKEN,
      });
    }

    return true;
  }

  // Check if credentials are available
  hasCredentials() {
    return !!(process.env.GH_TOKEN && process.env.GITHUB_REPOSITORY);
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

    // Find extracted root folder
    const extractedRoot = jetpack.list(extractDir).find(name => 
      name.startsWith(`${this.owner}-${this.repo}-`)
    );
    
    if (!extractedRoot) {
      throw new Error('Could not find extracted archive root folder');
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
        this.logger.log(`🗑️ Found ${orphanCheck.orphanedCount} orphaned files in cache`);
        forceRecreate = true;
        files = orphanCheck.validFiles;
        // Re-add metadata after orphan check
        if (jetpack.exists(metaPath) && !files.includes(metaPath)) {
          files.push(metaPath);
        }
      }
    }
    
    this.logger.log(`📤 Pushing ${files.length} file(s) to cache branch '${this.branchName}'`);

    // Generate README if stats provided
    const readme = options.stats ? this.generateReadme(options.stats) : 
                   options.branchReadme || this.generateDefaultReadme();

    // If forceRecreate is true, use safe replacement strategy
    if (forceRecreate) {
      const tempBranch = `${this.branchName}-temp-${Date.now()}`;
      const originalBranch = this.branchName;
      
      try {
        this.logger.log(`🔄 Creating temporary branch for safe replacement...`);
        
        // Temporarily use temp branch name
        this.branchName = tempBranch;
        
        // Create new branch with clean files
        await this.ensureBranchExists(readme);
        const uploadedCount = await this.uploadFilesViaGit(files, true, readme);
        
        // Restore original branch name
        this.branchName = originalBranch;
        
        // Atomically replace old branch with new one
        await this.replaceBranch(tempBranch, originalBranch);
        
        this.logger.log(`🎉 Safely replaced cache branch with ${uploadedCount} file(s)`);
        return uploadedCount;
      } catch (error) {
        // Restore original branch name
        this.branchName = originalBranch;
        
        // Try to clean up temp branch if it exists
        try {
          await this.deleteBranch(tempBranch);
        } catch (e) {
          // Ignore cleanup errors
        }
        
        this.logger.error(`❌ Failed to recreate cache branch, original remains intact`);
        throw error;
      }
    } else {
      // Normal update
      await this.ensureBranchExists(readme);
      const uploadedCount = await this.uploadFilesViaGit(files, false, readme);
      
      this.logger.log(`🎉 Pushed ${uploadedCount} file(s) to cache branch`);
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
    const tempDir = path.join(this.cacheDir, '../git-temp');
    
    this.logger.log(`🚀 Using fast git upload for ${files.length} files`);
    
    try {
      // Clean and create temp directory
      jetpack.remove(tempDir);
      jetpack.dir(tempDir);
      
      if (forceRecreate) {
        // For force recreate, just init a new repo
        this.logger.log(`🆕 Initializing fresh repository...`);
        execSync('git init', { cwd: tempDir, stdio: 'ignore' });
        execSync(`git remote add origin https://${process.env.GH_TOKEN}@github.com/${this.owner}/${this.repo}.git`, { cwd: tempDir, stdio: 'ignore' });
        execSync(`git checkout -b ${this.branchName}`, { cwd: tempDir, stdio: 'ignore' });
      } else {
        // Clone the branch (shallow clone for speed)
        this.logger.log(`📥 Cloning cache branch...`);
        execSync(
          `git clone --depth 1 --branch ${this.branchName} https://${process.env.GH_TOKEN}@github.com/${this.owner}/${this.repo}.git .`,
          { cwd: tempDir, stdio: 'ignore' }
        );
      }
      
      // Add README if provided
      if (readme) {
        const readmePath = path.join(tempDir, 'README.md');
        jetpack.write(readmePath, readme);
      }
      
      // Copy all files to the temp directory
      let copiedCount = 0;
      for (const filePath of files) {
        const fullPath = path.resolve(filePath);
        if (!jetpack.exists(fullPath)) {
          continue;
        }
        
        // Get relative path from cache directory
        const relativePath = path.relative(this.cacheDir, fullPath);
        if (relativePath.startsWith('..')) {
          continue;
        }
        
        const destPath = path.join(tempDir, relativePath);
        jetpack.copy(fullPath, destPath, { overwrite: true });
        copiedCount++;
      }
      
      // Check if there are changes
      const status = execSync('git status --porcelain', { cwd: tempDir }).toString();
      if (!status.trim()) {
        this.logger.log('⏭️  No changes to commit');
        return 0;
      }
      
      // Add all changes
      this.logger.log(`📝 Staging ${copiedCount} files...`);
      execSync('git add -A', { cwd: tempDir, stdio: 'ignore' });
      
      // Commit
      execSync(
        `git -c user.name="GitHub Actions" -c user.email="actions@github.com" commit -m "📦 Update cache: ${copiedCount} files"`,
        { cwd: tempDir, stdio: 'ignore' }
      );
      
      // Push
      this.logger.log(`📤 Pushing to GitHub...`);
      if (forceRecreate) {
        execSync('git push --force --set-upstream origin ' + this.branchName, { cwd: tempDir, stdio: 'ignore' });
      } else {
        execSync('git push', { cwd: tempDir, stdio: 'ignore' });
      }
      
      // Clean up
      jetpack.remove(tempDir);
      
      return copiedCount;
    } catch (error) {
      this.logger.error(`❌ Git command failed: ${error.message}`);
      jetpack.remove(tempDir);
      throw error; // No fallback - git is required
    }
  }

  // Check for orphaned files in cache
  async checkForOrphans(validFiles) {
    const validSet = new Set(validFiles);
    const cacheFiles = jetpack.find(this.cacheDir, { 
      matching: '**/*', 
      files: true, 
      directories: false 
    });
    
    const orphanedFiles = [];
    const validCacheFiles = [];
    
    cacheFiles.forEach(file => {
      const relativePath = path.relative(this.cacheDir, file);
      if (validSet.has(relativePath) || relativePath === 'meta.json') {
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

    // Add last run stats if provided
    if (stats.processedNow !== undefined || stats.fromCache !== undefined) {
      readme += `
## Last Run Statistics

- **Processed:** ${stats.processedNow || 0} files
- **From Cache:** ${stats.fromCache || 0} files
`;
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

  // Calculate file hash
  calculateHash(filePath) {
    const content = jetpack.read(filePath, 'buffer');
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}

module.exports = GitHubCache;