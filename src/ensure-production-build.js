// Libraries
const jetpack = require('fs-jetpack');
const path = require('path');

// Load package
const package = jetpack.read(path.join(__dirname, '../../', 'package.json'), 'json');
const project = jetpack.read(path.join(process.cwd(), 'package.json'), 'json');

// Export
module.exports = () => {
  // Log
  console.log('Ensure production build');

  // Log
  console.log('package', package);
  console.log('project', project);
};
