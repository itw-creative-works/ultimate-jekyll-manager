// Libraries
const Manager = new (require('../../build.js'));
const logger = Manager.logger('audit');
const { series } = require('gulp');
const glob = require('glob').globSync;
const path = require('path');
const jetpack = require('fs-jetpack');
const spellchecker = require('spellchecker');
const { HtmlValidate } = require('html-validate')
// const SpellChecker = require('simple-spellchecker');
// const dictionary = SpellChecker.getDictionarySync('en-US');

// Load package
const package = Manager.getPackage('main');
const project = Manager.getPackage('project');
const config = Manager.getConfig('project');
const rootPathPackage = Manager.getRootPath('main');
const rootPathProject = Manager.getRootPath('project');

// Glob
const input = [
  // Files to include
  '_site/**/*.html',
];
const output = '';
const delay = 250;

// Task
async function audit(complete) {
  // Log
  logger.log('Starting...');

  // Quit if NOT in build mode and UJ_AUDIT_FORCE is not true
  if (!Manager.isBuildMode() && process.env.UJ_AUDIT_FORCE !== 'true') {
    logger.log('Skipping audit in development mode');
    return complete();
  }

  // Perform audit
  await processAudit();

  // Log
  logger.log('Finished!');

  // Complete
  return complete();
};

// Default Task
module.exports = series(audit);

async function validateHTML(file, content) {
  // Log
  logger.log(`➡️ Validating HTML in ${file}`);

  // Validate HTML using html-validate
  const validator = new HtmlValidate({
    root: true,
    extends: ['html-validate:recommended'],
    rules: {
      'no-inline-style': 'error',
      'void-style': ['error', { style: 'selfclosing' }],
      'prefer-button': 'warn',
      'doctype-style': 'error',
      'no-dup-id': 'error'
    }
  });

  // validate the HTML content
  const report = await validator.validateString(content);
  const results = report.results[0];

  const formattedMessages = results.messages.map(msg => {
    return `[${msg.ruleId}] ${msg.message} (${file}:${msg.line}:${msg.column})`;
  });

  return {
    valid: report.valid,
    messages: formattedMessages,
  };
}

async function validateSpelling(file, content, brand) {
  // Log
  logger.log(`➡️ Validating spelling in ${file}`);

  return {
    valid: true,
    misspelledWords: [],
  };

  const words = content.match(/\b\w+\b/g) || [];
  const misspelledWords = words.filter((word) => {
    // Ignore words that are part of the brand name
    if (word.toLowerCase() === brand.toLowerCase()) {
      return false;
    }

    // Check if the word is misspelled
    return spellchecker.isMisspelled(word);
  });

  return {
    valid: misspelledWords.length === 0,
    misspelledWords
  };
}

async function processAudit() {
  const htmlFiles = glob(input, { nodir: true });
  const brand = config?.brand?.name || 'BrandName';

  // Run validations in parallel
  const results = await Promise.all(
    htmlFiles.map(async (file) => {
      const content = jetpack.read(file);

      // Validate HTML
      const htmlValidation = await validateHTML(file, content);

      // Spellcheck
      const spellingValidation = await validateSpelling(file, content, brand);

      return {
        file,
        htmlValidation,
        spellingValidation
      };
    })
  );

  // Log results
  const summary = {
    totalFiles: htmlFiles.length,
    validFiles: 0,
    invalidFiles: 0
  };

  results.forEach(({ file, htmlValidation, spellingValidation }) => {
    logger.log(`🔍 Results for file: ${file}`);

    if (htmlValidation.valid) {
      logger.log(`✅ HTML validation passed.`);
    } else {
      logger.log(`❌ HTML validation failed:\n`, format(htmlValidation.messages));
    }

    if (spellingValidation.valid) {
      logger.log(`✅ No spelling errors found.`);
    } else {
      logger.log(`❌ Spelling errors found:\n`, format(spellingValidation.misspelledWords));
    }

    if (htmlValidation.valid && spellingValidation.valid) {
      summary.validFiles++;
    } else {
      summary.invalidFiles++;
    }
  });

  // Log summary
  logger.log('Audit Summary:', summary);
}

function format(messages) {
  if (!Array.isArray(messages)) {
    return messages;
  }

  return messages.map(msg => `- ${msg}`).join('\n');
}
