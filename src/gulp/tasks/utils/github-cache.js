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
    this.logger.log(`✅ Fetched cache from branch '${this.branchName}'`);
    
    return true;
  }

  // Push files to cache branch
  async pushBranch(updatedFiles, options = {}) {
    await this.init();

    // Convert Set to array if needed
    const files = Array.isArray(updatedFiles) ? updatedFiles : [...updatedFiles];
    
    this.logger.log(`📤 Pushing ${files.length} file(s) to cache branch '${this.branchName}'`);

    // Check if branch exists, create if not
    const branchExists = await this.ensureBranchExists(options.branchReadme);

    // Upload each file
    const uploadedCount = await this.uploadFiles(files);

    this.logger.log(`🎉 Pushed ${uploadedCount} file(s) to cache branch`);
    
    return uploadedCount;
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

  // Upload files to the branch
  async uploadFiles(files) {
    let uploadedCount = 0;

    for (const filePath of files) {
      const fullPath = path.resolve(filePath);

      if (!jetpack.exists(fullPath)) {
        this.logger.warn(`⚠️ Skipping missing file: ${filePath}`);
        continue;
      }

      // Read file content
      const content = jetpack.read(fullPath, 'buffer');
      const encoded = content.toString('base64');

      // Get relative path from cache directory
      const relativePath = path.relative(this.cacheDir, fullPath).replace(/\\/g, '/');
      
      // Skip files outside cache directory
      if (relativePath.startsWith('..')) {
        this.logger.warn(`⚠️ Skipping file outside cache folder: ${relativePath}`);
        continue;
      }

      // Check if file exists to get SHA
      let sha = null;
      let skipUpload = false;
      
      try {
        const { data } = await this.octokit.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path: relativePath,
          ref: this.branchName
        });
        sha = data.sha;

        // Skip if content unchanged (for binary files)
        const remoteContent = Buffer.from(data.content, 'base64');
        if (content.equals(remoteContent)) {
          this.logger.log(`⏭️  Skipped (unchanged): ${relativePath}`);
          skipUpload = true;
        }
      } catch (e) {
        if (e.status !== 404) throw e;
        // 404 means new file, which is fine
      }

      if (skipUpload) {
        continue;
      }

      // Upload file
      await this.octokit.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        branch: this.branchName,
        path: relativePath,
        message: `📦 Update ${relativePath}`,
        content: encoded,
        sha
      });

      this.logger.log(`✅ Uploaded: ${relativePath}`);
      uploadedCount++;
    }

    return uploadedCount;
  }

  // Compare file hash with remote
  async compareFileHash(localPath, remotePath) {
    try {
      const localContent = jetpack.read(localPath, 'buffer');
      const localHash = crypto.createHash('sha256').update(localContent).digest('hex');

      const { data } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: remotePath,
        ref: this.branchName
      });

      const remoteContent = Buffer.from(data.content, 'base64');
      const remoteHash = crypto.createHash('sha256').update(remoteContent).digest('hex');

      return localHash === remoteHash;
    } catch (e) {
      if (e.status === 404) {
        return false; // File doesn't exist remotely
      }
      throw e;
    }
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

  // Calculate file hash
  calculateHash(filePath) {
    const content = jetpack.read(filePath, 'buffer');
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}

module.exports = GitHubCache;