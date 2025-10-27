// GitHub Repository Detection Utility
// Shared function for auto-detecting GitHub repository from git remote
// Can be called from any gulp task or utility

const { execute } = require('node-powertools');

/**
 * Detects and sets GITHUB_REPOSITORY environment variable if not already set
 * @param {Object} logger - Logger instance for output
 * @returns {Promise<string|null>} - Repository in format "owner/repo" or null if detection fails
 */
async function detectGitHubRepository(logger = console) {
  // If already set, return it
  if (process.env.GITHUB_REPOSITORY) {
    return process.env.GITHUB_REPOSITORY;
  }

  try {
    const result = await execute('git remote get-url origin', { log: false });

    // Parse GitHub repository from remote URL
    // Supports: https://github.com/owner/repo.git, git@github.com:owner/repo.git
    const match = result.match(/github\.com[:/]([^/]+\/[^.\s]+)/);

    if (match) {
      process.env.GITHUB_REPOSITORY = match[1];
      logger.log(`Auto-detected repository from git remote: ${process.env.GITHUB_REPOSITORY}`);
      return process.env.GITHUB_REPOSITORY;
    } else {
      logger.warn(`⚠️ Could not parse GitHub repository from git remote URL: ${result}`);
      return null;
    }
  } catch (e) {
    // Ignore errors from git command (e.g., not a git repo, no remote)
    if (logger.warn) {
      logger.warn(`⚠️ Could not auto-detect repository from git remote: ${e.message}`);
    }
    return null;
  }
}

module.exports = detectGitHubRepository;
