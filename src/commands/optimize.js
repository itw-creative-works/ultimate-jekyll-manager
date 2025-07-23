// Libraries
const Manager = new (require('../build.js'));
const logger = Manager.logger('optimize');
const jetpack = require('fs-jetpack');
const path = require('path');
const fetch = require('wonderful-fetch');
const glob = require('glob').globSync;

// Load package
const package = Manager.getPackage('main');
const project = Manager.getPackage('project');

// Settings
const AI = {
  model: 'gpt-4.1-mini',
  inputCost: 0.40, // $0.40 per 1M tokens
  outputCost: 1.60, // $1.60 per 1M tokens
}
const BATCH_DELAY_MS = 1000; // Delay between files to avoid rate limiting
const UJ_TAG = '<!-- Optimized by Ultimate Jekyll -->';

// Optimization prompt
const OPTIMIZATION_PROMPT = `
  # Identity
  Optimize this LIQUID HTML fragment for better accessibility and SEO.
  This is a partial HTML fragment (not a complete page), so DO NOT add <html>, <head>, <body>, or any meta tags.
  Focus on optimizing the content within the fragment itself.

  ## Add or improve:
  - Alt text for all images (4-8 words but meaningful)
  - ARIA labels and roles where appropriate for interactive elements
  - ARIA descriptions for complex UI components
  - Role attributes for non-semantic elements
  - Proper heading hierarchy (h1, h2, h3, etc.) within the fragment (don't assume h1 exists elsewhere)
  - Semantic HTML5 elements (nav, main, article, section, aside, figure, figcaption, etc.)
  - Form labels and accessibility attributes
  - Proper focus management attributes (tabindex where needed)
  - Link text that makes sense out of context (avoid "click here")
  - Any other minor accessibility improvements

  ## Important:
  - This is a FRAGMENT, not a full page - DO NOT add any html tags or elements
  - Preserve all existing functionality, classes, and styles
  - Return ONLY the optimized fragment, no explanations
  - Maintain the same structure and formatting
  - Preserve any Liquid tags (e.g., {{ variable }}, {% if %}, etc.)
  - DO NOT add frontmatter (--- ... ---) as it will be handled separately
  - DO NOT remove any existing content
`;

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

    // Return
    return response.openai.ultimate_jekyll.translation;
  } catch (error) {
    logger.error('Failed to fetch OpenAI key:', error.message);
    return null;
  }
}

async function optimizeFile(filePath, content, openAIKey) {
  try {
    logger.log(`Optimizing: ${filePath}`);

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      response: 'json',
      headers: {
        'Authorization': `Bearer ${openAIKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000 * 2, // 2 minute timeout
      tries: 2,
      body: {
        model: AI.model,
        input: [
          {
            role: 'system',
            content: OPTIMIZATION_PROMPT
          },
          {
            role: 'user',
            content: content
          }
        ],
        temperature: 0.3,
      }
    });

    // console.log(`Response for ${filePath}:`, response);

    if (response?.output?.[0]?.content?.[0]?.text) {
      // Return both content and usage data
      return {
        content: response.output[0].content[0].text,
        usage: response.usage || { input_tokens: 0, output_tokens: 0, total_tokens: 0 }
      };
    } else {
      throw new Error('Invalid response from OpenAI');
    }
  } catch (error) {
    logger.error(`Failed to optimize ${filePath}:`, error.message);
    return null;
  }
}

module.exports = async function (options) {
  // Log
  logger.log(`Starting optimization...`);

  // Check for GitHub token
  if (!process.env.GH_TOKEN) {
    logger.error('❌ GH_TOKEN not set. Optimization requires GitHub access token.');
    return;
  }

  // Get OpenAI key
  const openAIKey = await fetchOpenAIKey();
  if (!openAIKey) {
    logger.error('❌ Failed to fetch OpenAI API key.');
    return;
  }

  // Get project root
  const projectRoot = path.resolve(process.cwd());

  // Parse path option - default to 'src/pages'
  let targetPath = options?.path || 'src/pages';

  // Handle relative paths
  if (!path.isAbsolute(targetPath)) {
    targetPath = path.join(projectRoot, targetPath);
  }

  // Check if path exists
  if (!jetpack.exists(targetPath)) {
    logger.error(`❌ Path not found: ${targetPath}`);
    return;
  }

  // Determine if target is a file or directory
  const isFile = jetpack.exists(targetPath) === 'file';
  let files = [];

  logger.log(`Searching for files in: ${path.relative(projectRoot, targetPath)}`);

  if (isFile) {
    // Single file mode
    if (targetPath.match(/\.(html|md)$/i)) {
      files = [targetPath];
    } else {
      logger.error('❌ File must be HTML or Markdown (.html or .md)');
      return;
    }
  } else {
    // Directory mode
    files = glob('**/*.{html,md}', {
      cwd: targetPath,
      absolute: true,
      ignore: ['**/node_modules/**', '**/_*/**'] // Ignore node_modules and underscore folders
    });
  }

  if (files.length === 0) {
    logger.warn('No HTML or Markdown files found.');
    return;
  }

  logger.log(`Found ${files.length} file(s) to optimize.`);

  // Process each file
  let optimizedCount = 0;
  let failedCount = 0;
  let totalUsage = {
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0
  };

  const PARALLEL_BATCH_SIZE = 5; // Process 5 files at a time

  // Filter out already optimized files first
  const filesToProcess = [];
  for (const filePath of files) {
    const content = jetpack.read(filePath);
    if (!content) {
      const relativePath = isFile ? path.basename(filePath) : path.relative(targetPath, filePath);
      logger.warn(`Skipping empty file: ${relativePath}`);
      continue;
    }

    // Skip if file is already optimized (has optimization marker)
    // if (content.includes(UJ_TAG)) {
    //   const relativePath = isFile ? path.basename(filePath) : path.relative(targetPath, filePath);
    //   logger.log(`Already optimized: ${relativePath}`);
    //   continue;
    // }

    filesToProcess.push({ filePath, content });
  }

  if (filesToProcess.length === 0) {
    logger.log('All files are already optimized or empty.');
    return;
  }

  logger.log(`Processing ${filesToProcess.length} files...`);

  // Process files in parallel batches
  for (let i = 0; i < filesToProcess.length; i += PARALLEL_BATCH_SIZE) {
    const batch = filesToProcess.slice(i, i + PARALLEL_BATCH_SIZE);

    // Create promises for parallel processing
    const promises = batch.map(async ({ filePath, content }) => {
      const relativePath = isFile ? path.basename(filePath) : path.relative(targetPath, filePath);
      const startTime = Date.now();

      try {
        // Extract frontmatter and content
        let frontmatter = '';
        let htmlContent = content;

        // Check if file has frontmatter (starts with ---)
        if (content.startsWith('---')) {
          const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
          if (frontmatterMatch) {
            frontmatter = `---\n${frontmatterMatch[1]}\n---\n`;
            htmlContent = frontmatterMatch[2];
          }
        }

        // Optimize only the HTML content
        const result = await optimizeFile(relativePath, htmlContent, openAIKey);

        if (result && result.content) {
          // Recombine frontmatter with optimized content and add marker
          const finalContent = frontmatter + `\n${UJ_TAG}\n${result.content.trim()}`;

          // Write back to file
          jetpack.write(filePath, finalContent);

          const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
          logger.log(`✅ Optimized: ${relativePath} (Elapsed time: ${elapsedTime}s)`);
          return { success: true, usage: result.usage };
        } else {
          const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
          logger.error(`❌ Failed to optimize: ${relativePath} (Elapsed time: ${elapsedTime}s)`);
          return { success: false, usage: null };
        }
      } catch (error) {
        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.error(`❌ Error processing ${relativePath}: ${error.message} (Elapsed time: ${elapsedTime}s)`);
        return { success: false };
      }
    });

    // Wait for batch to complete
    const results = await Promise.all(promises);

    // Count results and accumulate token usage
    results.forEach(result => {
      if (result.success) {
        optimizedCount++;
        if (result.usage) {
          totalUsage.input_tokens += result.usage.input_tokens || 0;
          totalUsage.output_tokens += result.usage.output_tokens || 0;
          totalUsage.total_tokens += result.usage.total_tokens || 0;
        }
      } else {
        failedCount++;
      }
    });

    // Add delay between batches to avoid rate limiting
    if (i + PARALLEL_BATCH_SIZE < filesToProcess.length) {
      logger.log(`Completed batch ${Math.floor(i / PARALLEL_BATCH_SIZE) + 1}, waiting before next batch...`);
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS * 2));
    }
  }

  // Calculate costs using AI pricing (per 1M tokens)
  const inputCost = (totalUsage.input_tokens / 1000000) * AI.inputCost;
  const outputCost = (totalUsage.output_tokens / 1000000) * AI.outputCost;
  const totalCost = inputCost + outputCost;

  // Summary
  logger.log(`✅ Optimized: ${optimizedCount} files`);
  if (failedCount > 0) {
    logger.log(`❌ Failed: ${failedCount} files`);
  }

  // Token usage summary
  logger.log(`📊 Token Usage Summary:`);
  logger.log(`   🟣 Input tokens:  ${totalUsage.input_tokens.toLocaleString()}`);
  logger.log(`   🟢 Output tokens: ${totalUsage.output_tokens.toLocaleString()}`);
  logger.log(`   🔵 Total tokens:  ${totalUsage.total_tokens.toLocaleString()}`);

  // Cost summary
  logger.log(`💰 Cost Breakdown:`);
  logger.log(`   📥 Input cost:  $${inputCost.toFixed(4)}`);
  logger.log(`   📤 Output cost: $${outputCost.toFixed(4)}`);
  logger.log(`   💵 Total cost:  $${totalCost.toFixed(4)}`);
};
