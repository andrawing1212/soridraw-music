import fs from 'node:fs';
const read=(p)=>fs.readFileSync(p,'utf8');
const service=read('src/services/chunkLoadRecovery.ts');
const app=read('src/App.tsx');
const main=read('src/main.tsx');
for (const token of [
  'SORIDRAW_CHUNK_LOAD_RECOVERY_047',
  'failed to fetch dynamically imported module',
  'importing a module script failed',
  'chunkloaderror',
  'RECOVERY_COOLDOWN_MS = 60_000',
  'window.sessionStorage.setItem',
  'window.location.reload()',
  "window.addEventListener('unhandledrejection'",
  "window.addEventListener('error'",
]) if(!service.toLowerCase().includes(token.toLowerCase())) throw new Error(`047 service token missing: ${token}`);
if(!app.includes('if (recoverFromStaleChunkError(error)) return;')) throw new Error('047 ErrorBoundary recovery hook missing');
if(!main.includes('installChunkLoadRecovery();')) throw new Error('047 global recovery install missing');
if(!main.includes("from './services/chunkLoadRecovery'")) throw new Error('047 main import missing');
console.log('STALE_CHUNK_RECOVERY_047=PASS');
