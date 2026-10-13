import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { ROOT, ASSETS, safeRead, manifest } from './files.mjs';
import { previewArtifacts, safeDirectory } from './release.mjs';

export const SOURCE_FILES = Object.freeze([
  'package.json', '.gitignore', 'wrangler.jsonc',
  ...ASSETS.map(file => `public/${file}`),
  'scripts/build.mjs', 'scripts/check.mjs', 'scripts/dev.mjs', 'scripts/files.mjs', 'scripts/manifest.mjs', 'scripts/pages.mjs', 'scripts/server.mjs',
  'scripts/release.mjs', 'scripts/build-production.mjs', 'scripts/check-production.mjs', 'scripts/server-production.mjs', 'scripts/dry-run.mjs', 'scripts/source-files.mjs', 'scripts/source-archive.mjs', 'scripts/release.test.mjs',
  'test/core.test.mjs', 'test/state.test.mjs', 'test/server.test.mjs', 'test/fixtures.mjs',
  'PRODUCT.md', 'TECHNICAL.md', 'ACCEPTANCE.md', 'UX-SEO.md',
  'docs/BRAND.md', 'docs/DESIGN-SYSTEM.md', 'docs/ENGINEERING.md', 'docs/PRIVACY-SECURITY.md', 'docs/RELEASE.md'
].sort());
export const PUBLIC_SOURCE_FILES = Object.freeze([...SOURCE_FILES, 'README.md'].sort());
export function publicReadme() {
  return `# 折扣與免運試算 / Discount and free-shipping calculator

Compare a manually entered cart with one additional item or bundle. The out-of-pocket difference includes the add-on price, all supported discounts and shipping.

Pure static HTML/CSS/ESM, zero runtime or development dependencies. Inputs and results stay in browser memory: no upload, storage, telemetry, remote fonts or merchant integrations. Use one currency and one store’s assumptions; taxes and exchange rates are excluded.

## Run and verify

Node.js 24.x and npm are required. No npm install is needed.

\`\`\`sh
npm test
npm run check
npm run build
npm run dev
\`\`\`

Preview binds only 127.0.0.1:4201 and remains noindex. If the port is occupied it uses an OS-assigned loopback port and prints the actual URL. Existing processes are preserved.

\`\`\`sh
npm run build:production
npm run check:production
npm run dev:production
\`\`\`

The separate dist-production candidate fixes bilingual canonical/hreflang/JSON-LD/robots/sitemap to https://cart.glossquote.com. It has hash-based CSP and a real custom 404, without SPA fallback. Local candidate checks and public source publication do not establish a live Cloudflare release; hosting, homepage inclusion and external review are separate milestones.

The original verified runtime is fixed by SHA-256 checks. Percentage discount cents round half-up first, followed by the fixed coupon and then shipping eligibility. Example: a 900.00 basket, 1000.00 threshold and 80.00 shipping costs 980.00; adding 100.00 reaches free shipping but costs 1000.00, so the difference is 20.00 more. Adding 50.00 still costs shipping and totals 1030.00, 50.00 more. A 10% discount on 0.05 rounds the discount to 0.01 and leaves 0.04.

See [PRODUCT](PRODUCT.md), [TECHNICAL](TECHNICAL.md), [ACCEPTANCE](ACCEPTANCE.md), [privacy](docs/PRIVACY-SECURITY.md) and [release](docs/RELEASE.md). Offline tests use fictional data only. Physical-device/IME, actual 200% zoom, full Network/Storage, screen-reader/cross-browser and genuine clipboard-denial checks remain documented manual NOT_RUN; handler stubs are not native browser evidence.
`;
}
export async function prepareSource({ root = ROOT, destination }) {
  assert.ok(path.isAbsolute(destination), 'Absolute reviewed-copy destination required');
  const scope = path.resolve(ROOT, '../../.runs/github-publish/glossquote-labs-cart-check');
  assert.ok(path.resolve(destination).toLowerCase().startsWith(`${scope}${path.sep}`.toLowerCase()), 'Reviewed copy must stay in publishing evidence');
  await safeDirectory(root); await safeDirectory(path.dirname(destination)); await previewArtifacts(root);
  const artifacts = new Map();
  for (const file of SOURCE_FILES) artifacts.set(file, await safeRead(root, file));
  artifacts.set('README.md', Buffer.from(publicReadme()));
  await mkdir(destination); // Refuse an existing checkout; no destructive reset.
  for (const [file, bytes] of artifacts) {
    await mkdir(path.dirname(path.join(destination, file)), { recursive: true });
    await writeFile(path.join(destination, file), bytes, { flag: 'wx' });
  }
  return manifest(destination, PUBLIC_SOURCE_FILES);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await prepareSource({ destination: process.argv[2] });
  console.log(JSON.stringify({ status: 'PASS', files: result.files.length, digest: result.digest }));
}
