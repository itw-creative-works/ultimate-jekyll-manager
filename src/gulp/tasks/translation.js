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
const { Octokit } = require('@octokit/rest')
const AdmZip = require('adm-zip') // npm install adm-zip

// Utils
const collectTextNodes = require('./utils/collectTextNodes');
const formatDocument = require('./utils/formatDocument');

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
const CACHE_DIR = '.temp/translations';
const RECHECK_DAYS = 0;
// const AI_MODEL = 'gpt-4.1-nano';
const AI_MODEL = 'gpt-4.1-mini';
const TRANSLATION_BRANCH = 'uj-translations';
// const LOUD = false;
const LOUD = Manager.isServer() || process.env.UJ_LOUD_LOGS === 'true';
const CONTROL = 'UJ-TRANSLATION-CONTROL';

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

// const SYSTEM_PROMPT = `
// You are a professional translator.

// Translate the provided content to **{lang}**, preserving **100% of the original structure, formatting, tags, metadata, and order**. Your ONLY job is to replace **translatable text inside tags** with the target language equivalent — nothing more.

// ---

// STRICT RULES:

// 1. Each line is enclosed in **TAGGED format** like "[0]...[/0]".
// 2. You **MUST NOT**:
//    - Combine or merge tags.
//    - Reorder tags.
//    - Drop or skip tags.
//    - Translate outside the tags.
//    - Translate variables like "{ brand }", "${CONTROL}", or URLs.

// 3. Each tag must be preserved **exactly as-is**, with:
//    - The **original index** (e.g. "[42]...[/42]"),
//    - The **same spacing/whitespace** around or inside content.

// 4. If content is **split across multiple tags**, you must **translate each tag individually**, but still consider surrounding context to ensure natural grammar.

// ---

// EXAMPLES YOU MUST FOLLOW:

// Input:
// [174]. Yes there is a [/174]
// [175] 14-day free trial [/175]

// Output (German):
// [174]. Ja, es gibt eine [/174]
// [175] 14-tägige kostenlose Testphase [/175]

// ❌ DO NOT COMBINE into:
// [174]Ja, es gibt eine 14-tägige kostenlose Testphase[/174]

// ---

// Final Output Instructions:
// - Output each line in its own "[tag]...[/tag]" format.
// - Do **NOT** add extra commentary or explanation.
// - The output must contain the same **number of tags** as the input.
// - Tags **must be in the exact same order** as input.
// - Return only the translated lines.

// ---

// OUTPUT TAGS: { tags }
// LANGUAGE: { lang }

// // Strict mode enabled: Disallow tag combination, enforce exact structure
// `

// const SYSTEM_PROMPT = `
// You are a professional translator.

// Translate the following content into {lang}.

// ---

// RULES – YOU MUST FOLLOW THESE EXACTLY:

// 1. Each line is formatted as a tagged unit like: [123]Text[/123]
//    You MUST return each tag exactly as received: same index, same spacing.

// 2. NEVER combine, merge, split, reorder, or delete tags.
//    One tag in → One tag out. No exceptions.

// 3. DO NOT translate:
//    - URLs
//    - Anything in { curly braces }
//    - Tags themselves (e.g. keep "[123]" and "[/123]" as-is)

// 4. Do not add, remove, or change punctuation outside the tagged content.

// 5. If the content across multiple tags forms a sentence, you MUST translate each tag individually **but maintain fluency using context only — do not merge**.

// ---

// EXAMPLES:

// Input:
// [1]Yes, there is a[/1]
// [2]14-day free trial[/2]

// ✅ Correct:
// [1]Ja, es gibt eine[/1]
// [2]14-tägige kostenlose Testphase[/2]

// ❌ Wrong (combined):
// [1]Ja, es gibt eine 14-tägige kostenlose Testphase[/1]

// ---

// DO NOT explain anything.
// DO NOT combine output.
// JUST return one translated line per tag.
// Maintain the same number of tags, in the same order.

// ---

// OUTPUT FORMAT: { tags }
// TARGET LANGUAGE: { lang }

// Your response must contain **only** the translated lines, in exact tag order, with no commentary.
// `

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
module.exports = series(translation);

// Process translation
async function processTranslation() {
  const enabled = config?.translation?.enabled !== false;
  const languages = config?.translation?.languages || [];
  const updatedFiles = new Set();

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

  // Pull latest cached translations from uj-translations branch
  // if (Manager.isBuildMode()) {
    await fetchTranslationsBranch();
  // }

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

  // Track token usage
  const tokens = { prompt: 0, completion: 0 };
  const queue = [];

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

        // Log
        logger.log(`🌐 Started: ${logTag}`);

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
          logger.log(`📦 Success: ${logTag} - Using cache`);
        } else {
          try {
            const { result, usage } = await translateWithAPI(openAIKey, bodyText, lang);

            // Log
            const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
            logger.log(`✅ Success: ${logTag} - Translated (Elapsed time: ${elapsedTime}s)`);

            // Set translated result
            translated = result;

            // Update token totals
            tokens.prompt += usage.prompt_tokens || 0;
            tokens.completion += usage.completion_tokens || 0;

            // Save to cache
            jetpack.write(cachePath, translated);

            // Set result
            setResult(true);
          } catch (e) {
            const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
            logger.error(`❌ Failed: ${logTag} — ${e.message} (Elapsed time: ${elapsedTime}s)`);

            // Set translated result
            translated = bodyText;

            // Save failure to cache
            setResult(false);
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

        // Update <link rel="canonical">
        const canonicalUrl = getCanonicalUrl(lang, relativePath);
        $('link[rel="canonical"]').attr('href', canonicalUrl);

        // Update <meta property="og:url">
        $('meta[property="og:url"]').attr('content', canonicalUrl);

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
  let totalUsage = { prompt_tokens: 0, completion_tokens: 0 };
  let hasErrors = false;

  for (const batchResult of batchResults) {
    if (batchResult.error) {
      // Log
      logger.error(`❌ Batch ${batchResult.batchNumber} failed: ${batchResult.error.message}`);

      // Use original content for failed batch
      const originalBatchLines = lines.slice(batchResult.startIndex, batchResult.endIndex + 1);
      for (let i = 0; i < originalBatchLines.length; i++) {
        translatedLines[batchResult.startIndex + i] = originalBatchLines[i];
      }
      hasErrors = true;
    } else {
      const resultLines = batchResult.result.split('\n');

      // Log
      logger.log(`✅ Batch ${batchResult.batchNumber} translated successfully`);

      // Place translated lines in correct positions
      for (let i = 0; i < resultLines.length; i++) {
        translatedLines[batchResult.startIndex + i] = resultLines[i];
      }
      totalUsage.prompt_tokens += batchResult.usage.prompt_tokens || 0;
      totalUsage.completion_tokens += batchResult.usage.completion_tokens || 0;
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

async function translateBatch(openAIKey, content, lang, batchNumber) {
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
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    response: 'json',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 60000 * 4,
    tries: 2,
    body: {
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: content }
      ],
      max_tokens: 1024 * 16,
      temperature: 0.2,
    },
  });

  // Get result
  const result = res?.choices?.[0]?.message?.content;
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
      logger.log(`🔤 Translated line [batch=[${batchNumber}], line=${index + 1}]: "${inputLines[index]}" → "${line}"`);
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
  const targetPath = path.join(extractDir, 'translations');

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
  // console.log(files);

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
