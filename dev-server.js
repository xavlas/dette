#!/usr/bin/env node
// Serveur de dev sans dépendance avec live reload (SSE). Usage : node dev-server.js [port]
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.argv[2] || process.env.PORT || 8080);
const IGNORE = /(^|[\/\\])(\.git|node_modules|tests)([\/\\]|$)/;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const RELOAD_SNIPPET = `<script>
(() => {
  const es = new EventSource('/__livereload');
  es.onmessage = (e) => {
    if (e.data === 'css') {
      document.querySelectorAll('link[rel="stylesheet"]').forEach((l) => {
        const u = new URL(l.href); u.searchParams.set('_lr', Date.now()); l.href = u.href;
      });
    } else location.reload();
  };
})();
</script>`;

const clients = new Set();

function broadcast(msg) {
  for (const res of clients) res.write(`data: ${msg}\n\n`);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/__livereload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(': connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';

  const file = path.join(ROOT, pathname);
  if (!file.startsWith(ROOT + path.sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    const ext = path.extname(file).toLowerCase();
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' };
    if (ext === '.html') {
      const html = data.toString('utf8');
      data = html.includes('</body>') ? html.replace('</body>', `${RELOAD_SNIPPET}</body>`) : html + RELOAD_SNIPPET;
    }
    res.writeHead(200, headers).end(data);
  });
});

let timer;
fs.watch(ROOT, { recursive: true }, (_event, filename) => {
  if (!filename || IGNORE.test(filename)) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    const isCss = path.extname(filename) === '.css';
    console.log(`[livereload] ${filename} modifié -> ${isCss ? 'css' : 'reload'}`);
    broadcast(isCss ? 'css' : 'reload');
  }, 100);
});

// Commentaire SSE pour garder les connexions vivantes
setInterval(() => {
  for (const res of clients) res.write(': ping\n\n');
}, 30000).unref();

server.listen(PORT, () => {
  console.log(`Serveur de dev : http://localhost:${PORT}`);
});
