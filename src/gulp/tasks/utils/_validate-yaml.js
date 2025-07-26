const fs = require('fs-jetpack');
const yaml = require('js-yaml');
const path = require('path');
const glob = require('glob');

function validateYAMLFrontMatter(filePath) {
  const content = fs.read(filePath);
  if (!content) return { valid: true };
  
  // Check if file has front matter
  const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---/;
  const match = content.match(frontMatterRegex);
  
  if (!match) return { valid: true };
  
  try {
    // Extract and parse YAML front matter
    const frontMatter = match[1];
    yaml.load(frontMatter);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
      file: filePath,
      line: error.mark ? error.mark.line : null
    };
  }
}

function validateAllYAML(directory) {
  const patterns = [
    '**/*.md',
    '**/*.html',
    '**/*.yml',
    '**/*.yaml'
  ];
  
  const errors = [];
  
  patterns.forEach(pattern => {
    const files = glob.sync(path.join(directory, pattern), {
      ignore: ['**/node_modules/**', '**/_site/**', '**/vendor/**']
    });
    
    files.forEach(file => {
      const result = validateYAMLFrontMatter(file);
      if (!result.valid) {
        errors.push(result);
      }
    });
  });
  
  if (errors.length > 0) {
    console.error('\n❌ YAML Validation Errors Found:\n');
    errors.forEach(err => {
      console.error(`File: ${err.file}`);
      console.error(`Error: ${err.error}`);
      if (err.line) {
        console.error(`Line: ${err.line}`);
      }
      console.error('---');
    });
    throw new Error(`Found ${errors.length} YAML validation error(s)`);
  } else {
    console.log('✅ All YAML front matter is valid');
  }
}

module.exports = {
  validateYAMLFrontMatter,
  validateAllYAML
};