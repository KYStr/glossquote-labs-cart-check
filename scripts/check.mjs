import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, ASSETS, safeRead, verifyAssets } from './files.mjs';
import { page } from './pages.mjs';
import { previewArtifacts } from './release.mjs';

assert.match(process.version, /^v24\./);
const pkg = JSON.parse(await safeRead(ROOT, 'package.json'));
for (const key of ['dependencies', 'devDependencies', 'optionalDependencies']) assert.equal(Object.keys(pkg[key] || {}).length, 0);
await verifyAssets(path.join(ROOT, 'public'));
await previewArtifacts(ROOT);
for (const [locale, file] of [['zh-Hant', 'index.html'], ['en', 'en/index.html']]) {
  const html = String(await safeRead(path.join(ROOT, 'public'), file));
  assert.equal(html, page(locale), `Static page differs from reviewed generator: ${file}`);
  assert.match(html, /content="noindex,nofollow"/);
  assert.ok(!/maxlength\s*=|\son\w+\s*=|<script(?! type="module" src=)/i.test(html));
}
const runtime = (await Promise.all(ASSETS.filter(file => /\.(mjs|css|html)$/.test(file)).map(file => safeRead(path.join(ROOT, 'public'), file)))).join('\n');
assert.ok(!/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|localStorage|sessionStorage|indexedDB|sendBeacon|serviceWorker)\b|document\.cookie|innerHTML|outerHTML|insertAdjacentHTML|eval\(/.test(runtime));
const crawl = async directory => {
  const files = [];
  for (const entry of await readdir(path.join(ROOT, directory), { withFileTypes: true })) {
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await crawl(file));
    else if (file.endsWith('.mjs')) files.push(file);
  }
  return files;
};
const modules = [...ASSETS.filter(file => file.endsWith('.mjs')).map(file => `public/${file}`), ...await crawl('scripts'), ...await crawl('test')];
for (const file of modules) {
  const result = spawnSync(process.execPath, ['--check', path.join(ROOT, file)], { encoding: 'utf8' });
  assert.equal(result.status, 0, `Syntax failed: ${file}`);
}
console.log(JSON.stringify({ status: 'PASS', staticPages: 2, runtimeAssets: ASSETS.length, modules: modules.length, dependencies: 0, checks: ['Node 24', 'preview noindex', 'static HTML consistency', 'no input truncation', 'no active HTML', 'no network/storage/HTML sinks', 'exact asset allowlist', 'module syntax'] }));
