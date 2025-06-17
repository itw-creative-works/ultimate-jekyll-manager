// Libraries
const Manager = new (require('../../build.js'));
const logger = Manager.logger('translation');
const { series } = require('gulp');
const glob = require('glob').globSync;
const path = require('path');
const fetch = require('wonderful-fetch');
const jetpack = require('fs-jetpack');
const cheerio = require('cheerio');
const crypto = require('crypto');
const yaml = require('js-yaml');
const { execute, wait } = require('node-powertools');
const { Octokit } = require('@octokit/rest')
const AdmZip = require('adm-zip') // npm install adm-zip

// Load package
const package = Manager.getPackage('main');
const project = Manager.getPackage('project');
const config = Manager.getConfig('project');
const rootPathPackage = Manager.getRootPath('main');
const rootPathProject = Manager.getRootPath('project');

// Check if BEM env variable is set
// get cached translations JSON (only once per run, so keep track of how many times this has run) from branch uj-translations
// loop thru all html and md pages in pages/ dir (main and project)
  // SKIP files in _translations dir
// if there is no translation (or translation is too old), send to AI @ itw
// save the translation into the cache (file path, date) and write the file to _translations/{code}/{original file path + name}
// push the updated translation JSON to the branch uj-translations

// Settings
const CACHE_DIR = '.temp/translations'
const RECHECK_DAYS = 30
// const AI_MODEL = 'gpt-4.1-nano';
const AI_MODEL = 'gpt-4.1-mini';
const TRANSLATION_BRANCH = 'uj-translations';

const TRANSLATION_DELAY_MS = 500; // wait between each translation
const TRANSLATION_BATCH_SIZE = 25; // wait longer every N translations
const TRANSLATION_BATCH_DELAY_MS = 10000; // longer wait after batch

// Variables
let octokit;

// Glob
const input = [
  // Files to include
  '_site/**/*.html',
];
const output = '';
const delay = 250;

// Task
async function translation(complete) {
  // Log
  logger.log('Starting...');

  // Get ignored pages
  const ignoredPages = getIgnoredPages();

  // Quit if NOT in build mode and UJ_TRANSLATION_FORCE is not true
  if (!Manager.isBuildMode() && process.env.UJ_TRANSLATION_FORCE !== 'true') {
    logger.log('Skipping translation in development mode');
    return complete();
  }

  // Quit if no GH_TOKEN is set
  if (!process.env.GH_TOKEN) {
    logger.error('❌ GH_TOKEN not set. Translation requires GitHub access token.');
    return complete();
  }

  // Quit if no GITHUB_REPOSITORY is set
  if (!process.env.GITHUB_REPOSITORY) {
    logger.error('❌ GITHUB_REPOSITORY not set. Translation requires GitHub repository information.');
    return complete();
  }

  if (!octokit) {
    // Initialize Octokit for GitHub API
    octokit = new Octokit({
      auth: process.env.GH_TOKEN,
    });
  }

  // Log ignored pages
  // logger.log('Input files:', input);
  // logger.log('Ignored pages:', ignoredPages);

  // Perform translation
  await processTranslation();

  // Log
  logger.log('Finished!');

  // Complete
  return complete();
};

// Default Task
module.exports = series(translation);

// Process translation
async function processTranslation() {
  const enabled = config?.translation?.enabled !== false;
  const languages = config?.translation?.languages || [];
  const ignoredPages = getIgnoredPages();
  const updatedFiles = new Set();

  // Quit if translation is disabled or no languages are configured
  if (!enabled) {
    return logger.warn('🚫 Translation is disabled in config.');
  }
  if (!languages.length) {
    return logger.warn('🚫 No target languages configured.');
  }
  if (!process.env.OPENAI_API_KEY) {
    return logger.error('❌ OPENAI_API_KEY not set.');
  }

  // For testing purposes
  const ujOnly = process.env.UJ_TRANSLATION_ONLY;

  // Pull latest cached translations from uj-translations branch
  if (Manager.isBuildMode()) {
    await fetchTranslationsBranch();
  }

  // Get files
  const allFiles = glob(input, {
    nodir: true,
    ignore: [
      ...ignoredPages.files.map(key => `_site/${key}.html`),
      ...ignoredPages.folders.map(folder => `_site/${folder}/**/*`)
    ]
  });

  // Log
  logger.log(`Translating ${allFiles.length} files for ${languages.length} supported languages: ${languages.join(', ')}`);
  // logger.log(allFiles);

  // Prepare meta caches per language
  const metas = {};
  for (const lang of languages) {
    const metaPath = path.join(CACHE_DIR, lang, 'meta.json');
    let meta = {};
    if (jetpack.exists(metaPath)) {
      try {
        meta = jetpack.read(metaPath, 'json');
      } catch (e) {
        logger.warn(`⚠️ Failed to parse meta for [${lang}], starting fresh`);
      }
    }
    metas[lang] = { meta, path: metaPath, skipped: [] };
  }

  // Track token usage
  const tokens = { prompt: 0, completion: 0 };
  const queue = [];

  for (const filePath of allFiles) {
    // Get relative path and original HTML
    const relativePath = filePath.replace(/^_site[\\/]/, '');
    const originalHtml = jetpack.read(filePath);
    const $ = cheerio.load(originalHtml);
    const textNodes = [];

    // Get text nodes from body
    $('body *').each((_, el) => {
      const node = $(el);

      // Skip script tags or any other tags you want to ignore
      if (node.is('script')) {
        return;
      }

      // Find text nodes that are not empty
      node.contents().each((_, child) => {
        if (child.type === 'text' && child.data?.trim()) {
          const i = textNodes.length;
          const text = child.data
            .replace(/^(\s+)\s*/, '$1') // Preserve original leading whitespace
            .replace(/\s*(\s+)$/, '$1') // Preserve original trailing whitespace
            .replace(/\s+/g, ' ')       // Normalize internal whitespace

          // Tag the text node with a unique index
          textNodes.push({
            node,
            originalNode: child,
            text: text,
            tagged: `[${i}]${text}[/${i}]`,
          });
        }
      });
    });

    // Build body text from tagged nodes
    const bodyText = textNodes.map(n => n.tagged).join('\n');

    // Compute hash of the body text only
    const hash = crypto.createHash('sha256').update(bodyText).digest('hex');

    // Skip all except the specified HTML file
    if (ujOnly && relativePath !== ujOnly) {
      for (const lang of languages) {
        metas[lang].skipped.push(`${relativePath} (UJ_TRANSLATION_ONLY set)`);
      }
      continue;
    }

    // Log the page being processed
    logger.log(`🔍 Processing: ${relativePath} (hash: ${hash})`);
    // console.log('---textNodes', textNodes);
    // console.log('---bodyText---', bodyText);

    // Translate this file for all languages in parallel
    for (const lang of languages) {
      const task = async () => {
        const meta = metas[lang].meta;
        const cachePath = path.join(CACHE_DIR, lang, 'pages', relativePath);
        const outPath = path.join('_site', lang, relativePath);

        logger.log(`🌐 Translating: ${relativePath} → [${lang}]`);

        // Skip if the file is not in the meta or if it has no text nodes
        let translated = null;
        const entry = meta[relativePath];
        const age = entry?.timestamp
          ? (Date.now() - new Date(entry.timestamp).getTime()) / (1000 * 60 * 60 * 24)
          : Infinity;
        const useCached = entry && entry.hash === hash && (RECHECK_DAYS === 0 || age < RECHECK_DAYS);
        const startTime = Date.now();

        // Check if we can use cached translation
        if (useCached && jetpack.exists(cachePath)) {
          translated = jetpack.read(cachePath);
          logger.log(`📦 Using cached translation for ${relativePath} [${lang}]`);
        } else {
          try {
            const { result, usage } = await translateWithAPI(bodyText, lang);

            // Set translated result
            translated = result;

            // Update token totals
            tokens.prompt += usage.prompt_tokens || 0;
            tokens.completion += usage.completion_tokens || 0;

            // Save to cache
            jetpack.write(cachePath, translated);
            meta[relativePath] = {
              timestamp: new Date().toISOString(),
              hash,
            };
          } catch (e) {
            const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
            logger.error(`⚠️ Translation failed: ${relativePath} [${lang}] — ${e.message} (Elapsed time: ${elapsedTime}s)`);

            // Set translated result
            translated = bodyText;

            // Save failure to cache
            meta[relativePath] = {
              timestamp: 0,
              hash: '__fail__',
            };
          }
        }

        // Log result
        // console.log('---translated---', translated);

        // Replace original text nodes with translated versions
        textNodes.forEach((n, i) => {
          const regex = new RegExp(`\\[${i}\\](.*?)\\[/${i}\\]`, 's');
          const match = translated.match(regex);

          if (match && match[1]) {
            const translation = match[1];
            n.originalNode.data = translation;
            logger.log(`${i}: ${n.text} → ${translation}`);
          } else {
            logger.warn(`⚠️ Could not find translated tag for index ${i}`);
          }
        });

        // Rewrite links
        rewriteLinks($, lang);

        // Save output
        jetpack.write(outPath, $.html());
        logger.log(`✅ Wrote: ${outPath}`);

        // Track updated files only if it's new or updated
        if (!useCached || !entry || entry.hash !== hash) {
          // updatedFiles.add(cachePath);
          // updatedFiles.add(metas[lang].path);
        }
        updatedFiles.add(cachePath);
        updatedFiles.add(metas[lang].path);
      };

      // Add to queue
      queue.push(task);
    }
  }

  // Process queue in batches with delay
  for (let i = 0; i < queue.length; i += TRANSLATION_BATCH_SIZE) {
    const batch = queue.slice(i, i + TRANSLATION_BATCH_SIZE).map(fn => fn());

    // Wait for all tasks in this batch to finish
    await Promise.all(batch);

    // Delay between batches
    if (i + TRANSLATION_BATCH_SIZE < queue.length) {
      await wait(TRANSLATION_BATCH_DELAY_MS);
    }
  }

  // Save all updated meta files
  for (const lang of languages) {
    jetpack.write(metas[lang].path, metas[lang].meta);
    if (metas[lang].skipped.length) {
      logger.warn('🚫 Skipped files:');
      metas[lang].skipped.forEach(f => logger.warn(f));
    }
  }

  // Log total token usage
  logger.log('🧠 OpenAI Token Usage Summary:');
  logger.log(`   🟣 Prompt tokens:     ${tokens.prompt.toLocaleString()}`);
  logger.log(`   🟢 Completion tokens: ${tokens.completion.toLocaleString()}`);
  logger.log(`   🔵 Total tokens:      ${(tokens.prompt + tokens.completion).toLocaleString()}`);

  // Push updated translation cache back to uj-translations
  if (Manager.isBuildMode()) {
    await pushTranslationBranch(updatedFiles);
  }
}

async function translateWithAPI(content, lang) {
  // Prompt
  const systemPrompt = `
    You are a professional translator.
    Translate the provided content, preserving all original formatting, HTML structure, metadata, and links.
    Do not explain anything — just return the translated content.
    The content is TAGGED with [0]...[/0], etc. to mark the text. You MUST KEEP THESE TAGS IN PLACE IN YOUR RESPONSE and OPEN ([0]) and CLOSE ([/0]) them PROPERLY.
    Translate to ${lang}.
  `;

  // Request
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    response: 'json',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    timeout: 60000 * 4,
    body: JSON.stringify({
      // model: 'gpt-4o',
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: content }
      ],
      max_tokens: 1024 * 16,
      temperature: 0.2,
    }),
  });

  // Get result
  const result = res?.choices?.[0]?.message?.content;
  const usage = res?.usage || {};

  // Check for errors
  if (!result || result.trim() === '') {
    throw new Error('Translation result was empty');
  }

  // Return
  return {
    result,
    usage,
  };
}

function rewriteLinks($, lang) {
  const baseUrl = Manager.getWorkingUrl();
  const ignoredPages = getIgnoredPages();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');

    try {
      // Build a new URL object
      const url = new URL(href, baseUrl);

      // LOg origin check
      // console.log('---LOG url.origin', url.origin);
      // console.log('---LOG baseUrl.origin', new URL(baseUrl).origin);

      // Skip if href is empty or undefined or #
      if (
        !href
        || href.startsWith('#')
        || href.startsWith('!#')
        || href.startsWith('javascript:')
      ) {
        logger.log(`⚠️ Ignoring link: ${href} (empty or invalid)`);
        return;
      }

      // Quit early if the URL is external (not part of the current site)
      if (url.origin !== new URL(baseUrl).origin) {
        logger.log(`⚠️ Ignoring external link: ${href} (origin mismatch)`);
        return;
      }

      // Skip if the pathname is in the ignored pages
      const relativePath = url.pathname.replace(/^\//, ''); // Remove leading slash
      if (
        ignoredPages.files.includes(relativePath)
        || ignoredPages.folders.some(folder => relativePath.startsWith(folder + '/'))
      ) {
        logger.log(`⚠️ Ignoring link: ${href} (ignored page)`);
        return;
      }

      // Modify the pathname to inject the language
      url.pathname = `/${lang}${url.pathname}`;

      // Update the href attribute with the modified URL
      $(el).attr('href', url.toString());

      // Log the rewritten link
      logger.log(`🔗 Rewrote link: ${href} → ${url.toString()}`);
    } catch (error) {
      // Log an error if the URL is invalid
      logger.warn(`⚠️ Invalid URL: ${href} — ${error.message}`);
    }
  });
}

function getIgnoredPages() {
  // Check if socials and downloads exist in the config
  const languages = config?.translation?.languages || [];
  const socials = config?.socials || {};
  // const downloads = config?.downloads || {};

  const redirectsDir = path.join('dist', 'redirects');
  const redirectFiles = glob(`${redirectsDir}/**/*.html`);
  const redirectPermalinks = [];

  // Loop through all .html files in dist/redirects
  for (const file of redirectFiles) {
    try {
      const content = jetpack.read(file);
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

      if (frontmatterMatch) {
        const frontmatter = yaml.load(frontmatterMatch[1]);
        if (frontmatter?.permalink) {
          redirectPermalinks.push(frontmatter.permalink.replace(/^\//, '')); // Remove leading slash
        }
      }
    } catch (e) {
      logger.warn(`⚠️ Failed to process file: ${file} — ${e.message}`);
    }
  }

  return {
    files: [
      // Socials
      ...Object.keys(socials),

      // Auth
      'oauth2',
      'authentication-token',
      'authentication-success',
      'authentication-required',

      // Checkout
      'checkout',
      'checkout/confirmation',

      // Contact submission
      'submission/confirmation',

      // Legal
      'terms',
      'privacy',
      'cookies',

      // Other
      '404',

      // Redirects
      ...redirectPermalinks,
    ],
    folders: [
      // Languages
      ...languages,

      // Admin
      'admin',

      // Firestore auth pages
      '__/auth',
    ],
  };
}

// Git Sync: Pull
async function fetchTranslationsBranch() {
  const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/')
  logger.log(`📥 Syncing full branch '${TRANSLATION_BRANCH}' from ${owner}/${repo}`)

  // Check if the translations branch exists
  let branchExists = false
  try {
    await octokit.repos.getBranch({ owner, repo, branch: TRANSLATION_BRANCH })
    branchExists = true
  } catch (e) {
    // If the error is not a 404 (branch not found), rethrow it
    if (e.status !== 404) throw e
  }

  if (!branchExists) {
    logger.warn(`⚠️ Branch '${TRANSLATION_BRANCH}' does not exist. Creating blank branch with placeholder...`)

    // 1. Create a blob (file object) for the placeholder content
    const { data: blob } = await octokit.git.createBlob({
      owner,
      repo,
      content: 'This branch is used for storing translation caches\n',
      encoding: 'utf-8'
    })

    // 2. Create a tree structure using the blob for a README.md file
    const { data: tree } = await octokit.git.createTree({
      owner,
      repo,
      tree: [
        {
          path: 'README.md',
          mode: '100644', // Standard file permission
          type: 'blob',
          sha: blob.sha
        }
      ]
    })

    // 3. Commit the tree (creates a new commit with no parents)
    const { data: commit } = await octokit.git.createCommit({
      owner,
      repo,
      message: 'Initial empty uj-translations branch with placeholder',
      tree: tree.sha,
      parents: []
    })

    // 4. Create a new branch reference pointing to the commit
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${TRANSLATION_BRANCH}`,
      sha: commit.sha
    })

    logger.log(`✅ Created empty branch '${TRANSLATION_BRANCH}' with .placeholder`)
    return
  }

  // If the branch exists, download it as a ZIP archive
  const zipBallArchive = await octokit.repos.downloadZipballArchive({
    owner,
    repo,
    ref: TRANSLATION_BRANCH,
  })

  // Define path to save the downloaded zip and extraction destination
  const zipPath = path.join('.temp', `${repo}.zip`)
  const extractDir = '.temp'

  // Write the ZIP archive to disk
  jetpack.write(zipPath, Buffer.from(zipBallArchive.data))
  logger.log(`📦 Saved archive to ${zipPath}`)

  // Extract the ZIP archive contents
  const zip = new AdmZip(zipPath)
  zip.extractAllTo(extractDir, true)
  logger.log(`✅ Extracted translation branch to ${extractDir}`)

  // Get the name of the root folder from the extracted archive
  const extractedRoot = jetpack.list(extractDir).find(name => name.startsWith(`${owner}-${repo}-`))
  const extractedFullPath = path.join(extractDir, extractedRoot)
  const targetPath = path.join(extractDir, 'translations')

  // Remove any existing 'translations' folder and move the extracted folder there
  if (jetpack.exists(targetPath)) jetpack.remove(targetPath)
  jetpack.move(extractedFullPath, targetPath)

  // Clean up the ZIP file
  jetpack.remove(zipPath)
  logger.log(`✅ Renamed ${extractedRoot} to 'translations'`)
}

// Git Sync: Push
async function pushTranslationBranch(updatedFiles) {
  const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
  const localRoot = path.join('.temp', 'translations');

  // Convert Set to array
  const files = [...updatedFiles];
  logger.log(`📤 Pushing ${files.length} updated file(s) to '${TRANSLATION_BRANCH}'`);
  console.log(files);

  // Abort if .temp/translations doesn't exist
  if (!jetpack.exists(localRoot)) {
    logger.warn(`⚠️ Nothing to push — '${localRoot}' does not exist.`);
    return;
  }

  for (const filePath of files) {
    const fullPath = path.resolve(filePath);

    // Skip missing files
    if (!jetpack.exists(fullPath)) {
      logger.warn(`⚠️ Skipping missing file: ${filePath}`);
      continue;
    }

    const content = jetpack.read(fullPath, 'utf8');
    const encoded = Buffer.from(content).toString('base64');

    // Make sure the path is inside the .temp/translations folder
    const relativePath = path.relative(localRoot, fullPath).replace(/\\/g, '/');
    if (relativePath.startsWith('..')) {
      logger.warn(`⚠️ Skipping file outside translation folder: ${relativePath}`);
      continue;
    }

    // Check if file already exists in the branch to get SHA
    let sha = null;
    let remoteHash = null;
    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path: relativePath,
        ref: TRANSLATION_BRANCH
      });

      sha = data.sha; // Required for updates
      remoteHash = crypto.createHash('sha256').update(Buffer.from(data.content, 'base64')).digest('hex');
    } catch (e) {
      if (e.status !== 404) throw e; // 404 = new file, which is fine
    }

    // Compare local and remote hashes, skip upload if identical
    const localHash = crypto.createHash('sha256').update(content).digest('hex');
    if (sha && localHash === remoteHash) {
      logger.log(`⏭️ Skipped (no change): ${relativePath}`);
      continue;
    }

    // Create or update file
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      branch: TRANSLATION_BRANCH,
      path: relativePath,
      message: `🔄 Update ${relativePath}`,
      content: encoded,
      sha
    });

    logger.log(`✅ Uploaded ${relativePath}`);
  }

  logger.log(`🎉 Finished pushing ${files.length} file(s) to '${TRANSLATION_BRANCH}'`);
}
