import path from 'node:path';
import { ROOT } from './files.mjs';
import { startPreview } from './server.mjs';

const preview = await startPreview({ root: path.join(ROOT, 'dist') });
console.log(JSON.stringify({ product: 'cart-check', pid: process.pid, host: '127.0.0.1', port: preview.port, fallback: preview.fallback, chinese: `${preview.url}/index.html`, english: `${preview.url}/en/index.html` }));
