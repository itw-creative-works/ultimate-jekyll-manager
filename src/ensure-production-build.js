// Libraries
const fs = require('fs');
const path = require('path');

// Load package
const projectPath = path.join(process.cwd(), 'package.json');
const project = JSON.parse(fs.readFileSync(projectPath, 'utf8'));

// Export
module.exports = () => {
  // Log
  console.log('Ensure production build');

  // Log
  console.log('project', project);

  // Fix devDependencies
  project.devDependencies = project.devDependencies || {};

  // Get UJ version
  const ujVersion = project.devDependencies['ultimate-jekyll-manager'];
};
