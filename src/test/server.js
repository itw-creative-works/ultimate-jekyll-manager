// Tiny zero-dep HTTP server used by the test harness to serve a directory
// (either the harness HTML page for the `page` layer, or the consumer's built
// `_site/` for the `boot` layer).
//
// Why a real HTTP server and not file://?
//   - Service workers DO NOT register from file:// URLs. The boot layer
//     specifically verifies SW registration, so we need a real http origin.
//   - Some Web APIs (cookies, localStorage scoping) behave differently on file://.
//
// Why hand-roll instead of using `express`/`serve-static`?
//   - Zero deps, fast startup, no risk of clashing with consumer's pinned
//     versions of express. The functionality we need is ~80 lines.
//
// Usage:
//   const { startServer } = require('./server.js');
//   const server = await startServer({ root: '/path/to/_site' });
//   // ...point Puppeteer at server.baseUrl
//   await server.close();

const http = require('http');
const path = require('path');
const fs   = require('fs');

const MIME = {
  '.html':  'text/html; charset=utf-8',
  '.htm':   'text/html; charset=utf-8',
  '.js':    'text/javascript; charset=utf-8',
  '.mjs':   'text/javascript; charset=utf-8',
  '.css':   'text/css; charset=utf-8',
  '.json':  'application/json; charset=utf-8',
  '.svg':   'image/svg+xml',
  '.png':   'image/png',
  '.jpg':   'image/jpeg',
  '.jpeg':  'image/jpeg',
  '.gif':   'image/gif',
  '.webp':  'image/webp',
  '.ico':   'image/x-icon',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':   'font/ttf',
  '.otf':   'font/otf',
  '.txt':   'text/plain; charset=utf-8',
  '.xml':   'application/xml; charset=utf-8',
  '.map':   'application/json; charset=utf-8',
};

function startServer({ root }) {
  if (!root) throw new Error('startServer: root is required');
  const absRoot = path.resolve(root);

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        // Strip query string + decode.
        let urlPath = decodeURIComponent(req.url.split('?')[0]);
        // Strip leading slash, drop any `..` traversal.
        if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

        // Resolve against root; refuse anything that escapes root.
        const filePath = path.normalize(path.join(absRoot, urlPath));
        if (!filePath.startsWith(absRoot)) {
          res.writeHead(403); res.end('Forbidden');
          return;
        }

        let stat;
        try {
          stat = fs.statSync(filePath);
        } catch (_) {
          // Try .html suffix (Jekyll convention: /about → /about.html).
          try {
            const fallback = filePath + '.html';
            const stat2 = fs.statSync(fallback);
            if (stat2.isFile()) return serveFile(fallback, stat2, res);
          } catch (_) { /* fall through to 404 */ }
          res.writeHead(404); res.end('Not Found');
          return;
        }

        if (stat.isDirectory()) {
          const indexPath = path.join(filePath, 'index.html');
          try {
            const idxStat = fs.statSync(indexPath);
            return serveFile(indexPath, idxStat, res);
          } catch (_) { /* fall through */ }
          res.writeHead(404); res.end('Not Found');
          return;
        }

        return serveFile(filePath, stat, res);
      } catch (e) {
        res.writeHead(500); res.end('Server error: ' + e.message);
      }
    });

    server.on('error', reject);

    // Bind to ephemeral port on loopback.
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({
        port,
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

function serveFile(filePath, stat, res) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';

  res.writeHead(200, {
    'Content-Type':           mime,
    'Content-Length':         stat.size,
    // Allow service workers to register at the site root regardless of the SW
    // file's location. Matters when consumer SW lives at /service-worker.js
    // but other JS lives in /assets/js/. Without this, registration with
    // `scope: '/'` from /assets/js/sw.js would fail.
    'Service-Worker-Allowed': '/',
    'Cache-Control':          'no-store',
  });
  fs.createReadStream(filePath).pipe(res);
}

module.exports = { startServer };
