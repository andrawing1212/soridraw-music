import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(here, '035-explore-like-deferred-aggregate.mjs');
const tempPath = join(here, '.035-explore-like-deferred-aggregate-runtime-fixed.mjs');
let patch = readFileSync(sourcePath, 'utf8');

const oldBlock = String.raw`const exportMatches = [...source.matchAll(/export\s+default\s*\{/g)];
if (!exportMatches.length) throw new Error('[035] Worker module default export missing');
const exportMatch = exportMatches.at(-1);
const insertAt = Number(exportMatch.index) + exportMatch[0].length;
source = source.slice(0, insertAt) + \\`
  async scheduled(controller, env, ctx) {
    await processExploreLikeBatches035(env, Number(controller?.scheduledTime || Date.now()));
  },\\` + source.slice(insertAt);`;

const newBlock = String.raw`const directMatches = [...source.matchAll(/export\s+default\s*\{/g)];
let insertAt = -1;
if (directMatches.length) {
  const direct = directMatches.at(-1);
  insertAt = Number(direct.index) + direct[0].length;
} else {
  const aliasExport = source.match(/export\s*\{[\s\S]*?([A-Za-z_$][\w$]*)\s+as\s+default\b[\s\S]*?\}/);
  const namedExport = source.match(/export\s+default\s+([A-Za-z_$][\w$]*)\s*;?/);
  const objectName = aliasExport?.[1] || namedExport?.[1] || '';
  if (objectName) {
    const escaped = objectName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const objectMatches = [...source.matchAll(new RegExp('(?:var|let|const)\\s+' + escaped + '\\s*=\\s*\\{', 'g'))];
    if (objectMatches.length) {
      const objectMatch = objectMatches.at(-1);
      insertAt = Number(objectMatch.index) + objectMatch[0].length;
    }
  }
}
if (insertAt < 0) throw new Error('[035] Worker module default export object missing');
source = source.slice(0, insertAt) + \\`
  async scheduled(controller, env, ctx) {
    await processExploreLikeBatches035(env, Number(controller?.scheduledTime || Date.now()));
  },\\` + source.slice(insertAt);`;

if (!patch.includes(oldBlock)) throw new Error('[035-runtime] expected export injection block missing');
patch = patch.replace(oldBlock, newBlock);
writeFileSync(tempPath, patch, 'utf8');
try {
  const result = spawnSync(process.execPath, [tempPath], { stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
} finally {
  try { unlinkSync(tempPath); } catch {}
}
