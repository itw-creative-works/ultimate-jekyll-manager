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
const { execute, wait, template } = require('node-powertools');

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
  model: 'gpt-4.1-mini',
  inputCost: 0.40, // $0.40 per 1M tokens
  outputCost: 1.60, // $1.60 per 1M tokens
}
const CACHE_DIR = '.temp/cache/translation';
const CACHE_BRANCH = 'cache-uj-translation';
const RECHECK_DAYS = 0;
// const LOUD = false;
const LOUD = process.env.UJ_LOUD_LOGS === 'true';
const CONTROL = 'UJ-TRANSLATION-CONTROL';
const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'ku', 'yi', 'ji', 'ckb', 'dv', 'arc', 'aii', 'syr'];

const TRANSLATION_DELAY_MS = 500; // wait between each translation
const TRANSLATION_BATCH_SIZE = 25; // wait longer every N translations
const TRANSLATION_BATCH_DELAY_MS = 10000; // longer wait after batch
const AI_BATCH_SIZE = 50;

// Prompt
const SYSTEM_PROMPT = `
  You are a professional translator.
  Translate the provided content, preserving all original formatting, HTML structure, metadata, and links.
  Do not explain anything — just return the translated content.

  Maintain the tags:
    - Each line is TAGGED like "[0]...[/0]" to mark the text.
    - You MUST KEEP THESE TAGS IN PLACE IN YOUR RESPONSE
    - You MUST OPEN ([0]) and CLOSE ([/0]) each tag PROPERLY.
    - DO NOT change the order of the tags.
    - DO NOT COMBINE multiple tags into one (e.g. [0]A, B, [/0] and [1]C.[/1] SHOULD BE KEPT SEPARATE).
    - DO NOT OMIT any tags.
    - You SHOULD CONSIDER adjacent tags for context.

  DO NOT translate the following elements (but still keep them in place):
    - URLs or other non-text elements.
    - The brand name ({ brand }).
    - The control tag (${CONTROL}).

  Output Tags: { tags }
  Output Language: { lang }
`;

// Variables
let githubCache;
let index = -1;

// Glob
const input = [
  // Files to include
  '_site/**/*.html',

  // Files to exclude
  // Test pages (except translation.html)
  '!_site/**/test/**',
  '_site/test/translation.html',
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
  const updatedFiles = new Set();

  // Track timing
  const startTime = Date.now();

  // Quit if translation is disabled or no languages are configured
  if (!enabled) {
    return logger.warn('🚫 Translation is disabled in config.');
  }

  if (!languages.length) {
    return logger.warn('🚫 No target languages configured.');
  }

  // For testing purposes
  const openAIKey = await fetchOpenAIKey();
  const ujOnly = process.env.UJ_TRANSLATION_ONLY;

  if (!openAIKey) {
    return logger.error('❌ openAIKey not set. Translation requires OpenAI API key.');
  }

  // Get files
  const allFiles = glob(input, getGlobOptions());

  // Log
  logger.log(`Translating ${allFiles.length} files for ${languages.length} supported languages: ${languages.join(', ')}`);
  // logger.log(allFiles);

  // Prepare meta caches per language
  const metas = {
    global: {
      skipped: new Set(),
    }
  };
  const promptHash = crypto.createHash('sha256').update(SYSTEM_PROMPT).digest('hex');

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

    // Check if the promptHash matches; if not, invalidate the cache
    if (meta.prompt?.hash !== promptHash) {
      logger.warn(`⚠️ Meta: [${lang}] Prompt hash mismatch - invalidating cache.`);
      meta = {};
    }

    // Store the current promptHash in the meta file
    meta.prompt = { hash: promptHash };
    metas[lang] = { meta, path: metaPath, skipped: new Set() };
  }

  // Track token usage and statistics
  const tokens = { input: 0, output: 0 };
  const queue = [];
  const stats = {
    fromCache: 0,
    newlyProcessed: 0,
    totalProcessed: 0,
    failedFiles: [],
    cachedFiles: [],
    processedFiles: []
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

    // Collect text nodes with tags
    const textNodes = collectTextNodes($, { tag: true });

    // Build body text from tagged nodes
    const bodyText = textNodes.map(n => n.tagged).join('\n');

    // Compute hash of the body text only
    const hash = crypto.createHash('sha256').update(bodyText).digest('hex');

    // Skip all except the specified HTML file
    if (ujOnly && relativePath !== ujOnly) {
      // Update to work with the new SET protocol
      metas.global.skipped.add(`${relativePath} (UJ_TRANSLATION_ONLY set)`);
      continue;
    }

    // Log the page being processed
    logger.log(`🔍 Processing: ${relativePath} (hash: ${hash})`);
    // console.log('---textNodes', textNodes);
    // console.log('---bodyText---', bodyText);
    if (LOUD) logger.log(`🔍 Body text: \n${bodyText}`)

    // Translate this file for all languages in parallel
    for (const lang of languages) {
      const task = async () => {
        const meta = metas[lang].meta;
        const cachePath = path.join(CACHE_DIR, lang, 'pages', relativePath);
        // const outPath = path.join('_site', lang, relativePath);
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

        // Skip if the file is not in the meta or if it has no text nodes
        let translated = null;
        const entry = meta[relativePath];
        const age = entry?.timestamp
          ? (Date.now() - new Date(entry.timestamp).getTime()) / (1000 * 60 * 60 * 24)
          : Infinity;
        const useCached = entry
          && entry.hash === hash
          && (RECHECK_DAYS === 0 || age < RECHECK_DAYS);
        const startTime = Date.now();

        function setResult(success) {
          if (success) {
            meta[relativePath] = {
              timestamp: new Date().toISOString(),
              hash,
            };
          } else {
            meta[relativePath] = {
              timestamp: 0,
              hash: '__fail__',
            };
          }
        }

        // Check if we can use cached translation
        if (
          (useCached || process.env.UJ_TRANSLATION_CACHE === 'true')
          && jetpack.exists(cachePath)
        ) {
          translated = jetpack.read(cachePath);
          logger.log(`📦 Success [${progress} - ${percentage}%]: ${logTag} - Using cache`);
          stats.fromCache++;
          stats.cachedFiles.push(logTag);
        } else {
          try {
            const { result, usage } = await translateWithAPI(openAIKey, bodyText, lang);

            // Log
            const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
            logger.log(`✅ Success [${progress} - ${percentage}%]: ${logTag} - Translated (Elapsed time: ${elapsedTime}s)`);

            // Set translated result
            translated = result;

            // Update token totals
            tokens.input += usage.input_tokens || 0;
            tokens.output += usage.output_tokens || 0;

            // Save to cache
            jetpack.write(cachePath, translated);

            // Set result
            setResult(true);
            stats.newlyProcessed++;
            stats.processedFiles.push(logTag);
          } catch (e) {
            const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
            logger.error(`❌ Failed [${progress} - ${percentage}%]: ${logTag} — ${e.message} (Elapsed time: ${elapsedTime}s)`);

            // Set translated result
            translated = bodyText;

            // Save failure to cache
            setResult(false);
            stats.failedFiles.push(logTag);
          }
        }

        // Fix translation
        translated = translated.trim();

        // Log result
        // console.log('---translated---', translated);

        // Reset the DOM to avoid conflicts between languages
        const $ = cheerio.load(originalHtml);
        // Collect text nodes with tags
        const textNodes = collectTextNodes($, { tag: true });

        // Replace original text nodes with translated versions
        textNodes.forEach((n, i) => {
          const regex = new RegExp(`\\[${i}\\](.*?)\\[/${i}\\]`, 's');
          const match = translated.match(regex);
          const translation = match?.[1];

          if (!translation) {
            return logger.warn(`⚠️ Warning: ${logTag} - Could not find translated tag for index ${i}`);
          }

          // Extract original leading and trailing whitespace
          const originalText = n.text;
          const leadingWhitespace = originalText.match(/^\s*/)?.[0] || '';
          const trailingWhitespace = originalText.match(/\s*$/)?.[0] || '';

          // Reapply the original whitespace to the translation
          const adjustedTranslation = `${leadingWhitespace}${translation.trim()}${trailingWhitespace}`;

          // Its possible for a control tag mismatch, so we need to check that
          if (
            adjustedTranslation.includes(CONTROL)
            && n.node.attr('id') !== CONTROL
          ) {
            logger.error(`❌ Failed: ${logTag} — Control tag mismatch in translation for index ${i}`);
            return setResult(false);
          }

          // Replace the text in the node
          if (n.type === 'data') {
            n.reference.data = adjustedTranslation;
          } else if (n.type === 'text') {
            n.node.text(adjustedTranslation);
          } else if (n.type === 'attr') {
            n.node.attr(n.attr, adjustedTranslation);
          }

          // Log
          if (LOUD) logger.log(`${i}: "${n.text.trim()}" → "${adjustedTranslation.trim()}"`);
        });

        // Rewrite links
        rewriteLinks($, lang);

        // Check that the control tag matches the expected value
        const controlTag = $(`#${CONTROL}`);
        if (
          controlTag.length === 0
          || controlTag.text() !== CONTROL
        ) {
          logger.error(`❌ Failed: ${logTag} — Control tag mismatch or missing`);

          return setResult(false);
        }

        // Delete the control tag
        // controlTag.remove();

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

        // Save output
        // const formatted = await formatDocument($.html(), 'html');

        // console.log('----relativePath', relativePath);
        // console.log('----filePath', filePath);
        // console.log('----outPath', outPath);
        // console.log('----FORMATTED.ERROR', formatted.error);

        // Write the translated file
        // jetpack.write(outPath, formatted.content);
        // logger.log(`✅ Wrote: ${outPath}`);

        // Track updated files only if it's new or updated
        // if (!useCached || !entry || entry.hash !== hash) {
        // }
        // Track updated files
        updatedFiles.add(cachePath);
        updatedFiles.add(metas[lang].path);
        stats.totalProcessed++;
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

  // Log skipped files
  logger.warn('🚫 Skipped files:');
  let totalSkipped = 0;
  for (const [lang, meta] of Object.entries(metas)) {
    if (meta.skipped.size > 0) {
      logger.warn(`  [${lang}] ${meta.skipped.size} skipped files:`);
      meta.skipped.forEach(f => logger.warn(`    ${f}`));
      totalSkipped += meta.skipped.size;
    }
  }
  if (totalSkipped === 0) {
    logger.warn('  NONE');
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

  // File processing stats
  logger.log('\n📁 File Processing:');
  logger.log(`   Total processed:     ${stats.totalProcessed}`);
  logger.log(`   From cache:          ${stats.fromCache} (${((stats.fromCache / stats.totalProcessed) * 100).toFixed(1)}%)`);
  logger.log(`   Newly translated:    ${stats.newlyProcessed} (${((stats.newlyProcessed / stats.totalProcessed) * 100).toFixed(1)}%)`);
  if (stats.failedFiles.length > 0) {
    logger.log(`   Failed:              ${stats.failedFiles.length}`);
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
        sourceCount: allFiles.length,
        cachedCount: allCacheFiles.length,
        processedNow: stats.totalProcessed,
        fromCache: stats.fromCache,
        newlyProcessed: stats.newlyProcessed,
        timing: {
          startTime,
          endTime,
          elapsedMs
        },
        tokenUsage: tokens.input > 0 || tokens.output > 0 ? {
          inputTokens: tokens.input,
          outputTokens: tokens.output,
          totalTokens: tokens.input + tokens.output,
          inputCost,
          outputCost,
          totalCost
        } : undefined,
        languageBreakdown: languages.map(lang => ({
          language: lang,
          total: stats.totalProcessed / languages.length,
          fromCache: stats.cachedFiles.filter(f => f.startsWith(`[${lang}]`)).length,
          newlyTranslated: stats.processedFiles.filter(f => f.startsWith(`[${lang}]`)).length,
          failed: stats.failedFiles.filter(f => f.startsWith(`[${lang}]`)).length
        })),
        details: `Translated ${allFiles.length} pages to ${languages.length} languages (${languages.join(', ')})\n\n### Language Breakdown:\n${languages.map(lang => {
          const langStats = {
            total: stats.totalProcessed / languages.length,
            fromCache: stats.cachedFiles.filter(f => f.startsWith(`[${lang}]`)).length,
            newlyTranslated: stats.processedFiles.filter(f => f.startsWith(`[${lang}]`)).length,
            failed: stats.failedFiles.filter(f => f.startsWith(`[${lang}]`)).length
          };
          return `**${lang.toUpperCase()}:** ${langStats.total} total (${langStats.fromCache} cached, ${langStats.newlyTranslated} new${langStats.failed > 0 ? `, ${langStats.failed} failed` : ''})`;
        }).join('\n')}\n\n### Files from cache:\n${stats.cachedFiles.length > 0 ? stats.cachedFiles.slice(0, 10).map(f => `- ${f}`).join('\n') + (stats.cachedFiles.length > 10 ? `\n- ... and ${stats.cachedFiles.length - 10} more` : '') : 'None'}\n\n### Newly translated files:\n${stats.processedFiles.length > 0 ? stats.processedFiles.slice(0, 10).map(f => `- ${f}`).join('\n') + (stats.processedFiles.length > 10 ? `\n- ... and ${stats.processedFiles.length - 10} more` : '') : 'None'}${stats.failedFiles.length > 0 ? `\n\n### Failed translations:\n${stats.failedFiles.slice(0, 10).map(f => `- ${f}`).join('\n') + (stats.failedFiles.length > 10 ? `\n- ... and ${stats.failedFiles.length - 10} more` : '')}` : ''}`
      }
    });
  }
}

async function translateWithAPI(openAIKey, content, lang) {
  const lines = content.trim().split('\n');

  // If content is small enough, use single batch
  if (lines.length <= AI_BATCH_SIZE) {
    return await translateBatch(openAIKey, content, lang, 0);
  }

  // Split into batches
  const batches = [];
  for (let i = 0; i < lines.length; i += AI_BATCH_SIZE) {
    const batchLines = lines.slice(i, i + AI_BATCH_SIZE);
    batches.push({
      content: batchLines.join('\n'),
      startIndex: i,
      endIndex: i + batchLines.length - 1,
      batchNumber: Math.floor(i / AI_BATCH_SIZE)
    });
  }

  // Process batches in parallel
  const batchPromises = batches.map(batch =>
    translateBatch(openAIKey, batch.content, lang, batch.batchNumber)
      .then(result => ({ ...result, ...batch }))
      .catch(error => ({ error, ...batch }))
  );

  const batchResults = await Promise.all(batchPromises);

  // Reconstruct translation maintaining order
  const translatedLines = new Array(lines.length);
  let totalUsage = { input_tokens: 0, output_tokens: 0 };
  let hasErrors = false;

  for (const batchResult of batchResults) {
    if (batchResult.error) {
      // Log
      logger.error(`❌ Batch ${batchResult.batchNumber} failed: ${batchResult.error.message}`);

      // Try to subdivide the failed batch
      const failedBatchLines = lines.slice(batchResult.startIndex, batchResult.endIndex + 1);
      try {
        logger.log(`🔄 Attempting to subdivide failed batch ${batchResult.batchNumber} (${failedBatchLines.length} lines)`);
        const subdivisionResult = await subdivideAndTranslate(openAIKey, failedBatchLines, lang, batchResult.batchNumber);

        // Place subdivided results in correct positions
        for (let i = 0; i < subdivisionResult.length; i++) {
          translatedLines[batchResult.startIndex + i] = subdivisionResult[i];
        }

        logger.log(`✅ Successfully subdivided batch ${batchResult.batchNumber}`);
      } catch (subdivisionError) {
        logger.error(`❌ Subdivision failed for batch ${batchResult.batchNumber}: ${subdivisionError.message}`);

        // Final fallback: use original content
        for (let i = 0; i < failedBatchLines.length; i++) {
          translatedLines[batchResult.startIndex + i] = failedBatchLines[i];
        }
        hasErrors = true;
      }
    } else {
      const resultLines = batchResult.result.split('\n');

      // Log
      logger.log(`✅ Batch ${batchResult.batchNumber} translated successfully`);

      // Place translated lines in correct positions
      for (let i = 0; i < resultLines.length; i++) {
        translatedLines[batchResult.startIndex + i] = resultLines[i];
      }
      totalUsage.input_tokens += batchResult.usage.input_tokens || 0;
      totalUsage.output_tokens += batchResult.usage.output_tokens || 0;
    }
  }

  const finalResult = translatedLines.join('\n');

  if (hasErrors) {
    logger.warn(`⚠️ Some batches failed, partial translation completed`);
  }

  return {
    result: finalResult,
    usage: totalUsage,
  };
}

async function subdivideAndTranslate(openAIKey, lines, lang, originalBatchNumber, depth = 0) {
  const maxDepth = 10; // Prevent infinite recursion

  if (depth > maxDepth) {
    throw new Error(`Maximum subdivision depth reached for batch ${originalBatchNumber}`);
  }

  // If only one line, try to translate it directly
  if (lines.length === 1) {
    try {
      const singleLineResult = await translateBatch(openAIKey, lines[0], lang, `${originalBatchNumber}.${depth}`, true);
      return [singleLineResult.result];
    } catch (error) {
      logger.warn(`⚠️ Single line translation failed, using original: ${error.message}`);
      return lines; // Return original line if single line fails
    }
  }

  // Divide the batch into smaller sub-batches (half the size, minimum 1)
  const subBatchSize = Math.max(1, Math.floor(lines.length / 2));
  const subBatches = [];

  for (let i = 0; i < lines.length; i += subBatchSize) {
    subBatches.push(lines.slice(i, i + subBatchSize));
  }

  logger.log(`🔀 Subdividing into ${subBatches.length} sub-batches of ~${subBatchSize} lines each`);

  const results = [];

  // Process sub-batches sequentially to avoid overwhelming the API
  for (let i = 0; i < subBatches.length; i++) {
    const subBatch = subBatches[i];
    const subBatchContent = subBatch.join('\n');

    try {
      const subResult = await translateBatch(openAIKey, subBatchContent, lang, `${originalBatchNumber}.${depth}.${i}`);
      results.push(...subResult.result.split('\n'));
    } catch (error) {
      logger.warn(`⚠️ Sub-batch ${i} failed, attempting further subdivision: ${error.message}`);

      // Recursively subdivide this failed sub-batch
      const recursiveResult = await subdivideAndTranslate(openAIKey, subBatch, lang, originalBatchNumber, depth + 1);
      results.push(...recursiveResult);
    }
  }

  return results;
}

async function translateBatch(openAIKey, content, lang, batchNumber, isSingleLine = false) {
  const brand = config?.brand?.name || 'Unknown Brand';
  const inputLines = content.split('\n');

  const systemPrompt = template(SYSTEM_PROMPT, {
    lang,
    brand,
    tags: inputLines.length - 1,
  });

  // Format content
  content = content.trim();

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
        { role: 'system', content: systemPrompt },
        { role: 'user', content: content }
      ],
      temperature: 0.2,
    },
  });

  // Get result
  const result = res?.output?.[0]?.content?.[0]?.text;
  const usage = res?.usage || {};
  const trimmed = result?.trim();

  // Check for errors
  if (!result || trimmed === '') {
    throw new Error(`Translation result was empty for batch ${batchNumber}`);
  }

  // Get content line count
  const outputLines = trimmed.split('\n');

  // console.log(`----Batch ${batchNumber} inputLines`, inputLines.length);
  // console.log(`----Batch ${batchNumber} outputLines`, outputLines.length);

  if (LOUD) {
    // console.log(`-----Batch ${batchNumber} content\n`, content);
    // console.log(`-----Batch ${batchNumber} trimmed\n`, trimmed);

    // Loop thru and log the translated lines
    outputLines.forEach((line, index) => {
      // Log "original line -> translated line"
      const prefix = isSingleLine ? '🔸' : '🔤';
      logger.log(`${prefix} Translated line [batch=[${batchNumber}], line=${index + 1}]: "${inputLines[index]}" → "${line}"`);
    });
  }

  // Throw error if there is a mismatch in line count for this batch
  if (inputLines.length !== outputLines.length) {
    throw new Error(`Translation line count mismatch in batch ${batchNumber}: ${inputLines.length} → ${outputLines.length}`);
  }

  // Return
  return {
    result: trimmed,
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

async function fetchOpenAIKey() {
  const url = 'https://api.itwcreativeworks.com/get-api-keys';

  try {
    const response = await fetch(url, {
      method: 'GET',
      response: 'json',
      tries: 2,
      headers: {
        'Authorization': `Bearer ${process.env.GH_TOKEN}`,
      },
      query: {
        authorizationKeyName: 'github',
      }
    });

    // Log
    // logger.log('OpenAI API response:', response);

    // Return
    return response.openai.ultimate_jekyll.translation;
  } catch (error) {
    logger.error('Error:', error);
  }
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
