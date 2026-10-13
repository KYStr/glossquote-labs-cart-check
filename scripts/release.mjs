import assert from 'node:assert/strict';
import { mkdir, lstat, realpath, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ASSETS, ROOT, safeRead, sha256, manifest } from './files.mjs';
import { messages } from '../public/js/messages.mjs';

export const ORIGIN = 'https://cart.glossquote.com';
export const PRODUCTION_ASSETS = Object.freeze([...ASSETS, '404.html', '_headers', 'sitemap.xml'].sort());
export const FROZEN_M1 = Object.freeze({
  'en/index.html': '881dcc88182d88f713653b36cff09447d3a08eba6edd1f224720b05e3850ebca',
  'index.html': '39baf115e9a8657d90adade2ab8c501861e4043eba8dd3fc1a59d586f033a3d7',
  'js/app.mjs': 'fe7b4b72ecc7097d857b02268497bbed32bdbf92efe2f677558e80003927cdfb',
  'js/core/cart.mjs': '25c0611c9e6e4762f5a3a736cad027d446b58f729d5b9c5204b0ef949a410edd',
  'js/core/format.mjs': '901b25e210ae5db77dc29509478594caf9111ee6777c405994dfc0b6e5c71d22',
  'js/messages.mjs': '3d8612625271dde37fea979eb74cdf08b631736bd997fc7212ff69ab8ab6319e',
  'js/report.mjs': 'e7af519a6967a99b885cdbc0138e7bc3736ca19fc4b263d89671b490d6230f3e',
  'js/state.mjs': 'bc9e31b48ea321034a1011ec5b1d8f97d57a691f0e6dfb9e6274303d6dc15222',
  'robots.txt': '331ea9090db0c9f6f597bd9840fd5b171830f6e0b3ba1cb24dfa91f0c95aedc1',
  'styles/app.css': 'c996024bcccf99d09b125633a495756ed1b0f4645217df96ec665324f9f4300a'
});
export const WORKER_CONFIG = Object.freeze({
  name: 'glossquote-labs-cart-check', compatibility_date: '2026-10-13',
  workers_dev: false, preview_urls: false, send_metrics: false,
  assets: { directory: './dist-production', html_handling: 'none', not_found_handling: '404-page' },
  observability: { enabled: false, logs: { enabled: false, invocation_logs: false }, traces: { enabled: false } }
});
const normalized = value => path.resolve(value).toLowerCase();
export async function safeDirectory(directory) {
  const absolute = path.resolve(directory), info = await lstat(absolute);
  assert.ok(info.isDirectory() && !info.isSymbolicLink(), 'Non-directory or linked directory');
  assert.equal(normalized(await realpath(absolute)), normalized(absolute), 'Linked ancestor');
}
export async function validateStructure(directory, allowlist, complete = true) {
  await safeDirectory(directory);
  const directories = new Set(['']);
  for (const file of allowlist) {
    const parts = file.split('/');
    for (let i = 1; i < parts.length; i++) directories.add(parts.slice(0, i).join('/'));
  }
  const found = [];
  async function walk(relative) {
    await safeDirectory(path.join(directory, relative));
    for (const entry of await readdir(path.join(directory, relative), { withFileTypes: true })) {
      const file = relative ? `${relative}/${entry.name}` : entry.name;
      assert.ok(!entry.isSymbolicLink(), 'Linked entry');
      if (entry.isDirectory()) { assert.ok(directories.has(file), 'Unknown stale directory'); await walk(file); }
      else { assert.ok(allowlist.includes(file), 'Unknown stale asset'); await safeRead(directory, file); found.push(file); }
    }
  }
  await walk('');
  if (complete) assert.deepEqual(found.sort(), [...allowlist].sort(), 'Missing asset');
  return found.sort();
}
export async function previewArtifacts(root = ROOT) {
  const directory = path.join(root, 'public');
  await validateStructure(directory, ASSETS);
  const artifacts = new Map();
  for (const file of ASSETS) {
    const bytes = await safeRead(directory, file);
    assert.equal(sha256(bytes), FROZEN_M1[file], `Frozen M1 runtime drift: ${file}`);
    artifacts.set(file, bytes);
  }
  return artifacts;
}
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
export function metadata(locale) {
  const t = messages[locale], en = locale === 'en';
  const canonical = `${ORIGIN}/${en ? 'en/' : ''}index.html`;
  return { '@context': 'https://schema.org', '@type': 'WebApplication', name: t.h1, description: t.description, url: canonical, inLanguage: locale, applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any modern browser', browserRequirements: 'Requires JavaScript and BigInt support' };
}
export const jsonLdText = locale => JSON.stringify(metadata(locale));
export const jsonLdHashes = () => ['zh-Hant', 'en'].map(locale => `'sha256-${createHash('sha256').update(jsonLdText(locale)).digest('base64')}'`);
export function productionHeaders() {
  return {
    'Content-Security-Policy': `default-src 'none'; script-src 'self' ${jsonLdHashes().join(' ')}; style-src 'self'; img-src 'self' data:; connect-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cache-Control': 'no-store', 'Strict-Transport-Security': 'max-age=31536000'
  };
}
export function headersText() {
  let text = `/*\n${Object.entries(productionHeaders()).map(([key, value]) => `  ${key}: ${value}`).join('\n')}\n`;
  for (const [route, type] of [['/js/*', 'text/javascript'], ['/styles/*', 'text/css'], ['/robots.txt', 'text/plain'], ['/sitemap.xml', 'application/xml']]) text += `\n${route}\n  Content-Type: ${type}; charset=utf-8\n`;
  return `${text}\n/404.html\n  X-Robots-Tag: noindex, nofollow\n`;
}
export function productionPage(source, locale) {
  const t = messages[locale], en = locale === 'en', canonical = metadata(locale).url;
  const extras = [
    `<link rel="canonical" href="${canonical}">`,
    ...[['zh-Hant', `${ORIGIN}/index.html`], ['en', `${ORIGIN}/en/index.html`], ['x-default', `${ORIGIN}/index.html`]].map(([language, href]) => `<link rel="alternate" hreflang="${language}" href="${href}">`),
    `<meta property="og:title" content="${escape(t.title)}">`, `<meta property="og:description" content="${escape(t.description)}">`,
    `<meta property="og:type" content="website">`, `<meta property="og:url" content="${canonical}">`,
    `<meta property="og:site_name" content="Gloss Tools by GlossQuote">`,
    `<meta property="og:locale" content="${en ? 'en_US' : 'zh_TW'}">`, `<meta property="og:locale:alternate" content="${en ? 'zh_TW' : 'en_US'}">`,
    `<script type="application/ld+json">${jsonLdText(locale)}</script>`
  ].map(line => `  ${line}`).join('\n');
  assert.ok(source.includes('<meta name="robots" content="noindex,nofollow">'));
  return source.replace('content="noindex,nofollow"', 'content="index,follow"').replace('</head>', `${extras}\n</head>`);
}
export function notFoundPage() {
  return `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>找不到頁面 / Page not found | GlossQuote</title><link rel="icon" href="data:,"><link rel="stylesheet" href="/styles/app.css"></head>
<body><header class="topbar"><span class="brand">Gloss Tools by GlossQuote</span></header><main><h1>找不到頁面 / <span lang="en">Page not found</span></h1><section lang="zh-Hant"><p>這個網址沒有頁面。請回到折扣與免運試算。</p><p><a href="/index.html">返回繁中試算器</a></p></section><section lang="en"><p>There is no page at this address. Return to the calculator.</p><p><a href="/en/index.html">Back to the English calculator</a></p></section></main></body></html>
`;
}
export function sitemapText() {
  const alternate = [['zh-Hant', `${ORIGIN}/index.html`], ['en', `${ORIGIN}/en/index.html`], ['x-default', `${ORIGIN}/index.html`]].map(([locale, url]) => `<xhtml:link rel="alternate" hreflang="${locale}" href="${url}"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${[`${ORIGIN}/index.html`, `${ORIGIN}/en/index.html`].map(url => `<url><loc>${url}</loc>${alternate}</url>`).join('')}</urlset>\n`;
}
export async function productionArtifacts(root = ROOT) {
  const artifacts = await previewArtifacts(root);
  for (const [locale, file] of [['zh-Hant', 'index.html'], ['en', 'en/index.html']]) artifacts.set(file, Buffer.from(productionPage(artifacts.get(file).toString('utf8'), locale)));
  artifacts.set('robots.txt', Buffer.from(`User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`));
  artifacts.set('sitemap.xml', Buffer.from(sitemapText()));
  artifacts.set('404.html', Buffer.from(notFoundPage()));
  artifacts.set('_headers', Buffer.from(headersText()));
  return artifacts;
}
export async function validateWorkerConfig(root = ROOT) {
  const config = JSON.parse(String(await safeRead(root, 'wrangler.jsonc')));
  assert.deepEqual(config, WORKER_CONFIG, 'Exact static-only Worker configuration required');
}
export async function buildCandidate({ root = ROOT, production = false } = {}) {
  const artifacts = production ? await productionArtifacts(root) : await previewArtifacts(root);
  if (production) await validateWorkerConfig(root);
  const output = path.join(root, production ? 'dist-production' : 'dist');
  await mkdir(output, { recursive: true });
  await validateStructure(output, [...artifacts.keys()], false);
  for (const [file, bytes] of artifacts) {
    await mkdir(path.dirname(path.join(output, file)), { recursive: true });
    await writeFile(path.join(output, file), bytes);
  }
  await validateCandidate({ root, production });
  return manifest(output, [...artifacts.keys()]);
}
export async function validateCandidate({ root = ROOT, production = false } = {}) {
  const expected = production ? await productionArtifacts(root) : await previewArtifacts(root);
  if (production) await validateWorkerConfig(root);
  const directory = path.join(root, production ? 'dist-production' : 'dist');
  await validateStructure(directory, [...expected.keys()]);
  for (const [file, bytes] of expected) assert.deepEqual(await safeRead(directory, file), bytes, `Candidate byte drift: ${file}`);
  return manifest(directory, [...expected.keys()]);
}
