// Libraries
const Manager = new (require('../../build.js'));
const logger = Manager.logger('lighthouse');
const { series, parallel } = require('gulp');
const jetpack = require('fs-jetpack');
const chromeLauncher = require('chrome-launcher');
const lighthouse = require('lighthouse').default || require('lighthouse');
const serve = require('./serve');
const https = require('https');
const { execute } = require('node-powertools');

// Load package
const package = Manager.getPackage('main');
const project = Manager.getPackage('project');
const config = Manager.getConfig('project');
const rootPathPackage = Manager.getRootPath('main');
const rootPathProject = Manager.getRootPath('project');

// Configuration
const lighthouseOptions = {
  logLevel: 'info',
  output: ['html', 'json'],
  onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
  port: 9222,
};

const chromeFlags = ['--headless', '--disable-gpu', '--no-sandbox'];

// Task
async function runLighthouse(complete) {
  // Log
  logger.log('Starting Lighthouse audit...');

  // Quit if UJ_LIGHTHOUSE_FORCE is not true
  if (process.env.UJ_LIGHTHOUSE_FORCE !== 'true') {
    logger.log('Skipping Lighthouse audit (set UJ_LIGHTHOUSE_FORCE=true to run)');
    return complete();
  }

  try {
    // Get the URL to test from environment variable, command line arg, or default
    let url = process.env.LIGHTHOUSE_URL || 'http://localhost:4000';

    // Check if a URL was passed as argument
    const args = process.argv;
    const urlArgIndex = args.findIndex(arg => arg === '--url');
    if (urlArgIndex !== -1 && args[urlArgIndex + 1]) {
      url = args[urlArgIndex + 1];
    }

    logger.log(`Running Lighthouse on ${url}`);

    // Launch Chrome
    const chrome = await chromeLauncher.launch({ chromeFlags });
    lighthouseOptions.port = chrome.port;

    // Run Lighthouse
    const runnerResult = await lighthouse(url, lighthouseOptions);

    // Kill Chrome
    await chrome.kill();

    // Process results
    const { lhr, report } = runnerResult;

    // Extract scores
    const scores = {
      performance: Math.round(lhr.categories.performance.score * 100),
      accessibility: Math.round(lhr.categories.accessibility.score * 100),
      bestPractices: Math.round(lhr.categories['best-practices'].score * 100),
      seo: Math.round(lhr.categories.seo.score * 100),
    };

    // Log scores
    logger.log('📊 Lighthouse Scores:');
    logger.log(`  🚀 Performance: ${getScoreEmoji(scores.performance)} ${scores.performance}/100`);
    logger.log(`  ♿ Accessibility: ${getScoreEmoji(scores.accessibility)} ${scores.accessibility}/100`);
    logger.log(`  ✅ Best Practices: ${getScoreEmoji(scores.bestPractices)} ${scores.bestPractices}/100`);
    logger.log(`  🔍 SEO: ${getScoreEmoji(scores.seo)} ${scores.seo}/100`);

    // Calculate average
    const average = Math.round((scores.performance + scores.accessibility + scores.bestPractices + scores.seo) / 4);
    logger.log(`  📈 Average: ${getScoreEmoji(average)} ${average}/100`);

    // Save reports
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportDir = `${rootPathProject}/.temp/reports/lighthouse`;

    // Ensure report directory exists
    jetpack.dir(reportDir);

    // Save HTML report
    let htmlPath = null;
    if (report[0]) {
      htmlPath = `${reportDir}/lighthouse-${timestamp}.html`;
      jetpack.write(htmlPath, report[0]);
      logger.log(`📄 HTML report saved to: ${htmlPath}`);
    }

    // Save JSON report
    if (report[1]) {
      const jsonPath = `${reportDir}/lighthouse-${timestamp}.json`;
      jetpack.write(jsonPath, report[1]);
      logger.log(`📄 JSON report saved to: ${jsonPath}`);
    }

    // Save latest scores
    const scoresPath = `${reportDir}/latest-scores.json`;
    jetpack.write(scoresPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      url,
      scores,
      average
    }, null, 2));

    // Check if scores meet minimum thresholds
    const minScores = {
      performance: process.env.LIGHTHOUSE_MIN_PERFORMANCE || 70,
      accessibility: process.env.LIGHTHOUSE_MIN_ACCESSIBILITY || 90,
      bestPractices: process.env.LIGHTHOUSE_MIN_BEST_PRACTICES || 80,
      seo: process.env.LIGHTHOUSE_MIN_SEO || 80,
    };

    let failed = false;
    Object.keys(minScores).forEach(key => {
      const scoreKey = key === 'bestPractices' ? 'bestPractices' : key;
      if (scores[scoreKey] < minScores[key]) {
        logger.error(`❌ ${key} score (${scores[scoreKey]}) is below minimum threshold (${minScores[key]})`);
        failed = true;
      }
    });

    if (failed && process.env.LIGHTHOUSE_STRICT === 'true') {
      throw new Error('Lighthouse scores below minimum thresholds');
    }

    // Open the HTML report in the default browser
    if (htmlPath) {
      const openCommand = process.platform === 'darwin' ? 'open' :
                         process.platform === 'win32' ? 'start' : 'xdg-open';
      
      try {
        await execute(`${openCommand} "${htmlPath}"`, { log: false });
        logger.log('📊 Opening Lighthouse report in browser...');
      } catch (err) {
        logger.log(`💡 To view the report, open: ${htmlPath}`);
      }
    }

  } catch (error) {
    logger.error('Lighthouse audit failed:', error);
    if (process.env.LIGHTHOUSE_STRICT === 'true') {
      throw error;
    }
  }

  // Log
  logger.log('Lighthouse audit complete!');

  // Complete
  return complete();
}

// Helper function to get emoji based on score
function getScoreEmoji(score) {
  if (score >= 90) return '🟢';
  if (score >= 50) return '🟡';
  return '🔴';
}

// Wait for server to be ready
async function waitForServer(complete) {
  const maxRetries = 30;
  let retries = 0;

  logger.log(`Waiting for server to be ready...`);

  while (retries < maxRetries) {
    try {
      // Get the working URL from Manager (only returns local URL when server is ready)
      const workingUrl = Manager.getWorkingUrl();
      
      // Check if the URL contains a port (indicates local server is running)
      if (workingUrl && workingUrl.includes(':')) {
        // Extract port to verify it's a local URL
        const urlObj = new URL(workingUrl);
        if (urlObj.port) {
          logger.log(`Server is ready at ${workingUrl}!`);
          
          // Update the LIGHTHOUSE_URL environment variable with the working URL
          process.env.LIGHTHOUSE_URL = workingUrl;
          
          return complete();
        }
      }
    } catch (e) {
      // Continue trying - server not ready yet
    }
    
    retries++;
    if (retries % 5 === 0) {
      logger.log(`Waiting for server... (attempt ${retries}/${maxRetries})`);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error('Server failed to start after 30 seconds');
}

// Task that starts server and runs lighthouse
async function lighthouseWithServer(complete) {
  // Get the URL to check if we need to start server
  const args = process.argv;
  const urlArgIndex = args.findIndex(arg => arg === '--url');
  const url = urlArgIndex !== -1 && args[urlArgIndex + 1] ? args[urlArgIndex + 1] : null;

  // Get global tasks
  const tasks = global.tasks;

  // If no URL specified or URL contains a port (local server), build and start the server
  if (!url || (url && url.includes(':'))) {
    try {
      const urlObj = new URL(url || 'http://localhost:4000');
      // Only start server if it has a port (local server)
      if (urlObj.port || !url) {
        // Build everything first, then serve and run lighthouse
        return series(
          // Build tasks (from main.js build process)
          tasks.defaults,
          tasks.distribute,
          parallel(tasks.webpack, tasks.sass, tasks.imagemin),
          tasks.jsonToHtml,
          tasks.jekyll,
          // Now serve and run lighthouse
          parallel(
            serve,
            series(waitForServer, runLighthouse)
          )
        )(complete);
      }
    } catch (e) {
      // If URL parsing fails, assume we need to start server with build
      return series(
        // Build tasks
        tasks.defaults,
        tasks.distribute,
        parallel(tasks.webpack, tasks.sass, tasks.imagemin),
        tasks.jsonToHtml,
        tasks.jekyll,
        // Now serve and run lighthouse
        parallel(
          serve,
          series(waitForServer, runLighthouse)
        )
      )(complete);
    }
  }
  
  // For external URLs without ports, just run lighthouse
  return runLighthouse(complete);
}

// Default Task
module.exports = lighthouseWithServer;
