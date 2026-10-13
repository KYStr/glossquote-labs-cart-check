import { buildCandidate } from './release.mjs';
const result = await buildCandidate();
console.log(JSON.stringify({ status: 'PASS', output: 'dist', assetCount: result.files.length, bytes: result.files.reduce((sum, file) => sum + file.bytes, 0), digest: result.digest }));
