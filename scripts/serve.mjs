import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT || 5173);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    // Serve only preview assets, never repository internals or arbitrary local files.
    if (!(relative === 'index.html' || /^(src|locales)\/[a-zA-Z0-9_./-]+$/.test(relative))) {
      res.writeHead(404).end('Not found'); return;
    }
    const filename = path.resolve(root, relative);
    if (!filename.startsWith(root) || relative.split('/').some(part => part.startsWith('.'))) {
      res.writeHead(403).end('Forbidden'); return;
    }
    const body = await readFile(filename);
    res.writeHead(200, { 'Content-Type': `${types[path.extname(filename)] || 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
});
server.on('error', (error) => { console.error(`Could not start local server: ${error.message}`); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Lane Split Rush: http://localhost:${port}\nPress Ctrl+C to stop.`));
