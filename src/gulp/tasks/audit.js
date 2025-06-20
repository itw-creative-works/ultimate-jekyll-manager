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

// Task
async function audit(complete) {
  // Log
  logger.log('Starting...');

  // Quit if NOT in build mode and UJ_FORCE_AUDIT is not true
  if (!Manager.isBuildMode() && process.env.UJ_FORCE_AUDIT !== 'true') {
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

async function validateFormat(file, content) {
  // Log
  // logger.log(`➡️ Validating HTML in ${file}`);

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
        const formatted = await formatDocument(content, format, true);

        // Save the formatted content back to the file
        jetpack.write(file, formatted);

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
  const htmlFiles = glob(input, {
    nodir: true,
    ignore: [
      // Auth files
      '_site/__/auth/**/*',

      // Sitemap
      '**/sitemap.html',
    ]
  });

  // Run validations in parallel
  const results = await Promise.all(
    htmlFiles.map(async (file) => {
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
    })
  );

  // Log results
  const summary = {
    totalFiles: htmlFiles.length,
    validFiles: 0,
    invalidFiles: 0
  };

  results.forEach(({ file, formatValidation, spellingValidation }) => {
    logger.log(`🔍 Results for file: ${file}`);

    if (formatValidation.valid) {
      logger.log(`✅ Format validation passed.`);
    } else {
      logger.log(`❌ Format validation failed:`);
      console.log(format(formatValidation.messages));
    }

    if (spellingValidation.valid) {
      logger.log(`✅ Spelling validation passed.`);
    } else {
      logger.log(`❌ Spelling validation failed:`);
      console.log(format(spellingValidation.misspelledWords));
    }

    if (formatValidation.valid && spellingValidation.valid) {
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
