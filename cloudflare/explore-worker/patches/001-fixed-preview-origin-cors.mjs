import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir || !existsSync(remoteDir)) {
  throw new Error('001-fixed-preview-origin-cors: SORIDRAW_REMOTE_WORKER_DIR is missing');
}

const wantedOrigins = [
  'https://preview.soridraw.com',
  'https://soridraw-preview.web.app',
  'https://soridraw-preview.firebaseapp.com',
];

const legacyOriginAnchors = [
  'https://soridraw-music-git-preview-andrawing1212.vercel.app',
  'https://soridraw-music.vercel.app',
  'https://soridraw.web.app',
];

const sourceFiles = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full);
      continue;
    }
    if (/\.(?:js|mjs|cjs)$/i.test(name)) sourceFiles.push(full);
  }
};
walk(remoteDir);

if (!sourceFiles.length) {
  throw new Error('001-fixed-preview-origin-cors: no Worker source modules found');
}

const alreadyPresent = sourceFiles.some((file) => {
  const text = readFileSync(file, 'utf8');
  return wantedOrigins.every((origin) => text.includes(origin));
});
if (alreadyPresent) {
  console.log('001-fixed-preview-origin-cors: fixed preview origins already present');
  process.exit(0);
}

let patchedFile = '';
for (const file of sourceFiles) {
  let text = readFileSync(file, 'utf8');
  if (!text.includes('ORIGIN_NOT_ALLOWED')) continue;

  for (const anchor of legacyOriginAnchors) {
    const escaped = anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(["'])${escaped}\\1\\s*,`);
    const match = text.match(pattern);
    if (!match) continue;

    const quote = match[1];
    const insertion = wantedOrigins.map((origin) => `${quote}${origin}${quote},`).join('');
    text = text.replace(pattern, `${match[0]}${insertion}`);

    for (const origin of wantedOrigins) {
      if (!text.includes(origin)) {
        throw new Error(`001-fixed-preview-origin-cors verification failed: ${origin}`);
      }
    }

    writeFileSync(file, text, 'utf8');
    patchedFile = file;
    break;
  }

  if (patchedFile) break;
}

if (!patchedFile) {
  throw new Error(
    '001-fixed-preview-origin-cors: could not find a safe allowed-origin insertion point in the live Worker source'
  );
}

console.log(`001-fixed-preview-origin-cors: added fixed preview origins to ${patchedFile}`);
