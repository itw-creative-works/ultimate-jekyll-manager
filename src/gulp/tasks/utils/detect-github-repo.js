// GitHub Repository Detection Utility
// Shared function for auto-detecting GitHub repository from git remote
// Can be called from any gulp task or utility

const { execute } = require('node-powertools');

/**
 * Detects and sets GITHUB_REPOSITORY environment variable if not already set
 * Uses GitHub API to verify/correct the owner in case repo was transferred
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
    const match = result.match(/github\.com[:/]([^/]+)\/([^.\s]+)/);

    if (!match) {
      logger.warn(`⚠️ Could not parse GitHub repository from git remote URL: ${result}`);
      return null;
    }

    let owner = match[1];
    let repo = match[2];

    // If GH_TOKEN is available, verify the current owner via GitHub API
    // This handles cases where repos were transferred to a different owner
    if (process.env.GH_TOKEN) {
      try {
        const { Octokit } = require('@octokit/rest');
        const octokit = new Octokit({ auth: process.env.GH_TOKEN });

        // GitHub API automatically redirects to the current location of transferred repos
        const { data } = await octokit.repos.get({ owner, repo });

        // Check if the repo was transferred (owner changed)
        if (data.owner.login !== owner) {
          logger.log(`🔄 Repository was transferred: ${owner}/${repo} → ${data.owner.login}/${repo}`);

          // Update the local git remote to the new owner
          const newOwner = data.owner.login;
          const newUrl = result.includes('git@')
            ? `git@github.com:${newOwner}/${repo}.git`
            : `https://github.com/${newOwner}/${repo}.git`;

          try {
            await execute(`git remote set-url origin ${newUrl}`, { log: false });
            logger.log(`✅ Updated git remote origin to: ${newUrl}`);
          } catch (remoteError) {
            logger.warn(`⚠️ Could not update git remote: ${remoteError.message}`);
          }

          owner = newOwner;
        }
      } catch (apiError) {
        // If API call fails, fall back to git remote value
        logger.warn(`⚠️ Could not verify repository owner via GitHub API: ${apiError.message}`);
      }
    }

    process.env.GITHUB_REPOSITORY = `${owner}/${repo}`;
    logger.log(`Auto-detected repository from git remote: ${process.env.GITHUB_REPOSITORY}`);
    return process.env.GITHUB_REPOSITORY;
  } catch (e) {
    // Ignore errors from git command (e.g., not a git repo, no remote)
    if (logger.warn) {
      logger.warn(`⚠️ Could not auto-detect repository from git remote: ${e.message}`);
    }
    return null;
  }
}

module.exports = detectGitHubRepository;
