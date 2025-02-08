// Plugin
class ReplacePlugin {
  constructor(replacements) {
    this.replacements = replacements;
  }

  apply(compiler) {
    compiler.hooks.compilation.tap('ReplacePlugin', (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: 'ReplacePlugin',
          stage: compilation.PROCESS_ASSETS_STAGE_OPTIMIZE, // Use an appropriate stage
        },
        (assets) => {
          // Iterate through all compiled assets,
          // replace each placeholder with the corresponding value
          for (const filename in assets) {
            if (filename.endsWith('.js')) {
              let asset = assets[filename];
              let content = asset.source();

              // Perform replacements
              for (const [placeholder, replacement] of Object.entries(this.replacements)) {
                const regex = new RegExp(placeholder, 'g');
                content = content.replace(regex, replacement);
              }

              // Update the asset with the new content
              compilation.updateAsset(
                filename,
                new compiler.webpack.sources.RawSource(content)
              );
            }
          }
        }
      );
    });
  }
}

// Export
module.exports = ReplacePlugin;
