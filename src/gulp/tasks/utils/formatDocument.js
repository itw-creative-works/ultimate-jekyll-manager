const Manager = new (require('../../../build.js'));

const prettier = require('prettier');
const path = require('path');

// Load package
const rootPathPackage = Manager.getRootPath('main');

module.exports = async function formatHTML(content, format, throwError) {
  // Set default format to 'html' if not provided
  format = format || 'html';
  throwError = typeof throwError === 'undefined' ? true : throwError;

  // Setup Prettier options
  const options = {
    parser: format,
  };

  // If formatting XML, load plugin from UJ's node_modules
  if (format === 'xml') {
    options.plugins = [
      require.resolve('@prettier/plugin-xml', {
        paths: [rootPathPackage],
      }),
    ];
    options.xmlWhitespaceSensitivity = 'ignore';
  }

  // Process the content with Prettier
  return prettier
    .format(content, options)
    .then((formatted) => {
      return removeMultipleNewlines(formatted);
    })
    .catch((e) => {
      if (throwError) {
        throw e;
      }
      return removeMultipleNewlines(content);
    });
};

function removeMultipleNewlines(content) {
  return content.replace(/\n\s*\n+/g, '\n');
}
