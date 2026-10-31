import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, '.local/toy/dist');
function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

run(process.execPath, ['scripts/validate.mjs']);
fs.rmSync(output, { recursive: true, force: true });
// This is intentionally local to the Toy. Never fall back to GitHub at runtime.
run(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', output], {
  ...process.env, VITE_CATALOG_URL: './data/catalog.json',
});
// Agent exports belong to Pages, not the Toy package. Avoid advertising files
// that this build intentionally does not generate.
const entry = path.join(output, 'index.html');
fs.writeFileSync(entry, fs.readFileSync(entry, 'utf8')
  .replace(/\s*<link\b[^>]*href="\.\/llms\.txt"[^>]*>/g, '')
  .replace(/<noscript>[\s\S]*?<\/noscript>/g, '<noscript><p>这个页面需要 JavaScript。This page requires JavaScript.</p></noscript>'));
const catalog = JSON.parse(fs.readFileSync(path.join(output, 'data/catalog.json'), 'utf8'));
if (catalog.mediaMode === 'feishu-links') fs.rmSync(path.join(output, 'media'), { recursive: true, force: true });
run('python3', ['scripts/package-toy.py', '--dist', output, '--output', '.local/toy/gloria-toy.zip', '--report', '.local/toy/package-report.json']);
