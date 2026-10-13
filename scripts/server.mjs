import http from 'node:http';
import { ASSETS, safeRead, verifyAssets } from './files.mjs';

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
export const SECURITY_HEADERS = Object.freeze({
  'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow'
});

export async function startPreview({ root, port = 4201 }) {
  await verifyAssets(root);
  const server = http.createServer(async (request, response) => {
    const headers = { ...SECURITY_HEADERS };
    const end = (status, body) => { response.writeHead(status, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' }); response.end(request.method === 'HEAD' ? undefined : body); };
    if (!['GET', 'HEAD'].includes(request.method)) { headers.Allow = 'GET, HEAD'; end(405, 'Method not allowed'); return; }
    const host = request.headers.host;
    if (host !== `127.0.0.1:${server.address().port}`) { end(403, 'Forbidden'); return; }
    const rawPath = request.url.split('?')[0];
    const file = rawPath === '/' ? 'index.html' : rawPath === '/en/' ? 'en/index.html' : rawPath.slice(1);
    if (!rawPath.startsWith('/') || !ASSETS.includes(file)) { end(404, 'Not found'); return; }
    try {
      const bytes = await safeRead(root, file);
      const extension = file.slice(file.lastIndexOf('.'));
      response.writeHead(200, { ...headers, 'Content-Type': MIME[extension], 'Content-Length': bytes.length });
      response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch { end(404, 'Not found'); }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  server.maxRequestsPerSocket = 100;
  const listen = requested => new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port: requested }, () => { server.removeListener('error', reject); resolve(); });
  });
  let fallback = false;
  try { await listen(port); }
  catch (error) {
    if (error.code !== 'EADDRINUSE' || port === 0) throw error;
    fallback = true; await listen(0);
  }
  return { server, fallback, port: server.address().port, url: `http://127.0.0.1:${server.address().port}` };
}
