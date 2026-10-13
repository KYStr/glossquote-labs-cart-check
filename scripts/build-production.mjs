import { buildCandidate } from './release.mjs';
const result = await buildCandidate({ production: true });
console.log(JSON.stringify({ status: 'PASS', output: 'dist-production', assetCount: result.files.length, bytes: result.files.reduce((sum, file) => sum + file.bytes, 0), digest: result.digest }));
