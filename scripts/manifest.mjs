import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, ASSETS, filesIn, manifest } from './files.mjs';
import { PRODUCTION_ASSETS, validateCandidate } from './release.mjs';

const excluded = ['dist/', 'dist-production/', 'node_modules/', '.git/'];
const sourceFiles = (await filesIn(ROOT)).filter(file => !excluded.some(prefix => file.startsWith(prefix)));
const codeFiles = sourceFiles.filter(file => file.startsWith('public/') || file.startsWith('scripts/') || file.startsWith('test/') || file === 'package.json');
const output = {
  schemaVersion: 1, algorithm: 'sha256', digestEncoding: 'sorted path NUL bytes NUL sha256 LF; UTF-8',
  node: process.version,
  source: await manifest(ROOT, sourceFiles),
  code: await manifest(ROOT, codeFiles),
  runtime: await manifest(path.join(ROOT, 'public'), ASSETS),
  dist: await manifest(path.join(ROOT, 'dist'), ASSETS),
  production: await validateCandidate({ root: ROOT, production: true })
};
if (process.argv[2]) {
  const target = path.resolve(process.argv[2]);
  const evidenceRoot = path.resolve(ROOT, '../../.runs/github-publish/glossquote-labs-cart-check');
  if (!target.toLowerCase().startsWith(`${evidenceRoot}${path.sep}`.toLowerCase())) throw new Error('Manifest evidence must stay in cart-check publishing directory');
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(output, null, 2)}\n`);
}
console.log(JSON.stringify({ sourceDigest: output.source.digest, codeDigest: output.code.digest, runtimeDigest: output.runtime.digest, distDigest: output.dist.digest, productionDigest: output.production.digest, productionFiles: PRODUCTION_ASSETS.length, sourceFiles: sourceFiles.length }));
