import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'public');
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

createServer((request, response) => {
  const pathname = request.url === '/' ? '/index.html' : new URL(request.url ?? '/', 'http://localhost').pathname;
  const file = normalize(join(root, pathname));
  if (!file.startsWith(root)) { response.writeHead(403).end('Forbidden'); return; }
  try {
    if (!statSync(file).isFile()) throw new Error('not-file');
    response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end('Not Found');
  }
}).listen(port, '0.0.0.0', () => console.log(`LoopTodo reward admin: http://0.0.0.0:${port}`));
