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
  Manager.logMemory(logger, 'Start');

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
      serveStaticOptions: {
        extensions: ['html'],  // Try .html extension automatically
        redirect: false,       // Don't add trailing slashes
      },
      routes: {
        '/src': 'src'  // Allow serving from src/ for media fallback
      },
      middleware: [
        // require('compression')({
        //   threshold: 0, // Compress all files regardless of size
        //   level: 9 // Maximum compression (1-9)
        // }),
        processRequestMiddleware,
      ],
    },
  }

  // Check if browserSync is already running
  if (browserSync.active) {
    logger.log('BrowserSync is already running');

    return complete();
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
//     jetpack.write('.temp/_config_browsersync.yml', `
// url: ${externalUrl}

// web_manager:
//   firebase:
//     app:
//       config:
//         authDomain: "${new URL(externalUrl).host}"
// `);
//     jetpack.write('.temp/_config_browsersync.yml', `
// url: ${externalUrl}

// web_manager:
//   firebase:
//     app:
//       config:
//         authDomain: "${new URL(localUrl).host}"
// `);

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

// Middleware function to process requests
async function processRequestMiddleware(req, res, next) {
  const url = new URL(`${localUrl}${req.url}`);
  const pathname = url.pathname;

  // Set the query object
  req.query = {};
  req.body = {};

  // If the file has no ext, log it
    // logger.log(`----- ${pathname}`);
  if (!path.extname(pathname)) {
    logger.log(`Serving ${pathname}`);
  }

  // Fallback for media files: serve from src/ if not in _site/
  // This handles cases where imagemin hasn't run and optimized variants don't exist
  const isMedia = pathname.startsWith('/assets/images/') || pathname.startsWith('/assets/videos/');
  if (isMedia) {
    const startTime = Date.now();
    const cleanPath = pathname.split('?')[0];
    const siteFilePath = path.join(rootPathProject, '_site', cleanPath);

    // If file exists in _site, serve normally
    if (jetpack.exists(siteFilePath)) {
      logger.log(`[media] Found in _site: ${cleanPath} (${Date.now() - startTime}ms)`);
      return next();
    }

    // Try to find the original file in src/
    // First, try the exact path
    let srcFilePath = path.join(rootPathProject, 'src', cleanPath);

    // If not found, try stripping imagemin suffixes (-320px, -640px, -1024px) and .webp extension
    if (!jetpack.exists(srcFilePath)) {
      let originalPath = cleanPath;

      // Remove size suffix (e.g., -320px, -640px, -1024px)
      originalPath = originalPath.replace(/-\d+px(\.[^.]+)$/, '$1');

      // If it's a .webp, try original extensions
      if (originalPath.endsWith('.webp')) {
        const basePath = originalPath.replace(/\.webp$/, '');
        const possibleExts = ['.jpg', '.jpeg', '.png', '.gif'];

        for (const ext of possibleExts) {
          const testPath = path.join(rootPathProject, 'src', basePath + ext);
          if (jetpack.exists(testPath)) {
            srcFilePath = testPath;
            break;
          }
        }
      } else {
        srcFilePath = path.join(rootPathProject, 'src', originalPath);
      }
    }

    // Serve from src if found
    if (jetpack.exists(srcFilePath)) {
      const relativeSrcPath = path.relative(rootPathProject, srcFilePath);
      logger.log(`[media] Serving from src: ${cleanPath} -> ${relativeSrcPath} (${Date.now() - startTime}ms)`);
      req.url = '/' + relativeSrcPath;
    } else {
      logger.log(`[media] Not found: ${cleanPath} (${Date.now() - startTime}ms)`);
    }
  }

  // Run middleware:request hook to allow custom URL rewriting
  await hook('middleware/request', { req, res, pathname });

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

  // Rewrite URLs to .html when needed
  // serveStaticOptions handles simple cases, but not:
  // - When a directory exists with the same name (e.g., /updates → /updates.html)
  // - When the path looks like it has an extension but doesn't exist (e.g., /updates/v0.0.1)
  const cleanPathname = pathname.split('?')[0].split('#')[0].replace(/\/$/, '');
  const originalPath = path.join(rootPathProject, '_site', cleanPathname);
  const htmlPath = path.join(rootPathProject, '_site', `${cleanPathname}.html`);
  const originalExists = jetpack.exists(originalPath);

  if (originalExists !== 'file' && jetpack.exists(htmlPath) === 'file') {
    req.url = `${cleanPathname}.html`;
  }

  // Continue
  return next();
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

// Run hooks
async function hook(file, context) {
  // Full path
  const fullPath = path.join(process.cwd(), 'hooks', `${file}.js`);

  // Check if it exists
  if (!jetpack.exists(fullPath)) {
    // Silently skip if hook doesn't exist (it's optional)
    return;
  }

  // Log
  // logger.log(`Running hook: ${fullPath}`);

  // Load hook
  let hookFn;
  try {
    // Clear the cache to allow live reloading of hooks during development
    delete require.cache[require.resolve(fullPath)];

    // Load the hook
    hookFn = require(fullPath);
  } catch (e) {
    throw new Error(`Error loading hook: ${fullPath} ${e.stack}`);
  }

  // Execute hook
  try {
    return await hookFn(context);
  } catch (e) {
    throw new Error(`Error running hook: ${fullPath} ${e.stack}`);
  }
}
