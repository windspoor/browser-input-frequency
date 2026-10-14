const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const FILES = new Set(['index.html', 'style.css', 'src/measurement.js', 'src/demo.js']);
function createServer() {
  return http.createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch (_) { res.writeHead(400).end('Bad request'); return; }
    const file = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (!FILES.has(file)) { res.writeHead(404).end('Not found'); return; }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow:'GET, HEAD' }).end(); return; }
    const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8' };
    res.writeHead(200, { 'Content-Type':types[path.extname(file)], 'Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff',
      'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(path.join(ROOT, file)).pipe(res);
  });
}
if (require.main === module) {
  const port = Number(process.env.PORT || 4173);
  const server = createServer();
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Input lab: http://127.0.0.1:${port}`));
}
module.exports = { createServer };
