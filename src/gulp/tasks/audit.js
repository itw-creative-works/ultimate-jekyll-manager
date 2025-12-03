// Libraries
const Manager = new (require('../../build.js'));
const logger = Manager.logger('audit');
const { series } = require('gulp');
const glob = require('glob').globSync;
const path = require('path');
const jetpack = require('fs-jetpack');
const spellchecker = require('spellchecker');
const cheerio = require('cheerio');
const { HtmlValidate } = require('html-validate');
const { XMLParser } = require('fast-xml-parser');
const { execute } = require('node-powertools');

// Lazy-loaded libraries (only loaded when needed)
let chromeLauncher = null;
let lighthouse = null;

// Utils
const collectTextNodes = require('./utils/collectTextNodes');
const dictionary = require('./utils/dictionary');
const formatDocument = require('./utils/formatDocument');

// Load package
const package = Manager.getPackage('main');
const project = Manager.getPackage('project');
const config = Manager.getConfig('project');
const rootPathPackage = Manager.getRootPath('main');
const rootPathProject = Manager.getRootPath('project');

// Glob
const input = [
  // Files to include
  '_site/**/*.{html,xml}',
];
const output = '';
const delay = 250;

// Batch size for processing files (configurable via env var)
// Set to 0 or 'false' to disable batching and process all files at once (original behavior)
const BATCH_SIZE = (() => {
  const envValue = process.env.UJ_AUDIT_BATCH_SIZE;

  if (!envValue || envValue === 'false' || envValue === '0') {
    return Infinity; // Process all files at once (original behavior)
  }

  return parseInt(envValue, 10);
})();

// Task
async function audit(complete) {
  // Log
  logger.log('Starting...');
  logger.log(`Batch size: ${BATCH_SIZE === Infinity ? 'disabled (processing all files at once)' : `${BATCH_SIZE} files per batch`}`);
  Manager.logMemory(logger, 'Audit Start');

  // Quit if NOT in build mode and UJ_AUDIT_FORCE is not true
  // if (!Manager.isBuildMode() && process.env.UJ_AUDIT_FORCE !== 'true') {
  //   logger.log('Skipping audit in development mode');
  //   return complete();
  // }

  // For now, only run when forced
  if (process.env.UJ_AUDIT_FORCE !== 'true') {
    logger.log('Skipping audit (UJ_AUDIT_FORCE not set to true)');
    return complete();
  }

  // Perform HTML/XML audit
  await processAudit();

  // Perform Lighthouse audit if URL is provided
  if (process.env.UJ_AUDIT_LIGHTHOUSE_URL) {
    // This helps us pass Lighthouse audits in development mode
    const minifyHtml = require('./minifyHtml');
    await new Promise((resolve) => {
      minifyHtml(resolve);
    });

    // Run Lighthouse audit
    await runLighthouseAudit();
  }

  // Log
  logger.log('Finished!');
  Manager.logMemory(logger, 'Audit Complete');

  // Exit process if UJ_AUDIT_AUTOEXIT is set
  if (process.env.UJ_AUDIT_AUTOEXIT === 'true') {
    logger.log('Auto-exiting after audit completion...');
    process.exit(0);
  }

  // Complete
  return complete();
};

// Default Task
module.exports = series(audit);

async function validateFormat(file, content) {
  // Log
  // logger.log(`➡️ Validating HTML in ${file}`);

  // Skip any file that is a blog post
  // if (file.includes('/blog/')) {
  //   return { valid: true, messages: [] };
  // }

  // Initialize an array to hold formatted messages
  let valid = true;
  let formattedMessages = [];

  // Get format
  const format = file.endsWith('.html')
    ? 'html'
    : 'xml';

  // Run pretty validation and HTML/XML validation in parallel
  const [prettyValidationResult, validationResult] = await Promise.all([
    (async () => {
      try {
        // Format the content using Prettier
        const formatted = await formatDocument(content, format);

        // Save the formatted content back to the file
        jetpack.write(file, formatted.content);

        // Quit if there is an error
        if (formatted.error) {
          throw formatted.error;
        }

        return { valid: true, messages: [] };
      } catch (e) {
        return { valid: false, messages: [`[format] ${format.toUpperCase()} is not well-formatted @ ${file} \n${e.message}`] };
      }
    })(),
    (async () => {
      if (format === 'html') {
        const validator = new HtmlValidate({
          root: true,
          extends: ['html-validate:recommended'],
          rules: {
            // Custom rules
            'no-inline-style': 'error',
            'void-style': ['error', { style: 'selfclosing' }],
            'prefer-button': 'warn',
            'doctype-style': 'error',
            'no-dup-id': 'error',

            // Ignore certain rules for this audit
            'no-conditional-comment': 'off',
            'no-trailing-whitespace': 'off',
            'no-inline-style': 'off',
            'script-type': 'off',
          }
        });

        const report = await validator.validateString(content);
        const results = report.results[0];
        const messages = results?.messages || [];

        return {
          valid: report.valid,
          messages: messages.map(msg => {
            return `[${msg.ruleId}] ${msg.message} @ ${file}:${msg.line}:${msg.column} (${msg.ruleUrl})`;
          })
        };
      } else if (format === 'xml') {
        try {
          const parser = new XMLParser({
            ignoreAttributes: false,
            allowBooleanAttributes: true
          });
          parser.parse(content);
          return { valid: true, messages: [] };
        } catch (e) {
          return { valid: false, messages: [`[format] ${format.toUpperCase()} is not well-formatted @ ${file} \n${e.message}`] };
        }
      }
    })()
  ]);

  // Combine results
  valid = prettyValidationResult.valid && validationResult.valid;
  formattedMessages.push(...prettyValidationResult.messages, ...validationResult.messages);

  // Return validation result
  return {
    valid,
    messages: formattedMessages,
  };
}

async function validateSpelling(file, content) {
  // Log
  // logger.log(`➡️ Validating spelling in ${file}`);

  const $ = cheerio.load(content);
  const textNodes = collectTextNodes($);

  const brand = (config?.brand?.name || 'BrandName').toLowerCase();

  const misspelledWords = textNodes.flatMap(({ text }) => {

  // Split text into words using regex
  const words = text.match(/\b[\w’']+\b/g) || [];

  // Filter out words that are part of the brand name or are not misspelled
  return words
    .filter(word => {
      const lowerWord = word.toLowerCase();
      const baseWord = lowerWord.endsWith("'s") ? lowerWord.slice(0, -2) : lowerWord; // Remove possessive 's if present

      if (
        baseWord === brand ||
        dictionary.includes(baseWord)
      ) {
        return false;
      }

      return spellchecker.isMisspelled(word);
    })
    .map(word => {
      // Find the sentence containing the word
      const lines = content.split('\n');
      let lineIndex = 0;
      let column = 0;

      // Iterate through lines to find the full text
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const textIndex = line.indexOf(text);
        if (textIndex !== -1) {
          lineIndex = i + 1; // Convert to 1-based index
          column = textIndex + 1; // Convert to 1-based index
          break;
        }
      }

      return `[spelling] ${word} in "${text}" @ ${file}:${lineIndex}:${column}`;
    });
  });

  return {
    valid: misspelledWords.length === 0,
    misspelledWords,
  };
}

async function processAudit() {
  logger.log('📂 Finding files to audit...');
  const htmlFiles = glob(input, {
    nodir: true,
    ignore: [
      // Auth files
      '_site/__/auth/**/*',

      // Sitemap
      '**/sitemap.html',
    ]
  });

  logger.log(`📊 Found ${htmlFiles.length} files to audit`);
  Manager.logMemory(logger, 'Before Processing');

  // Process files in batches to avoid memory issues
  const results = await Manager.processBatches(
    htmlFiles,
    BATCH_SIZE,
    async (file) => {
      const content = jetpack.read(file);

      // Run format and spellcheck in parallel
      const [formatValidation, spellingValidation] = await Promise.all([
        validateFormat(file, content),
        validateSpelling(file, content)
      ]);

      return {
        file,
        formatValidation,
        spellingValidation
      };
    },
    logger
  );

  Manager.logMemory(logger, 'After Processing');

  // Log results
  const summary = {
    totalFiles: htmlFiles.length,
    validFiles: 0,
    invalidFiles: 0,
    formatErrors: [],
    spellingErrors: []
  };

  results.forEach(({ file, formatValidation, spellingValidation }) => {
    logger.log(`🔍 Results for file: ${file}`);

    if (formatValidation.valid) {
      logger.log(`✅ Format validation passed.`);
    } else {
      logger.log(`❌ Format validation failed:`);
      console.log(format(formatValidation.messages));
      summary.formatErrors.push({
        file,
        messages: formatValidation.messages
      });
    }

    if (spellingValidation.valid) {
      logger.log(`✅ Spelling validation passed.`);
    } else {
      logger.log(`❌ Spelling validation failed:`);
      console.log(format(spellingValidation.misspelledWords));
      summary.spellingErrors.push({
        file,
        misspelledWords: spellingValidation.misspelledWords
      });
    }

    if (formatValidation.valid && spellingValidation.valid) {
      summary.validFiles++;
    } else {
      summary.invalidFiles++;
    }
  });

  // Save validation results to validator folder
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const validatorDir = `${rootPathProject}/.temp/audit/validator`;

  // Ensure validator directory exists
  jetpack.dir(validatorDir);

  // Save validation summary
  const summaryPath = `${validatorDir}/validation-${timestamp}.json`;
  jetpack.write(summaryPath, JSON.stringify(summary, null, 2));
  logger.log(`📄 Validation report saved to: ${summaryPath}`);

  // Save latest validation
  const latestPath = `${validatorDir}/latest-validation.json`;
  jetpack.write(latestPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary
  }, null, 2));

  // Log summary
  logger.log('Audit Summary:', summary);
}

function format(messages) {
  if (!Array.isArray(messages)) {
    return messages;
  }

  return messages.map(msg => `- ${msg}`).join('\n');
}

// Lighthouse audit functionality
// ⚠️⚠️⚠️ LIGHTHOUSE BREAKS WEB-MANAGER @SENTRY/CORE VERSION CONFLICTS
// So we lazy-load it only when needed
async function runLighthouseAudit() {
  logger.log('📊 Starting Lighthouse audit...');

  // Lazy load Lighthouse dependencies (only when actually running audit)
  // Lighthouse is not bundled to avoid @sentry/core version conflicts with web-manager
  chromeLauncher = require('chrome-launcher');
  try {
    lighthouse = require('lighthouse').default || require('lighthouse');
  } catch (e) {
    // Lighthouse not installed - try to install it temporarily via npx
    logger.log('📦 Lighthouse not found, installing temporarily...');
    try {
      // Use execSync to install lighthouse in node_modules temporarily
      const { execSync } = require('child_process');
      execSync('npm install --no-save lighthouse', {
        cwd: rootPathProject,
        stdio: 'inherit'
      });
      // Try requiring again after install
      const lighthousePath = path.join(rootPathProject, 'node_modules', 'lighthouse');
      lighthouse = require(lighthousePath).default || require(lighthousePath);
      logger.log('✅ Lighthouse installed temporarily');
    } catch (installError) {
      logger.error('❌ Failed to install Lighthouse. Install it globally:');
      logger.error('   npm install -g lighthouse');
      return;
    }
  }

  let serverStarted = false;
  let auditUrl = null;

  try {
    // Check if index.html exists
    const indexPath = path.join(rootPathProject, '_site', 'index.html');
    if (!jetpack.exists(indexPath)) {
      logger.error('❌ Could not find _site/index.html. Make sure Jekyll build completed successfully.');
      return;
    }

    // Get the URL to test (default to homepage if not specified)
    const customUrl = process.env.UJ_AUDIT_LIGHTHOUSE_URL || '/';

    // Check if it's just a path (starts with /)
    if (customUrl.startsWith('/')) {
      // Try to get the working URL and append the path
      try {
        const baseUrl = Manager.getWorkingUrl();
        if (baseUrl && baseUrl.includes(':')) {
          auditUrl = new URL(customUrl, baseUrl).href;
          logger.log(`Using path with working URL: ${auditUrl}`);
        } else {
          // No working server yet, will need to start one
          auditUrl = null;
        }
      } catch (e) {
        // No server running yet
        auditUrl = null;
      }
    } else {
      // It's a full URL
      auditUrl = customUrl;
      logger.log(`Using custom Lighthouse URL: ${auditUrl}`);
    }

    // If we couldn't set a URL from the custom path, try to get the working URL
    if (!auditUrl) {
      // Try to get the working URL (from BrowserSync if it's running)
      try {
        auditUrl = Manager.getWorkingUrl();
        // Check if it's a local URL with a port (indicates server is running)
        if (auditUrl && auditUrl.includes(':')) {
          const urlObj = new URL(auditUrl);
          if (urlObj.port) {
            logger.log(`Using existing server at ${auditUrl}`);
          }
        }
      } catch (e) {
        // No server running yet
      }
    }

    // If no working server and no custom URL, we need to ensure BrowserSync is running
    if (!auditUrl || !auditUrl.includes(':')) {
      logger.log('Ensuring BrowserSync server is running for Lighthouse audit...');

      // Run serve task (it will check if already running)
      const serve = require('./serve');
      await new Promise((resolve) => {
        serve(resolve);
      });

      // Wait for server to be ready and get the URL
      const maxRetries = 30;
      let retries = 0;

      while (retries < maxRetries) {
        try {
          auditUrl = Manager.getWorkingUrl();
          if (auditUrl && auditUrl.includes(':')) {
            const urlObj = new URL(auditUrl);
            if (urlObj.port) {
              logger.log(`Server ready at ${auditUrl}`);
              break;
            }
          }
        } catch (e) {
          // Continue waiting
        }

        retries++;
        if (retries % 5 === 0) {
          logger.log(`Waiting for server... (attempt ${retries}/${maxRetries})`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (!auditUrl || !auditUrl.includes(':')) {
        throw new Error('Failed to get server URL for Lighthouse audit');
      }

      // Append the path now that the server is running
      const pathToTest = process.env.UJ_AUDIT_LIGHTHOUSE_URL || '/';
      if (pathToTest.startsWith('/')) {
        auditUrl = new URL(pathToTest, auditUrl).href;
        logger.log(`Using path with server: ${auditUrl}`);
      }
    }

    logger.log(`Running Lighthouse on ${auditUrl}`);

    // Lighthouse configuration
    const lighthouseOptions = {
      logLevel: 'info',
      output: ['html', 'json'],
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      skipAudits: [
        // Skip these audits since local doesn't support HTTP/2
        'uses-http2',
      ],
      port: 9222,
    };

    const chromeFlags = ['--headless', '--disable-gpu', '--no-sandbox'];

    // Launch Chrome
    const chrome = await chromeLauncher.launch({ chromeFlags });
    lighthouseOptions.port = chrome.port;

    // Run Lighthouse
    const runnerResult = await lighthouse(auditUrl, lighthouseOptions);

    // Kill Chrome
    await chrome.kill();

    // Process results
    const { lhr, report } = runnerResult;

    // Extract scores
    const scores = {
      performance: Math.round(lhr.categories.performance.score * 100),
      accessibility: Math.round(lhr.categories.accessibility.score * 100),
      bestPractices: Math.round(lhr.categories['best-practices'].score * 100),
      seo: Math.round(lhr.categories.seo.score * 100),
    };

    // Log scores
    logger.log('📊 Lighthouse Scores:');
    logger.log(`  🚀 Performance: ${getScoreEmoji(scores.performance)} ${scores.performance}/100`);
    logger.log(`  ♿ Accessibility: ${getScoreEmoji(scores.accessibility)} ${scores.accessibility}/100`);
    logger.log(`  ✅ Best Practices: ${getScoreEmoji(scores.bestPractices)} ${scores.bestPractices}/100`);
    logger.log(`  🔍 SEO: ${getScoreEmoji(scores.seo)} ${scores.seo}/100`);

    // Calculate average
    const average = Math.round((scores.performance + scores.accessibility + scores.bestPractices + scores.seo) / 4);
    logger.log(`  📈 Average: ${getScoreEmoji(average)} ${average}/100`);

    // Save reports
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportDir = `${rootPathProject}/.temp/audit/lighthouse`;

    // Ensure report directory exists
    jetpack.dir(reportDir);

    // Save HTML report
    let htmlPath = null;
    if (report[0]) {
      htmlPath = `${reportDir}/lighthouse-${timestamp}.html`;
      jetpack.write(htmlPath, report[0]);
      logger.log(`📄 HTML report saved to: ${htmlPath}`);
    }

    // Save JSON report
    if (report[1]) {
      const jsonPath = `${reportDir}/lighthouse-${timestamp}.json`;
      jetpack.write(jsonPath, report[1]);
      logger.log(`📄 JSON report saved to: ${jsonPath}`);
    }

    // Save latest scores
    const scoresPath = `${reportDir}/latest-scores.json`;
    jetpack.write(scoresPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      url: auditUrl,
      scores,
      average
    }, null, 2));

    // Check if scores meet minimum thresholds
    const minScores = {
      performance: process.env.LIGHTHOUSE_MIN_PERFORMANCE || 70,
      accessibility: process.env.LIGHTHOUSE_MIN_ACCESSIBILITY || 90,
      bestPractices: process.env.LIGHTHOUSE_MIN_BEST_PRACTICES || 80,
      seo: process.env.LIGHTHOUSE_MIN_SEO || 80,
    };

    let failed = false;
    Object.keys(minScores).forEach(key => {
      const scoreKey = key === 'bestPractices' ? 'bestPractices' : key;
      if (scores[scoreKey] < minScores[key]) {
        logger.error(`❌ ${key} score (${scores[scoreKey]}) is below minimum threshold (${minScores[key]})`);
        failed = true;
      }
    });

    if (failed && process.env.LIGHTHOUSE_STRICT === 'true') {
      throw new Error('Lighthouse scores below minimum thresholds');
    }

    // Open the HTML report in the default browser
    if (htmlPath && process.env.LIGHTHOUSE_OPEN_REPORT !== 'false') {
      const openCommand = process.platform === 'darwin' ? 'open' :
                         process.platform === 'win32' ? 'start' : 'xdg-open';

      try {
        await execute(`${openCommand} "${htmlPath}"`, { log: false });
        logger.log('📊 Opening Lighthouse report in browser...');
      } catch (err) {
        logger.log(`💡 To view the report, open: ${htmlPath}`);
      }
    }

  } catch (error) {
    logger.error('Lighthouse audit failed:', error);
    if (process.env.LIGHTHOUSE_STRICT === 'true') {
      throw error;
    }
  } finally {
    // Note: We don't stop BrowserSync here since it might be used by other tasks
    // or the user might want to keep it running
    if (serverStarted) {
      logger.log('Note: BrowserSync server is still running. Stop it manually if needed.');
    }
  }

  logger.log('Lighthouse audit complete!');
}

// Helper function to get emoji based on score
function getScoreEmoji(score) {
  if (score >= 90) return '🟢';
  if (score >= 50) return '🟡';
  return '🔴';
}
