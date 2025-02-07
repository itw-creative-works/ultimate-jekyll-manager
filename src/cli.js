// Libraries
const path = require('path');
const jetpack = require('fs-jetpack');

// Main Function
function Main() {
  const self = this;
}

Main.prototype.process = async function (options) {
  const self = this;

  // Determine the command (default to "setup" if none provided)
  const command = options._[0] || 'setup';

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
