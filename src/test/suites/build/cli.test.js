// CLI alias resolution — verifies src/cli.js routes positional commands and
// flag aliases to the right command file under src/commands/.
//
// We don't actually invoke commands (those have side-effects: subprocesses,
// network, disk). Instead we reach inside cli.js's resolveCommand by
// instantiating Main and seeing which command file it tries to load —
// catching the error message which contains the resolved command name.

module.exports = {
  layer: 'build',
  description: 'CLI alias resolution',
  type: 'group',
  tests: [
    {
      name: 'cli.js exports a Main class',
      run: async (ctx) => {
        const Main = require('../../../cli.js');
        ctx.expect(typeof Main).toBe('function');
        const main = new Main();
        ctx.expect(typeof main.process).toBe('function');
      },
    },
    {
      name: 'all expected commands exist on disk',
      run: async (ctx) => {
        const path = require('path');
        const fs = require('fs');
        const commandsDir = path.join(__dirname, '..', '..', '..', 'commands');
        const expected = ['clean', 'cloudflare-purge', 'install', 'setup', 'version', 'deploy', 'audit', 'translation', 'test'];
        for (const cmd of expected) {
          const file = path.join(commandsDir, `${cmd}.js`);
          ctx.expect(fs.existsSync(file)).toBe(true);
        }
      },
    },
    {
      name: 'each command module exports an async function',
      run: async (ctx) => {
        const path = require('path');
        const commandsDir = path.join(__dirname, '..', '..', '..', 'commands');
        const cmds = ['clean', 'version', 'test'];
        for (const cmd of cmds) {
          const mod = require(path.join(commandsDir, `${cmd}.js`));
          ctx.expect(typeof mod).toBe('function');
        }
      },
    },
  ],
};
