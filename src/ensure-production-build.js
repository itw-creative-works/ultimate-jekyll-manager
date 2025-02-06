// Libraries
const fs = require('fs');
const path = require('path');

// Load package
const packagePath = path.join(__dirname, '../../', 'package.json');
const projectPath = path.join(process.cwd(), 'package.json');

const package = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const project = JSON.parse(fs.readFileSync(projectPath, 'utf8'));

// Export
module.exports = () => {
  // Log
  console.log('Ensure production build');

  // Log
  console.log('package', package);
  console.log('project', project);
};
