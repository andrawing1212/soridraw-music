const fs = require('node:fs');
const path = require('node:path');

const sourcePath = path.resolve(__dirname, '..', 'src', 'index.ts');
let source = fs.readFileSync(sourcePath, 'utf8');

const marker = '// SORIDRAW_SUNO_WAV_RESCUE_994';
if (!source.includes(marker)) throw new Error('994b requires 994 rescue patch first');

const before = `export const rescueSunoTrackAudio = onRequest(\n  {\n    region: "us-central1",\n    timeoutSeconds: 120,`;
const after = `export const rescueSunoTrackAudio = onRequest(\n  {\n    region: "us-central1",\n    invoker: "public",\n    timeoutSeconds: 120,`;

if (!source.includes('invoker: "public",\n    timeoutSeconds: 120,')) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`994b rescue export anchor count=${count}`);
  source = source.replace(before, after);
  fs.writeFileSync(sourcePath, source, 'utf8');
}

const verify = fs.readFileSync(sourcePath, 'utf8');
if (!verify.includes('export const rescueSunoTrackAudio = onRequest(') || !verify.includes('invoker: "public",\n    timeoutSeconds: 120,')) {
  throw new Error('994b public invoker verification failed');
}
console.log('apply-suno-wav-rescue-public-994b: public HTTP entrypoint + in-function Auth/App Check preserved');
