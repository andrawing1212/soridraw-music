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
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';

assert.ok(app.includes('shouldShowStaleChunkRecovery(error)'), '723 boundary must mask only recoverable stale chunk');
assert.ok(app.includes('if (recoverFromStaleChunkError(error)) return;'), '723 existing reload kept');
assert.ok(app.includes('새 버전을 불러오고 있습니다.'), '723 neutral text');
const store = new Map();
let clock = 1_800_000_000_000;
const source = ts.transpileModule(service.replaceAll('export const','const'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  + '\nglobalThis.testAPI = { shouldShowStaleChunkRecovery, recoverFromStaleChunkError };';
const create = () => {
  let reloads = 0;
  const Clock = class extends Date { static now() { return clock; } };
  const ctx = { Date: Clock, window: {
    sessionStorage: { getItem: k => store.get(k) ?? null, setItem: (k,v) => store.set(k,v) },
    location: { reload: () => { reloads += 1; } },
  }};
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  return { api: ctx.testAPI, reloads: () => reloads };
};
const stale = 'Failed to fetch dynamically imported module: /assets/stale.js';
const firebaseError = 'FirebaseError: permission denied';
const first = create();
assert.equal(first.api.shouldShowStaleChunkRecovery(firebaseError), false);
assert.equal(first.api.recoverFromStaleChunkError(firebaseError), false);
assert.equal(first.api.shouldShowStaleChunkRecovery(stale), true);
assert.equal(first.api.recoverFromStaleChunkError(stale), true);
assert.equal(first.api.shouldShowStaleChunkRecovery(stale), true);
assert.equal(first.api.recoverFromStaleChunkError(stale), true);
assert.equal(first.reloads(), 1, 'only one reload per page');
const repeat = create();
assert.equal(repeat.api.shouldShowStaleChunkRecovery(stale), false, 'repeat failure exposes real error');
assert.equal(repeat.api.recoverFromStaleChunkError(stale), false);
assert.equal(repeat.reloads(), 0, 'no reload loop');
clock += 60_001;
const afterCooldown = create();
assert.equal(afterCooldown.api.shouldShowStaleChunkRecovery(stale), true);
assert.equal(afterCooldown.api.recoverFromStaleChunkError(stale), true);
assert.equal(afterCooldown.reloads(), 1);
console.log('APP723_STALE_CHUNK_UPDATE_NEUTRAL_SCREEN_AND_REPEAT_FAILURE_VISIBLE=PASS');
