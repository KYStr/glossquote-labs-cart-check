import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, link, symlink } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ASSETS, ROOT, safeRead, manifest } from './files.mjs';
import { buildCandidate, validateCandidate, previewArtifacts, WORKER_CONFIG, PRODUCTION_ASSETS } from './release.mjs';
import { startProduction } from './server-production.mjs';
import { isolatedEnvironment } from './dry-run.mjs';
import { crc32, readArchive } from './source-archive.mjs';
import { SOURCE_FILES, PUBLIC_SOURCE_FILES, publicReadme } from './source-files.mjs';

async function fixture(run) {
  const evidence = path.resolve(ROOT, '../../.runs/github-publish/glossquote-labs-cart-check');
  await mkdir(evidence, { recursive: true });
  const directory = await mkdtemp(path.join(evidence, 'release-fixture-'));
  try {
    for (const file of ASSETS) { await mkdir(path.dirname(path.join(directory, 'public', file)), { recursive: true }); await writeFile(path.join(directory, 'public', file), await safeRead(path.join(ROOT, 'public'), file)); }
    await writeFile(path.join(directory, 'wrangler.jsonc'), JSON.stringify(WORKER_CONFIG));
    await run(directory);
  } finally {
    const absolute = path.resolve(directory);
    assert.ok(absolute.startsWith(`${evidence}${path.sep}`)); await rm(absolute, { recursive: true, force: true });
  }
}

test('M2 bilingual SEO has literal canonical, reciprocal alternatives and exact JSON-LD hashes', () => fixture(async root => {
  await buildCandidate({ root, production: true });
  const headers = String(await safeRead(path.join(root, 'dist-production'), '_headers'));
  const hashes = [...headers.matchAll(/'sha256-([^']+)'/g)].map(match => match[1]);
  assert.equal(hashes.length, 2); assert.ok(!headers.includes('unsafe-inline') && !headers.includes('unsafe-eval'));
  for (const [locale, file, canonical] of [['zh-Hant', 'index.html', 'https://cart.glossquote.com/index.html'], ['en', 'en/index.html', 'https://cart.glossquote.com/en/index.html']]) {
    const html = String(await safeRead(path.join(root, 'dist-production'), file));
    assert.ok(html.includes(`lang="${locale}"`)); assert.ok(html.includes(`<link rel="canonical" href="${canonical}">`));
    for (const [lang, href] of [['zh-Hant','https://cart.glossquote.com/index.html'], ['en','https://cart.glossquote.com/en/index.html'], ['x-default','https://cart.glossquote.com/index.html']]) assert.ok(html.includes(`hreflang="${lang}" href="${href}"`));
    assert.ok(html.includes('name="robots" content="index,follow"'));
    const json = /<script type="application\/ld\+json">([^<]+)<\/script>/.exec(html)[1];
    assert.ok(hashes.includes(createHash('sha256').update(json).digest('base64')));
    const data = JSON.parse(json); assert.equal(data.url, canonical); assert.equal(data.inLanguage, locale); assert.equal(data['@type'], 'WebApplication');
    assert.ok(!Object.hasOwn(data, 'offers') && !Object.hasOwn(data, 'aggregateRating'));
    const sourceBody = String(await safeRead(path.join(root, 'public'), file)).split('<body>')[1];
    assert.equal(html.split('<body>')[1], sourceBody, 'M1 body and workflow unchanged');
  }
  const robots = String(await safeRead(path.join(root, 'dist-production'), 'robots.txt'));
  assert.equal(robots, 'User-agent: *\nAllow: /\nSitemap: https://cart.glossquote.com/sitemap.xml\n');
  const sitemap = String(await safeRead(path.join(root, 'dist-production'), 'sitemap.xml'));
  assert.equal((sitemap.match(/<loc>/g) || []).length, 2); assert.ok(sitemap.includes('<loc>https://cart.glossquote.com/en/index.html</loc>'));
  assert.equal((sitemap.match(/hreflang="x-default"/g) || []).length, 2);
}));

test('M2 preview and production are separate; untouched runtime and repeated build deterministic', () => fixture(async root => {
  const preview = await buildCandidate({ root });
  const production = await buildCandidate({ root, production: true });
  assert.equal(preview.files.length, 10); assert.equal(production.files.length, 13);
  for (const file of ASSETS.filter(file => !file.endsWith('.html') && file !== 'robots.txt')) assert.deepEqual(await safeRead(path.join(root, 'dist'), file), await safeRead(path.join(root, 'dist-production'), file));
  assert.match(String(await safeRead(path.join(root, 'dist'), 'index.html')), /content="noindex,nofollow"/);
  assert.deepEqual(await buildCandidate({ root, production: true }), production);
  assert.deepEqual(await buildCandidate({ root }), preview);
}));

test('M2 candidate HTTP has MIME, HEAD, security headers and actual404 without SPA fallback', () => fixture(async root => {
  await buildCandidate({ root, production: true });
  const preview = await startProduction({ root, port: 0 });
  try {
    assert.equal(preview.server.address().address, '127.0.0.1');
    for (const [file, mime] of [['index.html','text/html'], ['en/index.html','text/html'], ['js/app.mjs','text/javascript'], ['styles/app.css','text/css'], ['sitemap.xml','application/xml'], ['robots.txt','text/plain']]) {
      const response = await fetch(`${preview.url}/${file}`); assert.equal(response.status,200); assert.ok(response.headers.get('content-type').startsWith(mime));
      assert.match(response.headers.get('content-security-policy'), /connect-src 'none'/); assert.equal(response.headers.get('x-content-type-options'),'nosniff'); await response.arrayBuffer();
    }
    for (const route of ['/missing', '/en/missing', '/_headers', '/package.json']) {
      const response = await fetch(`${preview.url}${route}`); assert.equal(response.status,404); assert.match(response.headers.get('content-type'), /^text\/html/);
      const body = await response.text(); assert.ok(body.includes('href="/index.html"') && body.includes('href="/en/index.html"')); assert.ok(!body.includes('id="cart-form"'));
    }
    const head = await fetch(`${preview.url}/missing`, {method:'HEAD'}); assert.equal(head.status,404); assert.equal(await head.text(),'');
    const post = await fetch(`${preview.url}/index.html`, {method:'POST'}); assert.equal(post.status,405); await post.text();
  } finally { await new Promise(resolve => preview.server.close(resolve)); }
}));

test('M2 altered production SEO/headers and unexpected destination files fail validation', () => fixture(async root => {
  await buildCandidate({ root, production: true });
  const file = path.join(root, 'dist-production', 'index.html'), original = await safeRead(path.join(root, 'dist-production'),'index.html');
  await writeFile(file, original.toString().replace('https://cart.glossquote.com/index.html','https://wrong.invalid/index.html'));
  await assert.rejects(validateCandidate({root,production:true}), /Candidate byte drift/);
  await writeFile(file, original); await writeFile(path.join(root,'dist-production','stale.txt'),'Fictional stale data');
  await assert.rejects(buildCandidate({root,production:true}), /Unknown stale asset/);
}));

test('M2 source drift including active meta refresh is rejected before destination writes', () => fixture(async root => {
  await buildCandidate({root,production:true});
  const before = await manifest(path.join(root,'dist-production'),PRODUCTION_ASSETS);
  const original = String(await safeRead(path.join(root,'public'),'index.html'));
  for(const fragment of ['<meta http-equiv="refresh" content="0;url=https://example.invalid">', "<META HTTP-EQUIV='REFRESH' CONTENT='0'>", '<meta http-equiv=refresh content=0>', '<meta http-equiv="&#114;efresh" content="0">']) {
    await writeFile(path.join(root,'public','index.html'), original.replace('</head>',`${fragment}</head>`));
    await assert.rejects(buildCandidate({root,production:true}), /Frozen M1 runtime drift/);
    assert.deepEqual(await manifest(path.join(root,'dist-production'),PRODUCTION_ASSETS),before);
  }
}));

test('M2 destination hardlink and ancestor junction cannot escape approved filesystem', () => fixture(async root => {
  await buildCandidate({root,production:true});
  const output=path.join(root,'dist-production'), outside=path.join(root,'sentinel.txt');
  await writeFile(outside,'Fictional protected sentinel'); await rm(path.join(output,'index.html')); await link(outside,path.join(output,'index.html'));
  await assert.rejects(buildCandidate({root,production:true}),/Non-regular asset/);
  assert.equal(String(await readFile(outside)),'Fictional protected sentinel');
  await rm(path.join(output,'index.html'));
  const alias=path.join(root,'alias'); await symlink(root,alias,'junction');
  await assert.rejects(previewArtifacts(alias),/Linked ancestor/);
  await rm(alias);
}));

test('M2 exact static Worker config forbids observability, resources and fallback expansion', () => fixture(async root => {
  for(const modified of [{...WORKER_CONFIG,send_metrics:true},{...WORKER_CONFIG,vars:{unsafe:'Fictional'}},{...WORKER_CONFIG,assets:{...WORKER_CONFIG.assets,not_found_handling:'single-page-application'}},{...WORKER_CONFIG,observability:{enabled:true}}]) {
    await writeFile(path.join(root,'wrangler.jsonc'),JSON.stringify(modified)); await assert.rejects(buildCandidate({root,production:true}),/Exact static-only/);
  }
}));

test('M2 exact custom domain is cart.glossquote.com; absent/wrong routes fail closed', () => fixture(async root => {
  const config=JSON.parse(String(await safeRead(root,'wrangler.jsonc')));
  assert.deepEqual(config.routes,[{pattern:'cart.glossquote.com',custom_domain:true}]);
  await buildCandidate({root,production:true});
  const before=await manifest(path.join(root,'dist-production'),PRODUCTION_ASSETS);
  const missing={...config};delete missing.routes;
  for(const invalid of [missing,{...config,routes:[{pattern:'wrong.glossquote.com',custom_domain:true}]},{...config,routes:[{pattern:'cart.glossquote.com',custom_domain:false}]},{...config,routes:[...config.routes,{pattern:'extra.glossquote.com',custom_domain:true}]}]) {
    await writeFile(path.join(root,'wrangler.jsonc'),JSON.stringify(invalid));
    await assert.rejects(buildCandidate({root,production:true}),/Exact static-only/);
    assert.deepEqual(await manifest(path.join(root,'dist-production'),PRODUCTION_ASSETS),before);
  }
}));

test('M2 isolated Wrangler child environment is an explicit credential-free allowlist', () => {
  const state = path.resolve('fictional-state'); const environment=isolatedEnvironment(state);
  for(const key of Object.keys(environment)) assert.ok(['SystemRoot','WINDIR','ComSpec','PATH','Path','PATHEXT','NUMBER_OF_PROCESSORS','PROCESSOR_ARCHITECTURE','USERPROFILE','HOME','APPDATA','LOCALAPPDATA','XDG_CONFIG_HOME','XDG_CACHE_HOME','TEMP','TMP','CI','BROWSER','WRANGLER_SEND_METRICS','WRANGLER_LOG_PATH','NO_COLOR'].includes(key));
  assert.equal(environment.WRANGLER_SEND_METRICS,'false'); assert.equal(environment.CI,'true');
  assert.equal(environment.USERPROFILE,path.join(state,'home')); assert.equal(environment.TEMP,path.join(state,'temp'));
});

function fakeZip(name, content=Buffer.from('Fictional source')) {
  const encoded=Buffer.from(name), local=Buffer.alloc(30), central=Buffer.alloc(46), end=Buffer.alloc(22), crc=crc32(content);
  local.writeUInt32LE(0x04034b50); local.writeUInt32LE(crc,14);local.writeUInt32LE(content.length,18);local.writeUInt32LE(content.length,22);local.writeUInt16LE(encoded.length,26);
  central.writeUInt32LE(0x02014b50); central.writeUInt32LE(crc,16);central.writeUInt32LE(content.length,20);central.writeUInt32LE(content.length,24);central.writeUInt16LE(encoded.length,28);
  const prefix=Buffer.concat([local,encoded,content]), directory=Buffer.concat([central,encoded]);
  end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(prefix.length,16);
  return Buffer.concat([prefix,directory,end]);
}
test('M2 ZIP parser rejects traversal/corruption and preserves literal file bytes',()=>{
  assert.equal(String(readArchive(fakeZip('example.txt')).get('example.txt')),'Fictional source');
  for(const name of ['../escape.txt','/escape.txt','C:/escape.txt','a\\escape.txt','./x']) assert.throws(()=>readArchive(fakeZip(name)));
  const corrupt=fakeZip('example.txt'); corrupt[30+'example.txt'.length] ^=1;assert.throws(()=>readArchive(corrupt),/ZIP CRC/);
  assert.equal(crc32(Buffer.from('123456789')),0xcbf43926);
});
test('M2 public-source allowlist excludes internal routing, credentials and generated outputs',()=>{
  for(const file of SOURCE_FILES) assert.ok(!/DISPATCH|HANDOFF|project\.json|START-HERE|TASKS|TASK-ENTRY|AGENTS|\.runs|node_modules|^dist|\.env|\.dev\.vars/.test(file));
  assert.equal(PUBLIC_SOURCE_FILES.length,new Set(PUBLIC_SOURCE_FILES).size);
  assert.match(publicReadme(),/npm run build:production/);assert.ok(!publicReadme().includes('01a133'));
});
