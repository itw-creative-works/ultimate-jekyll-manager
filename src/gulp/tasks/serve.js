// Libraries
const Manager = new (require('../../build.js'));
const logger = Manager.logger('serve');
const path = require('path');
const browserSync = require('browser-sync').create();
const jetpack = require('fs-jetpack');
const { execute } = require('node-powertools');

// Load package
const package = Manager.getPackage('main');
const project = Manager.getPackage('project');
const config = Manager.getConfig('project');
const rootPathPackage = Manager.getRootPath('main');
const rootPathProject = Manager.getRootPath('project');

// Local URL
let localUrl;
let externalUrl;

// Task
module.exports = async function serve(complete) {
  // Log
  logger.log('Starting...');

  // BrowserSync settings
  const settings = {
    port: 4000,
    browser: 'default',
    cors: true,
    open: false,
    ghostMode: false,
    https: await getHttpsConfig(), // Enable HTTPS with mkcert or self-signed certificates
    server: {
      baseDir: '_site',
      middleware: async function (req, res, next) {
        const url = new URL(`${localUrl}${req.url}`);
        const pathname = url.pathname;

        // Set the query object
        req.query = {};
        req.body = {};

        // If the file has no ext, log it
        if (!path.extname(pathname)) {
          logger.log(`Serving ${pathname}`);
        }

        // Process the post request
        if (pathname.match(/\/_process/)) {
          const qsUrl = url.searchParams.get('url');
          let lib;

          // Set query
          url.searchParams.forEach((value, key) => {
            req.query[key] = value;
          })

          // Set body
          if (req.method === 'POST') {
            req.body = await receiveRequestBody(req);
          }

          // Try to load the library
          try {
            // Clear the cache
            delete require.cache[require.resolve(`../${qsUrl}`)];

            // Load the library
            lib = require(`../${qsUrl}`);
          } catch (e) {
            // Log the error
            logger.error(`Error processing ${qsUrl}`);

            // Set the status code
            res.statusCode = 500;

            // Return an error
            return res.write(`Cannot find ${qsUrl}`);
          }

          // Log
          logger.log(`Processing ${qsUrl}`);

          // Process the library
          return await lib({
            req: req,
            res: res,
          })
          .then((r) => {
            // Set the status code
            res.statusCode = 200;

            // Write the response (if it's JSON, set the content type)
            try {
              r = JSON.stringify(r);
              res.setHeader('Content-Type', 'application/json');
            } catch (e) {
            }

            // End the response
            res.write(r);
            res.end();
          })
          .catch((e) => {
            // Set the status code
            res.statusCode = 500;

            // Write the error
            res.write(`Error processing ${qsUrl}: ${e}`);
            res.end();
          });
        }

        // Check if the URL is missing a trailing slash and does not have an extension
        if (!pathname.endsWith('/') && !path.extname(pathname)) {
          // Get the new URL
          const newURL = `${pathname}.html`;

          // Log
          // logger.log(`Rewriting ${pathname} to ${newURL}`);

          // Rewrite it to serve the .html extension
          req.url = newURL;
        }

        // Special case: Rewrite /blog/ to blog.html since Jekyll fucks it up locally
        if (pathname === '/blog/') {
          req.url = '/blog.html';
        }

        // Strip query parameters and hash fragments from the URL for file path lookup
        const cleanUrl = req.url.split('?')[0].split('#')[0];
        const rawFilePath = path.join(rootPathProject, '_site', cleanUrl);

        // Serve 404.html if the file does not exist
        if (!jetpack.exists(rawFilePath) && rawFilePath.endsWith('.html')) {
          // Log
          logger.log(`File not found: ${req.url}. Serving 404.html instead.`);
          req.url = '/404.html';
        }

        // Continue
        return next();
      },
    },
  }

  // Initialize browserSync
  browserSync.init(settings, async (e, instance) => {
    // Quit if there's an error
    if (e) {
      return logger.error(e);
    }

    // Get URLs
    localUrl = instance.options.get('urls').get('local');
    externalUrl = instance.options.get('urls').get('external');

    // Write the config file
    jetpack.write('.temp/_config_browsersync.yml', `url: ${externalUrl}`);

    // Set global variable to access browserSync in other files
    global.browserSync = browserSync;

    // Log
    logger.log('Finished!');

    // Complete
    return complete();
  });
};

// Get local network IP address
function getLocalNetworkIP() {
  const os = require('os');
  const interfaces = os.networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (iface.internal || iface.family !== 'IPv4') continue;

      // Return the first external IPv4 address found
      return iface.address;
    }
  }

  return null;
}

// HTTPS Configuration
async function getHttpsConfig() {
  // Check if mkcert certificates exist
  const certPath = path.join(rootPathProject, '.temp');

  // Look for any mkcert generated files (handles localhost+2.pem format)
  const certFiles = jetpack.find(certPath, { matching: 'localhost*.pem' }) || [];
  const keyFile = certFiles.find(f => f.includes('-key.pem'));
  const certFile = certFiles.find(f => !f.includes('-key.pem'));

  if (keyFile && certFile) {
    logger.log('Using mkcert certificates from .temp/');
    logger.log(`Certificate: ${certFile}`);
    logger.log(`Key: ${keyFile}`);

    // Read certificate to check validity
    try {
      const certContent = jetpack.read(certFile);
      if (certContent && certContent.includes('BEGIN CERTIFICATE')) {
        logger.log('✅ Certificate appears valid');
      }
    } catch (e) {
      logger.log('⚠️ Could not read certificate');
    }

    return {
      key: keyFile,
      cert: certFile
    };
  }

  // Try to generate mkcert certificates
  const generated = await generateMkcertCertificates(certPath);
  if (generated) {
    return {
      key: generated.key,
      cert: generated.cert
    };
  }

  // Fall back to self-signed certificates
  logger.log('Using self-signed certificates (browser warnings expected)');
  logger.log('For trusted HTTPS: brew install mkcert && mkcert -install');
  return true;
}

// Generate mkcert certificates
async function generateMkcertCertificates(certPath) {
  try {
    // Check if mkcert is installed
    await execute('which mkcert');

    // Install mkcert CA if not already installed
    try {
      await execute('mkcert -install');
      logger.log('mkcert CA installed/verified');
    } catch (e) {
      logger.log('Warning: Could not install mkcert CA');
    }

    logger.log('mkcert found! Generating trusted certificates...');

    // Get local network IP
    const publicHost = `development.${new URL(config.url).hostname}`;
    const localIP = getLocalNetworkIP();
    const hosts = [publicHost, 'localhost', '127.0.0.1', '::1'];
    if (localIP) {
      hosts.push(localIP);
      logger.log(`Including local network IP: ${localIP}`);
    }

    // Generate certificates
    await execute(`cd "${certPath}" && mkcert ${hosts.join(' ')}`, { log: true});

    // Find the generated files
    const certFiles = jetpack.find(certPath, { matching: '*.pem' }) || [];
    const keyFile = certFiles.find(f => f.includes('-key.pem'));
    const certFile = certFiles.find(f => !f.includes('-key.pem'));

    if (keyFile && certFile) {
      logger.log('✅ Trusted certificates generated in .temp/');
      return { key: keyFile, cert: certFile };
    }

    return false;
  } catch (e) {
    logger.log('mkcert not found. Install with: brew install mkcert');
    return false;
  }
}

function receiveRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = [];

    // Listen for data
    req.on('data', (chunk) => {
      body.push(chunk.toString());
    });

    // Listen for errors
    req.on('error', (err) => {
      return reject(err);
    });

    // Listen for the end of the request
    req.on('finish', () => {
      body = body.join('');

      // Attempt to parse the body as JSON
      try {
        return resolve(JSON.parse(body));
      } catch (e) {
        return resolve(body);
      }
    });
  });
}
