const Manager = new (require('../../../build.js'));

const prettier = require('prettier');
const path = require('path');

// Load package
const rootPathPackage = Manager.getRootPath('main');

module.exports = async (content, format) => {
  // Set default format to 'html' if not provided
  format = format || 'html';

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
      return {
        content: removeMultipleNewlines(formatted),
        error: null,
      };
    })
    .catch((e) => {
      return {
        content: removeMultipleNewlines(content),
        error: e,
      };
    });
};

function removeMultipleNewlines(content) {
  return content.replace(/\n\s*\n+/g, '\n').trim();
}
