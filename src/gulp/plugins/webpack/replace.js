// Plugin
class ReplacePlugin {
  constructor(replacements) {
    this.replacements = replacements;
  }

  apply(compiler) {
    compiler.hooks.emit.tapAsync('ReplacePlugin', (compilation, callback) => {
      // Iterate through all compiled assets,
      // replace each placeholder with the corresponding value
      for (const filename in compilation.assets) {
        if (filename.endsWith('.js')) {
          let asset = compilation.assets[filename];
          let content = asset.source();

          // Perform replacements
          for (const [placeholder, replacement] of Object.entries(this.replacements)) {
            const regex = new RegExp(placeholder, 'g');
            content = content.replace(regex, replacement);
          }

          // Update the asset with the new content
          compilation.assets[filename] = {
            source: () => content,
            size: () => content.length,
          };
        }
      }

      callback();
    });
  }
}

// Export
module.exports = ReplacePlugin;
