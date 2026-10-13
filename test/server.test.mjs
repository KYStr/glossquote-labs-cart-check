import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, link, symlink, rm } from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { ROOT, ASSETS, safeRead } from '../scripts/files.mjs';
import { startPreview } from '../scripts/server.mjs';

const close = server => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
const rawGet = (port, route, headers = {}) => new Promise((resolve, reject) => {
  http.get({ host: '127.0.0.1', port, path: route, headers }, response => {
    let body = ''; response.setEncoding('utf8'); response.on('data', chunk => { body += chunk; }); response.on('end', () => resolve({ status: response.statusCode, body }));
  }).on('error', reject);
});
test('Preview binds loopback, serves allowlist with MIME/headers and true 404/405', async () => {
  const preview = await startPreview({ root: path.join(ROOT, 'public'), port: 0 });
  try {
    assert.equal(preview.server.address().address, '127.0.0.1');
    const chinese = await fetch(`${preview.url}/index.html`);
    assert.equal(chinese.status, 200); assert.match(chinese.headers.get('content-type'), /^text\/html;/);
    assert.equal(chinese.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.match(chinese.headers.get('content-security-policy'), /connect-src 'none'/);
    assert.match(await chinese.text(), /lang="zh-Hant"/);
    for (const [url, mime] of [['/en/index.html', 'text/html'], ['/js/app.mjs', 'text/javascript'], ['/styles/app.css', 'text/css'], ['/robots.txt', 'text/plain']]) {
      const response = await fetch(`${preview.url}${url}`); assert.equal(response.status, 200); assert.ok(response.headers.get('content-type').startsWith(mime)); await response.arrayBuffer();
    }
    const head = await fetch(`${preview.url}/index.html`, { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(await head.text(), '');
    for (const route of ['/missing', '/package.json', '/.git/config', '/js/../../TECHNICAL.md', '/%2e%2e/TECHNICAL.md', '/js%2fapp.mjs', '/js\\app.mjs']) {
      const response = await rawGet(preview.port, route); assert.equal(response.status, 404, route); assert.equal(response.body, 'Not found');
    }
    const post = await fetch(`${preview.url}/index.html`, { method: 'POST', body: 'Fictional test' }); assert.equal(post.status, 405); assert.equal(post.headers.get('allow'), 'GET, HEAD'); await post.text();
    const badHost = await rawGet(preview.port, '/index.html', { Host: 'untrusted.invalid' }); assert.equal(badHost.status, 403);
    const second = await startPreview({ root: path.join(ROOT, 'public'), port: preview.port });
    try { assert.equal(second.fallback, true); assert.notEqual(second.port, preview.port); assert.equal(second.server.address().address, '127.0.0.1'); } finally { await close(second.server); }
  } finally { await close(preview.server); }
});
test('Linked assets and unknown stale files fail closed; owned fixture directory only', async () => {
  const evidence = path.resolve(ROOT, '../../.runs/cart-check/m1-2026-10-13-t00');
  await mkdir(evidence, { recursive: true });
  const temporary = await mkdtemp(path.join(evidence, 'server-fixture-'));
  assert.ok(temporary.startsWith(`${evidence}${path.sep}`));
  try {
    for (const file of ASSETS) { await mkdir(path.dirname(path.join(temporary, file)), { recursive: true }); await writeFile(path.join(temporary, file), 'Fictional static fixture'); }
    await writeFile(path.join(temporary, 'stale.txt'), 'Fictional stale output');
    await assert.rejects(startPreview({ root: temporary, port: 0 }), /Unexpected/);
    await rm(path.join(temporary, 'stale.txt'));
    const linked = path.join(temporary, 'linked.html');
    await link(path.join(temporary, 'index.html'), linked);
    await assert.rejects(safeRead(temporary, 'index.html'), /Non-regular/);
    await rm(linked);
    const linkedDir = path.join(temporary, 'linked-dir');
    await symlink(path.join(temporary, 'js'), linkedDir, 'junction');
    await assert.rejects(safeRead(temporary, 'linked-dir/app.mjs'), /Linked/);
    await rm(linkedDir);
  } finally {
    const resolved = path.resolve(temporary);
    if (!resolved.startsWith(`${evidence}${path.sep}`)) throw new Error('Unsafe fixture cleanup');
    await rm(resolved, { recursive: true, force: true });
  }
});
