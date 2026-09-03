const fs = require('node:fs');
const path = require('node:path');

const sourcePath = path.resolve(__dirname, '..', 'src', 'index.ts');
let source = fs.readFileSync(sourcePath, 'utf8');

const anchor = 'const ALLOWED_ORIGINS = [\n';
const previewOrigin = '  "https://preview.soridraw.com",\n';

if (!source.includes(anchor)) throw new Error('994c ALLOWED_ORIGINS anchor missing');
if (!source.includes('"https://preview.soridraw.com"')) {
  source = source.replace(anchor, anchor + previewOrigin);
  fs.writeFileSync(sourcePath, source, 'utf8');
}

const verify = fs.readFileSync(sourcePath, 'utf8');
if (!verify.includes('"https://preview.soridraw.com"')) {
  throw new Error('994c preview CORS origin verification failed');
}
console.log('apply-suno-wav-rescue-preview-cors-994c: preview.soridraw.com allowed');
