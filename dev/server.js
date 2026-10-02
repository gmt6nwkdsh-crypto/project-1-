// Local test server: serves public/ and runs the files in api/ the way Vercel does.
// Run: DATABASE_URL=postgres://... ANTHROPIC_API_KEY=... node dev/server.js
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const m = /^\/api\/([a-z-]+)$/.exec(u.pathname);
  if (m) {
    const file = path.join(root, 'api', m[1] + '.js');
    if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('not found'); }
    const mod = await import(pathToFileURL(file).href);
    return mod.default(req, res);
  }
  let p = path.join(root, 'public', decodeURIComponent(u.pathname));
  if (!p.startsWith(path.join(root, 'public'))) { res.statusCode = 403; return res.end(); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) { res.statusCode = 404; return res.end('not found'); }
  res.setHeader('Content-Type', types[path.extname(p)] || 'application/octet-stream');
  fs.createReadStream(p).pipe(res);
}).listen(process.env.PORT || 3000, () => console.log('http://localhost:' + (process.env.PORT || 3000)));
