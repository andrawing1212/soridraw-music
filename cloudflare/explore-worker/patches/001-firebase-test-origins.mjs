import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is missing.');

const workerPath = join(remoteDir, 'worker.js');
const before = readFileSync(workerPath, 'utf8');
const wanted = [
  'https://soridraw-test.web.app',
  'https://soridraw-test.firebaseapp.com',
];

if (wanted.every((origin) => before.includes(`"${origin}"`))) {
  console.log('[SORIDRAW Worker] Firebase test origins already present; no source change.');
  process.exit(0);
}

const anchor = '  "https://soridraw-music.vercel.app",\n';
if (!before.includes(anchor)) {
  throw new Error('Expected live Vercel CORS anchor is missing; refusing broad Worker edit.');
}

const additions = wanted
  .filter((origin) => !before.includes(`"${origin}"`))
  .map((origin) => `  "${origin}",\n`)
  .join('');

const expected = before.replace(anchor, anchor + additions);
if (expected === before) throw new Error('No expected CORS source change was produced.');
if (expected.length - before.length !== additions.length) {
  throw new Error('Unexpected Worker source length delta; refusing deploy.');
}

writeFileSync(workerPath, expected, 'utf8');
const after = readFileSync(workerPath, 'utf8');
if (after !== expected) throw new Error('Worker CORS patch result mismatch.');

console.log(`[SORIDRAW Worker] added only Firebase test origins: ${wanted.join(', ')}`);
