import { validateCandidate, ORIGIN } from './release.mjs';
const result = await validateCandidate({ production: true });
console.log(JSON.stringify({ status: 'PASS', origin: ORIGIN, assetCount: result.files.length, digest: result.digest }));
