const fs = require('fs');
const path = require('path');

const target = path.resolve(__dirname, '../src/index.ts');
let text = fs.readFileSync(target, 'utf8');

const origins = [
  'https://preview.soridraw.com',
  'https://soridraw-preview.web.app',
  'https://soridraw-preview.firebaseapp.com',
];

const missing = origins.filter((origin) => !text.includes(`"${origin}"`));
if (missing.length === 0) {
  console.log('apply-custom-domains-cors: preview origins already present');
  process.exit(0);
}

const anchor = 'const ALLOWED_ORIGINS = [';
const start = text.indexOf(anchor);
if (start < 0) {
  throw new Error('apply-custom-domains-cors: ALLOWED_ORIGINS anchor not found');
}

const end = text.indexOf('\n];', start);
if (end < 0) {
  throw new Error('apply-custom-domains-cors: ALLOWED_ORIGINS closing anchor not found');
}

const block = text.slice(start, end);
const insertion = missing.map((origin) => `  "${origin}",`).join('\n');
text = `${text.slice(0, end)}\n${insertion}${text.slice(end)}`;

const updatedBlockEnd = text.indexOf('\n];', start);
const updatedBlock = text.slice(start, updatedBlockEnd);
for (const origin of origins) {
  if (!updatedBlock.includes(`"${origin}"`)) {
    throw new Error(`apply-custom-domains-cors verification failed: ${origin}`);
  }
}

fs.writeFileSync(target, text, 'utf8');
console.log(`apply-custom-domains-cors: added ${missing.length} fixed preview origin(s) to Functions CORS`);
