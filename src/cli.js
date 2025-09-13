// Libraries
const path = require('path');
const jetpack = require('fs-jetpack');

// Command Aliases
const DEFAULT = 'setup';
const ALIASES = {
  clean: ['-c', '--clean'],
  'cloudflare-purge': ['-cf', 'purge', '--cloudflare-purge'],
  install: ['-i', 'i', '--install'],
  setup: ['-s', '--setup'],
  version: ['-v', '--version'],
  // Tasks
  audit: ['-a', '--audit'],
  translation: ['-t', '--translation'],
};

// Function to resolve command name from aliases
function resolveCommand(options) {
  // Check if a command was explicitly passed via positional argument
  if (options._.length > 0) {
    const command = options._[0];
    for (const [key, aliases] of Object.entries(ALIASES)) {
      if (command === key || aliases.includes(command)) {
        return key;
      }
    }
    return command; // If not found in aliases, return as-is
  }

  // Check if any alias was passed as a flag (e.g., -g)
  for (const [key, aliases] of Object.entries(ALIASES)) {
    for (const alias of aliases) {
      if (options[alias.replace(/^-+/, '')]) { // Remove leading `-`
        return key;
      }
    }
  }

  return DEFAULT; // Fallback to default if no match is found
}

// Main Function
function Main() {}

Main.prototype.process = async function (options) {
  // Fix options
  options = options || {};
  options._ = options._ || [];

  // Parse --key=value arguments from the _ array
  if (options._ && options._.length > 0) {
    options._.forEach(arg => {
      if (typeof arg === 'string' && arg.startsWith('--') && arg.includes('=')) {
        const [key, value] = arg.substring(2).split('=');
        // Convert kebab-case to camelCase
        const camelKey = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        options[camelKey] = value;
      }
    });
  }

  // Determine the command (use default if not provided)
  const command = resolveCommand(options);

  try {
    // Get the command file path
    const commandFile = path.join(__dirname, 'commands', `${command}.js`);

    // Check if the command file exists
    if (!jetpack.exists(commandFile)) {
      throw new Error(`Error: Command "${command}" not found.`);
    }

    // Execute the command
    const Command = require(commandFile);
    await Command(options);
  } catch (e) {
    console.error(`Error executing command "${command}": ${e.message}`);

    // Exit with error
    throw e;
  }
};

module.exports = Main;
