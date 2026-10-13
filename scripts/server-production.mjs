import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, safeRead } from './files.mjs';
import { PRODUCTION_ASSETS, productionHeaders, validateCandidate } from './release.mjs';

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8' };
export async function startProduction({ root = ROOT, port = 5201 } = {}) {
  await validateCandidate({ root, production: true });
  const directory = path.join(root, 'dist-production');
  const server = http.createServer(async (request, response) => {
    const headers = productionHeaders();
    const plain = (status, text, extra = {}) => { response.writeHead(status, { ...headers, ...extra, 'Content-Type': 'text/plain; charset=utf-8' }); response.end(request.method === 'HEAD' ? undefined : text); };
    if (!['GET', 'HEAD'].includes(request.method)) { plain(405, 'Method not allowed', { Allow: 'GET, HEAD' }); return; }
    if (request.headers.host !== `127.0.0.1:${server.address().port}`) { plain(403, 'Forbidden'); return; }
    const raw = request.url.split('?')[0];
    const file = raw === '/' ? 'index.html' : raw === '/en/' ? 'en/index.html' : raw.slice(1);
    const allowed = raw.startsWith('/') && PRODUCTION_ASSETS.includes(file) && file !== '_headers';
    try {
      const body = await safeRead(directory, allowed ? file : '404.html');
      const type = allowed ? MIME[path.extname(file)] : MIME['.html'];
      if (allowed && file === '404.html') headers['X-Robots-Tag'] = 'noindex, nofollow';
      response.writeHead(allowed ? 200 : 404, { ...headers, 'Content-Type': type, 'Content-Length': body.length });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch { plain(404, 'Not found'); }
  });
  server.requestTimeout = 10000; server.headersTimeout = 10000;
  const listen = value => new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port: value }, () => { server.removeListener('error', reject); resolve(); });
  });
  let fallback = false;
  try { await listen(port); } catch (error) { if (port === 0 || error.code !== 'EADDRINUSE') throw error; fallback = true; await listen(0); }
  return { server, fallback, port: server.address().port, url: `http://127.0.0.1:${server.address().port}` };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await startProduction();
  console.log(JSON.stringify({ kind: 'local-production-candidate', pid: process.pid, port: result.port, fallback: result.fallback, chinese: `${result.url}/index.html`, english: `${result.url}/en/index.html` }));
}
