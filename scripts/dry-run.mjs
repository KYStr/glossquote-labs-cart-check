import assert from 'node:assert/strict';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROOT, safeRead } from './files.mjs';
import { validateCandidate, PRODUCTION_ASSETS, safeDirectory } from './release.mjs';

export function isolatedEnvironment(stateDirectory) {
  const environment = {};
  for (const name of ['SystemRoot', 'WINDIR', 'ComSpec', 'PATH', 'Path', 'PATHEXT', 'NUMBER_OF_PROCESSORS', 'PROCESSOR_ARCHITECTURE']) if (process.env[name] !== undefined) environment[name] = process.env[name];
  Object.assign(environment, {
    USERPROFILE: path.join(stateDirectory, 'home'), HOME: path.join(stateDirectory, 'home'),
    APPDATA: path.join(stateDirectory, 'home', 'roaming'), LOCALAPPDATA: path.join(stateDirectory, 'home', 'local'),
    XDG_CONFIG_HOME: path.join(stateDirectory, 'config'), XDG_CACHE_HOME: path.join(stateDirectory, 'cache'),
    TEMP: path.join(stateDirectory, 'temp'), TMP: path.join(stateDirectory, 'temp'),
    CI: 'true', BROWSER: 'none', WRANGLER_SEND_METRICS: 'false',
    WRANGLER_LOG_PATH: path.join(stateDirectory, 'wrangler.log'), NO_COLOR: '1'
  });
  return environment;
}
export async function runWrangler({ root = ROOT, entry, stateDirectory, help = false }) {
  assert.ok(path.isAbsolute(entry) && path.isAbsolute(stateDirectory), 'Absolute CLI/state paths required');
  const scope = path.resolve(ROOT, '../../.runs/github-publish/glossquote-labs-cart-check');
  assert.ok(path.resolve(stateDirectory).toLowerCase().startsWith(`${scope}${path.sep}`.toLowerCase()), 'State must remain in this tool publishing evidence');
  await safeDirectory(root); await safeDirectory(path.dirname(stateDirectory));
  await safeRead(path.dirname(entry), path.basename(entry));
  const pkg = JSON.parse(String(await safeRead(path.resolve(path.dirname(entry), '..'), 'package.json')));
  assert.equal(pkg.name, 'wrangler'); assert.equal(pkg.version, '4.147.0', 'Only reviewed existing version');
  assert.ok(!(await readdir(root)).some(name => /^\.env(?:\.|$)|^\.dev\.vars(?:\.|$)/.test(name)), 'Local secret-file names are forbidden');
  if (!help) await validateCandidate({ root, production: true });
  await mkdir(stateDirectory); // Never reuse a home/config/cache directory.
  for (const directory of ['home', 'home/roaming', 'home/local', 'config', 'cache', 'temp', 'bundle', 'project']) await mkdir(path.join(stateDirectory, directory), { recursive: true });
  if (!help) {
    await writeFile(path.join(stateDirectory, 'project', 'wrangler.jsonc'), await safeRead(root, 'wrangler.jsonc'), { flag: 'wx' });
    for (const file of PRODUCTION_ASSETS) {
      await mkdir(path.dirname(path.join(stateDirectory, 'project', 'dist-production', file)), { recursive: true });
      await writeFile(path.join(stateDirectory, 'project', 'dist-production', file), await safeRead(path.join(root, 'dist-production'), file), { flag: 'wx' });
    }
  }
  const args = help ? [entry, 'deploy', '--help'] : [entry, 'deploy', '--dry-run', '--autoconfig=false', '--config', path.join(stateDirectory, 'project', 'wrangler.jsonc'), '--outdir', path.join(stateDirectory, 'bundle')];
  const output = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: path.join(stateDirectory, 'project'), env: isolatedEnvironment(stateDirectory), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Owned Wrangler dry-run deadline')); }, 60000);
    const append = (key, chunk) => {
      if (stdout.length + stderr.length + chunk.length > 2 * 1024 * 1024) { child.kill(); reject(new Error('CLI output cap')); return; }
      if (key === 'stdout') stdout += chunk.toString(); else stderr += chunk.toString();
    };
    child.stdout.on('data', chunk => append('stdout', chunk)); child.stderr.on('data', chunk => append('stderr', chunk));
    child.on('error', () => { clearTimeout(timer); reject(new Error('Wrangler process failed')); });
    child.on('close', exitCode => { clearTimeout(timer); resolve({ exitCode, stdout, stderr }); });
  });
  return { literalArgs: args, wranglerVersion: pkg.version, nodeVersion: process.version, stateDirectory, ...output };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const values = process.argv.slice(2), options = {};
  for (let i = 0; i < values.length; i++) {
    if (values[i] === '--help-only') { options.help = true; continue; }
    assert.ok(['--wrangler', '--state-dir'].includes(values[i]), 'Unknown argument');
    const key = values[i] === '--wrangler' ? 'entry' : 'stateDirectory'; options[key] = values[++i];
  }
  const output = await runWrangler(options);
  process.stdout.write(output.stdout); process.stderr.write(output.stderr);
  console.log(JSON.stringify({ status: output.exitCode === 0 ? 'PASS' : 'FAIL', wrangler: output.wranglerVersion, node: output.nodeVersion, exitCode: output.exitCode, command: [process.execPath, ...output.literalArgs], stateDirectory: output.stateDirectory }));
  process.exitCode = output.exitCode === 0 ? 0 : 1;
}
