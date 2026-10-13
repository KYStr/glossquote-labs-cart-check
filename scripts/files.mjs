import { lstat, realpath, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const ASSETS = Object.freeze([
  'index.html', 'en/index.html', 'robots.txt', 'styles/app.css',
  'js/app.mjs', 'js/messages.mjs', 'js/report.mjs', 'js/state.mjs',
  'js/core/cart.mjs', 'js/core/format.mjs'
]);
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const normalized = value => path.resolve(value).toLowerCase();

export async function safeRead(root, relative) {
  if (relative.includes('\\') || relative.startsWith('/') || relative.split('/').some(part => part === '..' || part === '.')) throw new Error('Unsafe asset path');
  const absoluteRoot = path.resolve(root);
  const rootStat = await lstat(absoluteRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || normalized(await realpath(absoluteRoot)) !== normalized(absoluteRoot)) throw new Error('Unsafe asset root');
  const segments = relative.split('/');
  let target = absoluteRoot;
  for (let i = 0; i < segments.length; i++) {
    target = path.join(target, segments[i]);
    const info = await lstat(target);
    if (info.isSymbolicLink() || normalized(await realpath(target)) !== normalized(target)) throw new Error('Linked asset rejected');
    if (i < segments.length - 1 && !info.isDirectory()) throw new Error('Invalid asset directory');
    if (i === segments.length - 1 && (!info.isFile() || info.nlink !== 1)) throw new Error('Non-regular asset rejected');
  }
  return readFile(target);
}

export async function filesIn(root, prefix = '') {
  const directory = path.join(root, prefix);
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink() || normalized(await realpath(directory)) !== normalized(directory)) throw new Error('Linked directory rejected');
  const list = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error('Linked file rejected');
    if (entry.isDirectory()) list.push(...await filesIn(root, relative));
    else if (entry.isFile()) list.push(relative);
    else throw new Error('Non-regular entry rejected');
  }
  return list.sort();
}

export async function verifyAssets(root, complete = true) {
  const files = await filesIn(root);
  if (files.some(file => !ASSETS.includes(file)) || (complete && files.length !== ASSETS.length)) throw new Error('Unexpected or missing output asset');
  for (const file of files) await safeRead(root, file);
  return files;
}

export async function manifest(root, files) {
  const entries = [];
  for (const file of [...files].sort()) {
    const bytes = await safeRead(root, file);
    entries.push({ path: file, bytes: bytes.length, sha256: sha256(bytes) });
  }
  return { files: entries, digest: sha256(Buffer.from(entries.map(entry => `${entry.path}\0${entry.bytes}\0${entry.sha256}\n`).join(''))) };
}
