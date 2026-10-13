import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { ROOT, sha256, manifest } from './files.mjs';
import { safeDirectory } from './release.mjs';
import { PUBLIC_SOURCE_FILES } from './source-files.mjs';

export function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let i = 0; i < 8; i++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}
export function readArchive(bytes) {
  assert.ok(bytes.length <= 16 * 1024 * 1024, 'ZIP size cap');
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50 && i + 22 + bytes.readUInt16LE(i + 20) === bytes.length) { eocd = i; break; }
  }
  assert.ok(eocd >= 0, 'ZIP end record');
  assert.equal(bytes.readUInt16LE(eocd + 4), 0); assert.equal(bytes.readUInt16LE(eocd + 6), 0);
  const count = bytes.readUInt16LE(eocd + 10), size = bytes.readUInt32LE(eocd + 12), start = bytes.readUInt32LE(eocd + 16);
  assert.equal(bytes.readUInt16LE(eocd + 8), count); assert.ok(count <= 300 && start + size === eocd, 'ZIP central directory');
  const files = new Map(), names = new Set(); let pointer = start, total = 0;
  for (let i = 0; i < count; i++) {
    assert.equal(bytes.readUInt32LE(pointer), 0x02014b50, 'ZIP central signature');
    const flags = bytes.readUInt16LE(pointer + 8), compression = bytes.readUInt16LE(pointer + 10);
    const crc = bytes.readUInt32LE(pointer + 16), compressed = bytes.readUInt32LE(pointer + 20), length = bytes.readUInt32LE(pointer + 24);
    const nameLength = bytes.readUInt16LE(pointer + 28), extraLength = bytes.readUInt16LE(pointer + 30), commentLength = bytes.readUInt16LE(pointer + 32);
    const offset = bytes.readUInt32LE(pointer + 42), mode = bytes.readUInt32LE(pointer + 38) >>> 16;
    assert.ok(!(flags & 1) && [0, 8].includes(compression), 'Encrypted or unsupported ZIP');
    assert.ok(length <= 2 * 1024 * 1024 && compressed <= 2 * 1024 * 1024, 'ZIP entry cap');
    const nameBytes = bytes.subarray(pointer + 46, pointer + 46 + nameLength), name = nameBytes.toString('utf8');
    assert.deepEqual(Buffer.from(name), nameBytes, 'ZIP filename encoding');
    const segments = (name.endsWith('/') ? name.slice(0, -1) : name).split('/');
    assert.ok(/^[A-Za-z0-9_.\-/]+$/.test(name) && !name.startsWith('/') && !name.includes('\\') && !segments.some(part => part === '..' || part === '.' || !part), 'ZIP traversal or unsafe name');
    assert.ok(!names.has(name.toLowerCase()), 'Duplicate ZIP name'); names.add(name.toLowerCase());
    assert.ok([0, 0x8000, 0x4000].includes(mode & 0xf000), 'ZIP symlink or special file');
    assert.equal(bytes.readUInt32LE(offset), 0x04034b50, 'ZIP local signature');
    assert.equal(bytes.readUInt16LE(offset + 6), flags); assert.equal(bytes.readUInt16LE(offset + 8), compression);
    const localNameLength = bytes.readUInt16LE(offset + 26), localExtraLength = bytes.readUInt16LE(offset + 28);
    assert.equal(bytes.subarray(offset + 30, offset + 30 + localNameLength).toString('utf8'), name, 'ZIP filename mismatch');
    const dataStart = offset + 30 + localNameLength + localExtraLength;
    assert.ok(dataStart + compressed <= start, 'ZIP payload range');
    const payload = bytes.subarray(dataStart, dataStart + compressed);
    const content = compression === 0 ? Buffer.from(payload) : inflateRawSync(payload, { maxOutputLength: length || 1 });
    assert.equal(content.length, length, 'ZIP expanded length'); assert.equal(crc32(content), crc, 'ZIP CRC');
    total += length; assert.ok(total <= 8 * 1024 * 1024, 'ZIP expanded total cap');
    if (name.endsWith('/')) assert.equal(content.length, 0, 'Nonempty directory entry');
    else files.set(name, content);
    pointer += 46 + nameLength + extraLength + commentLength;
  }
  assert.equal(pointer, eocd, 'ZIP central record bounds');
  return files;
}

export async function gitRun(repo, args, { git = 'git', stateDirectory } = {}) {
  assert.ok(stateDirectory && path.isAbsolute(stateDirectory), 'Explicit task-owned Git state required');
  await safeDirectory(repo); await mkdir(stateDirectory, { recursive: true }); await safeDirectory(stateDirectory);
  const emptyConfig = path.join(stateDirectory, 'empty-global.gitconfig');
  try { await writeFile(emptyConfig, '', { flag: 'wx' }); } catch (error) { if (error.code !== 'EEXIST') throw error; assert.equal((await readFile(emptyConfig)).length, 0); }
  const environment = {};
  for (const key of ['SystemRoot', 'WINDIR', 'ComSpec', 'PATH', 'Path', 'PATHEXT']) if (process.env[key] !== undefined) environment[key] = process.env[key];
  environment.GIT_CONFIG_GLOBAL = emptyConfig;
  environment.GIT_CONFIG_NOSYSTEM = '1';
  environment.GIT_TERMINAL_PROMPT = '0';
  const result = spawnSync(git, ['-C', repo, '-c', 'core.autocrlf=false', ...args], { env: environment, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  assert.equal(result.status, 0, 'Local Git command failed');
  return result.stdout;
}
export async function archiveFromCommit({ repo, commit, zip, extraction, git = 'git', stateDirectory }) {
  assert.match(commit, /^[a-f0-9]{40}$/);
  const scope = path.resolve(ROOT, '../../.runs/github-publish/glossquote-labs-cart-check').toLowerCase();
  for (const target of [repo, zip, extraction, stateDirectory]) assert.ok(path.resolve(target).toLowerCase().startsWith(`${scope}${path.sep}`), 'Source archive scope');
  await safeDirectory(path.dirname(zip)); await safeDirectory(path.dirname(extraction));
  const options = { git, stateDirectory };
  const tree = String(await gitRun(repo, ['ls-tree', '-r', '-z', commit], options)).split('\0').filter(Boolean).map(record => {
    const match = /^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/.exec(record);
    assert.ok(match, 'Only regular Git blobs'); return { path: match[3], blob: match[2] };
  });
  assert.deepEqual(tree.map(entry => entry.path).sort(), [...PUBLIC_SOURCE_FILES].sort(), 'Git source allowlist');
  await gitRun(repo, ['archive', '--format=zip', '--output', zip, commit], options);
  const zipBytes = await readFile(zip), files = readArchive(zipBytes), blobs = [];
  assert.deepEqual([...files.keys()].sort(), [...PUBLIC_SOURCE_FILES].sort(), 'ZIP source allowlist');
  for (const entry of tree) {
    const bytes = await gitRun(repo, ['cat-file', 'blob', entry.blob], options);
    assert.deepEqual(files.get(entry.path), bytes, `Git blob-byte mismatch: ${entry.path}`);
    blobs.push({ path: entry.path, gitBlob: entry.blob, bytes: bytes.length, sha256: sha256(bytes) });
  }
  await mkdir(extraction); // Fresh extraction only, never overwrite user files.
  for (const [file, bytes] of files) {
    const target = path.resolve(extraction, file);
    assert.ok(target.startsWith(`${path.resolve(extraction)}${path.sep}`), 'Extraction scope');
    await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, bytes, { flag: 'wx' });
  }
  const extracted = await manifest(extraction, PUBLIC_SOURCE_FILES);
  for (const entry of blobs) assert.deepEqual(extracted.files.find(file => file.path === entry.path), { path: entry.path, bytes: entry.bytes, sha256: entry.sha256 });
  return { status: 'PASS', commit, zip, zipBytes: zipBytes.length, zipSha256: sha256(zipBytes), extraction, sourceManifest: extracted, gitBlobs: blobs };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [repo, commit, zip, extraction, stateDirectory] = process.argv.slice(2);
  const result = await archiveFromCommit({ repo, commit, zip, extraction, stateDirectory });
  console.log(JSON.stringify(result));
}
