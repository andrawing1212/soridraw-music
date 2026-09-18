const fs = require('node:fs');
const path = require('node:path');

const sourcePath = path.resolve(__dirname, '..', 'src', 'index.ts');
let source = fs.readFileSync(sourcePath, 'utf8');

const anchor = 'const ALLOWED_ORIGINS = [\n';
const requiredOrigins = [
  'https://preview.soridraw.com',
  'https://soridraw-preview.web.app',
  'https://soridraw-preview.firebaseapp.com',
  'https://test.soridraw.com',
  'https://soridraw-test.web.app',
  'https://soridraw-test.firebaseapp.com',
  'https://soridraw.com',
  'https://soridraw.web.app',
  'https://soridraw.firebaseapp.com',
];

if (!source.includes(anchor)) throw new Error('994c ALLOWED_ORIGINS anchor missing');

const missingOrigins = requiredOrigins.filter((origin) => !source.includes(`"${origin}"`));
if (missingOrigins.length) {
  const additions = missingOrigins.map((origin) => `  "${origin}",\n`).join('');
  source = source.replace(anchor, anchor + additions);
  fs.writeFileSync(sourcePath, source, 'utf8');
}

const verify = fs.readFileSync(sourcePath, 'utf8');
for (const origin of requiredOrigins) {
  if (!verify.includes(`"${origin}"`)) {
    throw new Error(`994c Firebase environment CORS verification failed: ${origin}`);
  }
}
console.log('apply-suno-wav-rescue-preview-cors-994c: PREVIEW/TEST/PRODUCTION Firebase origins allowed');
