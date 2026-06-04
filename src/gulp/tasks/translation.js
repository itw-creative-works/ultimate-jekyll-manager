// Libraries
const Manager = new (require('../../build.js'));
const logger = Manager.logger('translation');
const { series, watch } = require('gulp');
const glob = require('glob').globSync;
const path = require('path');
const fetch = require('wonderful-fetch');
const jetpack = require('fs-jetpack');
const cheerio = require('cheerio');
const crypto = require('crypto');
const yaml = require('js-yaml');
const { template, queue } = require('node-powertools');

// Utils
const GitHubCache = require('./utils/github-cache');
const collectTextNodes = require('./utils/collectTextNodes');
const formatDocument = require('./utils/formatDocument');

// Load package
const package = Manager.getPackage('main');
const project = Manager.getPackage('project');
const config = Manager.getConfig('project');
const rootPathPackage = Manager.getRootPath('main');
const rootPathProject = Manager.getRootPath('project');

// Check if BEM env variable is set
// get cached translations JSON (only once per run, so keep track of how many times this has run) from branch cache-translation
// loop thru all html and md pages in pages/ dir (main and project)
  // SKIP files in _translations dir
// if there is no translation (or translation is too old), send to AI @ itw
// save the translation into the cache (file path, date) and write the file to _translations/{code}/{original file path + name}
// push the updated translation JSON to the branch cache-translation

// Settings
const AI = {
  // model: 'gpt-5.4-mini',
  // inputCost: 0.75, // $0.75 per 1M tokens
  // outputCost: 4.50, // $4.50 per 1M tokens
  model: 'gpt-5.4-nano',
  inputCost: 0.20, // $0.20 per 1M tokens
  outputCost: 1.25, // $1.25 per 1M tokens
}
const CACHE_DIR = '.temp/cache/translation';
const CACHE_BRANCH = 'cache-uj-translation';
// const LOUD = false;
const LOUD = process.env.UJ_LOUD_LOGS === 'true';
const CONTROL = 'UJ-TRANSLATION-CONTROL';
const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'ku', 'yi', 'ji', 'ckb', 'dv', 'arc', 'aii', 'syr'];

const CONCURRENCY = 5; // max simultaneous API-calling pages
const STRINGS_PER_BATCH = 25;
const MAX_RETRIES = 2;

// Prompt
const SYSTEM_PROMPT = `
<role>
  Professional translator. Return ONLY a valid JSON array — no commentary, no markdown fences, no wrapping.
</role>

<task>
  Translate the input JSON array of strings into the target language.
  The output array MUST have the EXACT same length as the input array.
</task>

<rules>
  <format>
  - Input: a JSON array of strings.
  - Output: a JSON array of translated strings of the SAME length.
  - DO NOT add, remove, merge, or reorder elements.
  - Consider adjacent strings for context — they come from the same page.
  - Preserve leading and trailing whitespace in each string.
  </format>

  <preserve>
  - All HTML tags, attributes, and URLs (keep verbatim, do not translate).
  - The brand name "{ brand }" (never translate).
  - The control string "${CONTROL}" (return it unchanged at its exact position).
  </preserve>
</rules>

<example lang="es">
  Input: ["Welcome to { brand }", "Get started today", "${CONTROL}"]
  Output: ["Bienvenido a { brand }", "Comienza hoy", "${CONTROL}"]
</example>
`;

// Variables
let githubCache;
let index = -1;

// Glob
const input = [
  '_site/**/*.html',
];
const output = '';
const delay = 250;

// Task
async function translation(complete) {
  // Increment index
  index++;

  // Log
  logger.log('Starting...');
  Manager.logMemory(logger, 'Start');

  // Quit if NOT in build mode and UJ_TRANSLATION_FORCE is not true
  if (!Manager.isBuildMode() && process.env.UJ_TRANSLATION_FORCE !== 'true') {
    logger.log('Skipping translation in development mode');
    return complete();
  }

  // Initialize cache on first run
  if (index === 0) {
    githubCache = await initializeCache();
    if (!githubCache) {
      logger.error('❌ Translation cache requires GitHub credentials (GH_TOKEN and GITHUB_REPOSITORY)');
      return complete();
    }
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

// TODO: Currently this does not work because it will run an infinite loop
function translationWatcher(complete) {
  // Quit if in build mode
  if (Manager.isBuildMode()) {
    logger.log('[watcher] Skipping watcher in build mode');
    return complete();
  }

  // Log
  logger.log('[watcher] Watching for changes...');

  // Get ignored pages
  const ignoredPages = getIgnoredPages();
  const ignore = [
    ...ignoredPages.files.map(key => `_site/${key}.html`),
    ...ignoredPages.folders.map(folder => `_site/${folder}/**/*`)
  ]

  // Watch for changes
  watch(input, { delay: delay, ...getGlobOptions(), }, translation)
  .on('change', (path) => {
    logger.log(`[watcher] File changed (${path})`);
  });

  // Complete
  return complete();
}

// Default Task
module.exports = series(
  translation
);

// Process translation
async function processTranslation() {
  const enabled = config?.translation?.enabled !== false;
  const languages = config?.translation?.languages || [];
  // Track timing
  const startTime = Date.now();

  // Quit if translation is disabled or no languages are configured
  if (!enabled) {
    return logger.warn('🚫 Translation is disabled in config.');
  }

  if (!languages.length) {
    return logger.warn('🚫 No target languages configured.');
  }

  const openAIKey = process.env.BACKEND_MANAGER_OPENAI_API_KEY;
  const ujOnly = process.env.UJ_TRANSLATION_ONLY;

  if (!openAIKey) {
    return logger.error('❌ BACKEND_MANAGER_OPENAI_API_KEY not set in .env. Translation requires an OpenAI API key.');
  }

  // Get files
  const allFiles = getFiles();

  // Log
  logger.log(`Translating ${allFiles.length} files for ${languages.length} supported languages: ${languages.join(', ')}`);
  // logger.log(allFiles);

  // Prepare prompt hash for cache invalidation
  const promptHash = crypto.createHash('sha256').update(SYSTEM_PROMPT).digest('hex');
  const skippedFiles = new Set();

  // Load per-language meta (prompt hash only)
  const metas = {};
  for (const lang of languages) {
    const metaPath = path.join(CACHE_DIR, lang, 'meta.json');
    let meta = {};
    if (jetpack.exists(metaPath)) {
      try {
        meta = jetpack.read(metaPath, 'json');
      } catch (e) {
        logger.warn(`⚠️ Meta: [${lang}] Failed to parse - starting fresh`);
      }
    }

    // Check if the promptHash matches; if not, wipe all page caches for this language
    if (meta.prompt?.hash !== promptHash) {
      const pagesDir = path.join(CACHE_DIR, lang, 'pages');
      const existing = jetpack.exists(pagesDir) ? jetpack.find(pagesDir, { matching: '**/*', files: true }).length : 0;
      logger.warn(`⚠️ Prompt cache MISS [${lang}]: hash mismatch — clearing ${existing} cached page files.`);
      jetpack.remove(pagesDir);
    } else {
      const pagesDir = path.join(CACHE_DIR, lang, 'pages');
      const existing = jetpack.exists(pagesDir) ? jetpack.find(pagesDir, { matching: '**/*', files: true }).length : 0;
      logger.log(`✅ Prompt cache HIT [${lang}]: ${existing} cached page files available.`);
    }

    meta.prompt = { hash: promptHash };
    metas[lang] = { meta, path: metaPath };
  }

  // Track token usage and statistics
  const tokens = { input: 0, output: 0 };
  const tasks = [];
  const stats = {
    totalPages: 0,
    cachedStrings: 0,
    newStrings: 0,
    failedPages: [],
  };

  // Calculate total tasks for progress tracking
  const totalTasks = allFiles.length * languages.length;
  let completedTasks = 0;

  for (const filePath of allFiles) {
    // Get relative path and original HTML
    const relativePath = filePath.replace(/^_site[\\/]/, '');
    let originalHtml = jetpack.read(filePath);
    const $ = cheerio.load(originalHtml);

    // Inject hidden control tag as last child of <body>
    const controlTag = `<span id="${CONTROL}" style="display:none;">${CONTROL}</span>`;
    $('body').append(controlTag);

    // Reset originalHtml
    originalHtml = $.html();

    // Collect text nodes
    const textNodes = collectTextNodes($, { tag: false });

    // Build strings array and per-string hashes
    const strings = textNodes.map(n => n.text);
    const stringHashes = strings.map(s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 12));

    // Skip all except the specified HTML file
    if (ujOnly && relativePath !== ujOnly) {
      skippedFiles.add(`${relativePath} (UJ_TRANSLATION_ONLY set)`);
      continue;
    }

    // Log the page being processed
    logger.log(`🔍 Processing: ${relativePath} (${strings.length} strings)`);
    if (LOUD) logger.log(`🔍 Strings: \n${JSON.stringify(strings, null, 2)}`)

    // Translate this file for all languages
    for (const lang of languages) {
      const task = async () => {
        const cachePath = path.join(CACHE_DIR, lang, 'pages', `${relativePath}.json`);
        const isHomepage = relativePath === 'index.html';
        const outPath = isHomepage
          ? path.join('_site', `${lang}.html`)
          : path.join('_site', lang, relativePath);
        const logTag = `[${lang}] ${relativePath}`;

        // Increment and calculate progress
        completedTasks++;
        const progress = `${completedTasks}/${totalTasks}`;
        const percentage = ((completedTasks / totalTasks) * 100).toFixed(1);

        // Log
        logger.log(`🌐 Started [${progress} - ${percentage}%]: ${logTag}`);

        const startTime = Date.now();

        // Load existing per-string cache for this page
        let pageCache = {};
        if (jetpack.exists(cachePath)) {
          try {
            pageCache = jetpack.read(cachePath, 'json') || {};
          } catch (e) {
            pageCache = {};
          }
        }

        // Separate cached vs uncached strings
        const translated = new Array(strings.length);
        const uncachedIndices = [];

        for (let i = 0; i < strings.length; i++) {
          const cached = pageCache[stringHashes[i]];
          if (cached !== undefined) {
            translated[i] = cached;
            stats.cachedStrings++;
          } else {
            uncachedIndices.push(i);
          }
        }

        const cachedCount = strings.length - uncachedIndices.length;

        // If everything is cached, skip API call
        if (uncachedIndices.length === 0) {
          const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
          logger.log(`📦 Success [${progress} - ${percentage}%]: ${logTag} — All ${strings.length} strings from cache (${elapsedTime}s)`);
        } else {
          // Translate only the uncached strings
          const uncachedStrings = uncachedIndices.map(i => strings[i]);

          try {
            const { result, usage } = await translateWithAPI(openAIKey, uncachedStrings, lang, logTag);

            // Place translations back at their original indices and update cache
            for (let j = 0; j < uncachedIndices.length; j++) {
              const origIndex = uncachedIndices[j];
              translated[origIndex] = result[j];
              pageCache[stringHashes[origIndex]] = result[j];
            }

            // Update token totals
            tokens.input += usage.input_tokens || 0;
            tokens.output += usage.output_tokens || 0;
            stats.newStrings += uncachedIndices.length;

            const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
            logger.log(`✅ Success [${progress} - ${percentage}%]: ${logTag} — ${uncachedIndices.length} new + ${cachedCount} cached (${elapsedTime}s)`);
          } catch (e) {
            const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
            logger.error(`❌ Failed [${progress} - ${percentage}%]: ${logTag} — ${e.message} (${elapsedTime}s)`);

            // Fill uncached slots with originals
            for (const i of uncachedIndices) {
              translated[i] = strings[i];
            }

            stats.failedPages.push(logTag);
          }
        }

        // Save updated page cache
        jetpack.write(cachePath, pageCache);

        // Reset the DOM to avoid conflicts between languages
        const $ = cheerio.load(originalHtml);
        const textNodes = collectTextNodes($, { tag: false });

        // Replace original text nodes with translated versions
        textNodes.forEach((n, i) => {
          const translation = translated[i];

          if (translation === undefined) {
            return logger.warn(`⚠️ Warning: ${logTag} - Missing translation at index ${i}`);
          }

          // Validate control tag alignment
          if (
            translation.includes(CONTROL)
            && n.node.attr('id') !== CONTROL
          ) {
            return logger.error(`❌ Failed: ${logTag} — Control tag mismatch at index ${i}`);
          }

          // Preserve original leading/trailing whitespace
          const originalText = n.text;
          const leadingWhitespace = originalText.match(/^\s*/)?.[0] || '';
          const trailingWhitespace = originalText.match(/\s*$/)?.[0] || '';
          const adjustedTranslation = `${leadingWhitespace}${translation.trim()}${trailingWhitespace}`;

          // Replace the text in the node
          if (n.type === 'data') {
            n.reference.data = adjustedTranslation;
          } else if (n.type === 'text') {
            n.node.text(adjustedTranslation);
          } else if (n.type === 'attr') {
            n.node.attr(n.attr, adjustedTranslation);
          }

          if (LOUD) logger.log(`${i}: "${n.text.trim()}" → "${adjustedTranslation.trim()}"`);
        });

        // Rewrite links
        rewriteLinks($, lang);

        // Verify control tag survived translation intact
        const controlTag = $(`#${CONTROL}`);
        if (
          controlTag.length === 0
          || controlTag.text() !== CONTROL
        ) {
          logger.error(`❌ Failed: ${logTag} — Control tag mismatch or missing`);
          return;
        }

        // Set the lang attribute on the <html> tag
        $('html').attr('lang', lang);

        // Set the dir attribute for RTL languages
        const isRTL = RTL_LANGUAGES.includes(lang);
        $('html').attr('dir', isRTL ? 'rtl' : 'ltr');

        // Update <link rel="canonical">
        const canonicalUrl = getCanonicalUrl(lang, relativePath);
        $('link[rel="canonical"]').attr('href', canonicalUrl);

        // Update <meta property="og:url">
        $('meta[property="og:url"]').attr('content', canonicalUrl);

        // Update <meta property="og:locale"> to current language
        $('meta[property="og:locale"]').attr('content', lang);

        // Insert language tags on this translation
        await insertLanguageTags($, languages, relativePath, outPath);

        // Insert language tags in original file
        await insertLanguageTags(cheerio.load(originalHtml), languages, relativePath, filePath);

        // Insert language tags in sitemap.xml
        const sitemapPath = path.join('_site', 'sitemap.xml');
        const sitemapXml = jetpack.read(sitemapPath);
        await insertLanguageTags(cheerio.load(sitemapXml, { xmlMode: true }), languages, relativePath, sitemapPath);

        stats.totalPages++;
      };

      // Add to tasks
      tasks.push(task);
    }
  }

  // Process tasks with concurrency limit
  const q = queue({ concurrency: CONCURRENCY });
  await Promise.all(tasks.map(task => q.add(task)));

  // Log skipped files
  if (skippedFiles.size > 0) {
    logger.warn(`🚫 Skipped ${skippedFiles.size} files:`);
    skippedFiles.forEach(f => logger.warn(`    ${f}`));
  }

  // Save all updated meta files
  for (const lang of languages) {
    jetpack.write(metas[lang].path, metas[lang].meta);
  }

  // Calculate timing
  const endTime = Date.now();
  const elapsedMs = endTime - startTime;
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const elapsedFormatted = elapsedMinutes > 0
    ? `${elapsedMinutes}m ${elapsedSeconds % 60}s`
    : `${elapsedSeconds}s`;

  // Calculate costs using AI pricing (per 1M tokens)
  const inputCost = (tokens.input / 1000000) * AI.inputCost;
  const outputCost = (tokens.output / 1000000) * AI.outputCost;
  const totalCost = inputCost + outputCost;

  // Log detailed statistics
  logger.log('\n📊 Translation Statistics:');
  logger.log('═══════════════════════════════════════');

  // Timing
  logger.log('⏱️  Timing:');
  logger.log(`   Start time:      ${new Date(startTime).toLocaleTimeString()}`);
  logger.log(`   End time:        ${new Date(endTime).toLocaleTimeString()}`);
  logger.log(`   Total elapsed:   ${elapsedFormatted}`);

  // Processing stats
  const totalStrings = stats.cachedStrings + stats.newStrings;
  logger.log('\n📁 Processing:');
  logger.log(`   Pages processed:     ${stats.totalPages}`);
  logger.log(`   Strings total:       ${totalStrings.toLocaleString()}`);
  logger.log(`   From cache:          ${stats.cachedStrings.toLocaleString()} (${totalStrings ? ((stats.cachedStrings / totalStrings) * 100).toFixed(1) : 0}%)`);
  logger.log(`   Newly translated:    ${stats.newStrings.toLocaleString()} (${totalStrings ? ((stats.newStrings / totalStrings) * 100).toFixed(1) : 0}%)`);
  if (stats.failedPages.length > 0) {
    logger.log(`   Failed pages:        ${stats.failedPages.length}`);
  }

  // Token usage
  if (tokens.input > 0 || tokens.output > 0) {
    logger.log('\n🧠 OpenAI Token Usage:');
    logger.log(`   Input tokens:        ${tokens.input.toLocaleString()}`);
    logger.log(`   Output tokens:       ${tokens.output.toLocaleString()}`);
    logger.log(`   Total tokens:        ${(tokens.input + tokens.output).toLocaleString()}`);

    // Cost summary
    logger.log('\n💰 Cost Breakdown:');
    logger.log(`   Input cost:          $${inputCost.toFixed(4)}`);
    logger.log(`   Output cost:         $${outputCost.toFixed(4)}`);
    logger.log(`   Total cost:          $${totalCost.toFixed(4)}`);
  }

  logger.log('═══════════════════════════════════════\n');

  // Push updated translation cache back to cache branch
  if (githubCache && githubCache.hasCredentials()) {
    logger.log(`📊 Updating translation cache README with latest statistics...`);

    // Collect all cache files to push
    const allCacheFiles = glob(path.join(CACHE_DIR, '**/*'), { nodir: true });

    // ALWAYS force recreate the branch (fresh branch with no history)
    await githubCache.pushBranch(allCacheFiles, {
      forceRecreate: true,  // ALWAYS create a fresh branch - no history needed
      stats: {
        timestamp: new Date().toISOString(),
        pages: stats.totalPages,
        strings: { cached: stats.cachedStrings, new: stats.newStrings, total: totalStrings },
        failed: stats.failedPages.length,
        languages: languages.join(', '),
        timing: { startTime, endTime, elapsedMs },
        tokenUsage: tokens.input > 0 || tokens.output > 0
          ? { input: tokens.input, output: tokens.output, total: tokens.input + tokens.output, cost: totalCost }
          : undefined,
        details: `Translated ${stats.totalPages} pages to ${languages.length} languages (${languages.join(', ')}): ${stats.cachedStrings} cached + ${stats.newStrings} new strings${stats.failedPages.length > 0 ? `, ${stats.failedPages.length} failed pages` : ''}`
      }
    });
  }
}

async function translateWithAPI(openAIKey, strings, lang, logTag) {
  // If content is small enough, translate in one call
  if (strings.length <= STRINGS_PER_BATCH) {
    return await translateBatch(openAIKey, strings, lang, logTag);
  }

  // Split into batches for large pages
  const translated = [];
  let totalUsage = { input_tokens: 0, output_tokens: 0 };

  for (let i = 0; i < strings.length; i += STRINGS_PER_BATCH) {
    const batch = strings.slice(i, i + STRINGS_PER_BATCH);
    const { result, usage } = await translateBatch(openAIKey, batch, lang, logTag);

    translated.push(...result);
    totalUsage.input_tokens += usage.input_tokens || 0;
    totalUsage.output_tokens += usage.output_tokens || 0;
  }

  return {
    result: translated,
    usage: totalUsage,
  };
}

async function translateBatch(openAIKey, strings, lang, logTag, attempt = 0) {
  const brand = config?.brand?.name || 'Unknown Brand';
  const systemPrompt = template(SYSTEM_PROMPT, { brand });
  const userMessage = `Language: ${lang}\nArray length: ${strings.length}\n\n${JSON.stringify(strings)}`;

  // Request
  const res = await fetch('https://api.openai.com/v1/responses', {
    response: 'json',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 60000 * 4,
    tries: 2,
    body: {
      model: AI.model,
      input: [
        { role: 'developer', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      reasoning: { effort: 'low' },
    },
  });

  // Get result (reasoning models put a reasoning item first — find the message)
  const message = res?.output?.find(o => o.type === 'message');
  const text = message?.content?.[0]?.text;
  const usage = res?.usage || {};

  // Check for empty response
  if (!text || text.trim() === '') {
    const types = (res?.output || []).map(o => o.type).join(', ');
    throw new Error(`Translation result was empty (output types: [${types}])`);
  }

  // Parse JSON array from response (strip markdown fences if model wraps it)
  let parsed;
  try {
    const cleaned = text.trim().replace(/^```json?\n?|\n?```$/g, '');
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Failed to parse translation JSON: ${e.message}`);
  }

  // Validate array and length
  if (!Array.isArray(parsed)) {
    throw new Error(`Translation result is not an array (got ${typeof parsed})`);
  }

  if (parsed.length !== strings.length) {
    if (attempt < MAX_RETRIES) {
      logger.warn(`⚠️ ${logTag} — Length mismatch (expected ${strings.length}, got ${parsed.length}), retry ${attempt + 1}/${MAX_RETRIES}...`);
      return translateBatch(openAIKey, strings, lang, logTag, attempt + 1);
    }
    throw new Error(`Translation length mismatch: expected ${strings.length}, got ${parsed.length}`);
  }

  return {
    result: parsed,
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
        if (LOUD) logger.log(`⚠️ Ignoring link: ${href} (empty or invalid)`);
        return;
      }

      // Quit early if the URL is external (not part of the current site)
      if (url.origin !== new URL(baseUrl).origin) {
        if (LOUD) logger.log(`⚠️ Ignoring external link: ${href} (origin mismatch)`)
        return;
      }

      // Skip if the pathname is in the ignored pages
      const relativePath = url.pathname.replace(/^\//, ''); // Remove leading slash
      if (
        ignoredPages.files.includes(relativePath)
        || ignoredPages.folders.some(folder => relativePath.startsWith(folder + '/'))
      ) {
        if (LOUD) logger.log(`⚠️ Ignoring link: ${href} (ignored page)`);
        return;
      }

      // Modify the pathname to inject the language
      url.pathname = `/${lang}${url.pathname}`;

      // Update the href attribute with the modified URL
      $(el).attr('href', url.toString());

      // Log the rewritten link
      if (LOUD) logger.log(`🔗 Rewrote link: ${href} → ${url.toString()}`);
    } catch (error) {
      // Log an error if the URL is invalid
      if (LOUD) logger.warn(`⚠️ Invalid URL: ${href} — ${error.message}`);
    }
  });
}

async function insertLanguageTags($, languages, relativePath, filePath) {
  // Add <link rel="alternate"> tags for all languages
  // Log whether $ is html or xml
  const isHtml = $('html').length > 0;

  if (isHtml) {
    // Get the current page's language from the og:locale or html lang attribute
    const currentLang = $('meta[property="og:locale"]').attr('content') || $('html').attr('lang') || config?.translation?.default;

    // Locate the existing language tags
    const existingLanguageTags = $(`head link[rel="alternate"][hreflang="${config?.translation?.default}"]`);

    // Insert new language tags directly after the existing ones
    if (existingLanguageTags.length) {
      let newLanguageTags = '';
      for (const targetLang of languages) {
        const alternateUrl = getCanonicalUrl(targetLang, relativePath);

        // Check if the tag already exists
        const tagExists = $(`head link[rel="alternate"][hreflang="${targetLang}"]`).length > 0;
        if (!tagExists) {
          newLanguageTags += `\n<link rel="alternate" href="${alternateUrl}" hreflang="${targetLang}">`;
        }
      }

      // Insert new tags after the last existing language tag
      existingLanguageTags.last().after(newLanguageTags);
    }

    // Add og:locale:alternate meta tags after og:locale
    const ogLocaleTag = $('head meta[property="og:locale"]');
    if (ogLocaleTag.length) {
      let newOgLocaleTags = '';

      // Add default language if it's not the current language
      if (config?.translation?.default && config.translation.default !== currentLang) {
        const tagExists = $(`head meta[property="og:locale:alternate"][content="${config.translation.default}"]`).length > 0;
        if (!tagExists) {
          newOgLocaleTags += `\n<meta property="og:locale:alternate" content="${config.translation.default}">`;
        }
      }

      // Add all alternate languages except the current one
      for (const targetLang of languages) {
        // Skip if this is the current page's language
        if (targetLang === currentLang) continue;

        // Check if the tag already exists
        const tagExists = $(`head meta[property="og:locale:alternate"][content="${targetLang}"]`).length > 0;
        if (!tagExists) {
          newOgLocaleTags += `\n<meta property="og:locale:alternate" content="${targetLang}">`;
        }
      }

      // Insert new tags after the og:locale tag
      if (newOgLocaleTags) {
        ogLocaleTag.after(newOgLocaleTags);
      }
    }
  } else {
    // Locate the existing language tags
    const existingLanguageTags = $(`loc`);

    // Loop thru loc elements and find one that matches canonical URL
    let matchingLoc = null;
    existingLanguageTags.each((_, loc) => {
      const locUrl = $(loc).text();

      if (locUrl === getCanonicalUrl(null, relativePath)) {
        matchingLoc = loc;
      }
    });

    // Insert new language tags after the matching <loc> element
    if (matchingLoc) {

      let newLanguageTags = '';
      for (const targetLang of languages) {
        const alternateUrl = getCanonicalUrl(targetLang, relativePath);

        // Check if the tag already exists
        // const tagExists = existingLanguageTags.filter((_, loc) => $(loc).text() === alternateUrl).length > 0;
        const tagExists = $(`xhtml\\:link[rel="alternate"][hreflang="${targetLang}"][href="${alternateUrl}"]`).length > 0;
        if (!tagExists) {
          newLanguageTags += `\n<xhtml:link rel="alternate" hreflang="${targetLang}" href="${alternateUrl}" />`;
        }
      }

      // Insert new tags after the matching <loc> element
      $(matchingLoc).after(newLanguageTags);
    }
  }

  // Save the modified HTML back to the file if filePath
  if (filePath) {
    const format = isHtml ? 'html' : 'xml';
    const formatted = await formatDocument($.html(), format);

    // Write the formatted content back to the file
    jetpack.write(filePath, formatted.content);
  }
}

function getIgnoredPages() {
  // Check if socials and downloads exist in the config
  const languages = config?.translation?.languages || [];
  const socials = config?.socials || {};
  // const downloads = config?.downloads || {};

  // User-configured excludes (translation.exclude). Each entry can be a folder
  // (e.g. "blog" → /blog/**) or a single page path (e.g. "some-page"). We add
  // each to BOTH files and folders so it matches either way.
  const userExcludes = config?.translation?.exclude || [];

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
      'sitemap',

      // Redirects
      ...redirectPermalinks,

      // User-configured excludes (treated as a page path)
      ...userExcludes,
    ],
    folders: [
      // Languages
      ...languages,

      // Admin
      'admin',

      // Test pages
      'test',

      // Team pages
      'team',

      // Updates/changelog pages
      'updates',

      // Firestore auth pages
      '__/auth',

      // User-configured excludes (treated as a folder)
      ...userExcludes,
    ],
  };
}

// Pages allowed even when their parent folder is excluded
const IGNORE_EXCEPTIONS = [
  '_site/test/translation.html',
];

function getGlobOptions() {
  const ignoredPages = getIgnoredPages();
  return {
    nodir: true,
    ignore: [
      ...ignoredPages.files.map(key => `_site/${key}.html`),
      ...ignoredPages.folders.map(folder => `_site/${folder}/**/*`)
    ]
  }
}

function getFiles() {
  const files = glob(input, getGlobOptions());
  const extras = IGNORE_EXCEPTIONS.filter(f => jetpack.exists(f));

  return [...new Set([...files, ...extras])];
}

// Initialize or get cache
async function initializeCache() {
  const useCache = process.env.UJ_TRANSLATION_CACHE !== 'false';
  if (!useCache) {
    return null;
  }

  const cache = new GitHubCache({
    branchName: CACHE_BRANCH,
    cacheDir: CACHE_DIR,
    logger: logger,
    cacheType: 'Translation',
    description: 'cached translations for faster builds'
  });

  // Check if credentials available
  if (!cache.hasCredentials()) {
    return null;
  }

  // Fetch cache from GitHub if credentials available
  await cache.fetchBranch();
  logger.log(`📦 Translation cache initialized with ${glob(path.join(CACHE_DIR, '**/*'), { nodir: true }).length} files`);

  return cache;
}

function getCanonicalUrl(lang, relativePath) {
  const baseUrl = Manager.getWorkingUrl();

  // Remove 'index.html' from the end
  let cleanedPath = relativePath.replace(/index\.html$/, '');

  // Remove '.html' from the end
  cleanedPath = cleanedPath.replace(/\.html$/, '');

  // Remove trailing slashes
  cleanedPath = cleanedPath.replace(/\/+$/, '');

  // Remove leading slashes
  cleanedPath = cleanedPath.replace(/^\/+/, '');

  // If no language is specified, return the base URL with the cleaned path
  if (!lang) {
    return `${baseUrl}/${cleanedPath}`;
  }

  // Return
  return `${baseUrl}/${lang}/${cleanedPath}`;
}
