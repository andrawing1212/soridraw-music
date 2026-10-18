import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const engine = fs.readFileSync('src/lib/userDataEngine.ts', 'utf8');

function functionRange(source, name) {
  const candidates = [
    `const ${name} = async (`,
    `export const ${name} = async (`,
    `const ${name} = (`,
    `export const ${name} = (`,
    `function ${name}(`,
    `async function ${name}(`,
  ];
  let start = -1;
  for (const needle of candidates) {
    start = source.indexOf(needle);
    if (start >= 0) break;
  }
  assert.ok(start >= 0, `${name} must exist`);
  const brace = source.indexOf('{', start);
  assert.ok(brace >= 0, `${name} body must start`);
  let depth = 0, quote = '', escaped = false, comment = '';
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i], next = source[i + 1];
    if (comment === 'line') { if (ch === '\n') comment = ''; continue; }
    if (comment === 'block') { if (ch === '*' && next === '/') { comment = ''; i += 1; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '/' && next === '/') { comment = 'line'; i += 1; continue; }
    if (ch === '/' && next === '*') { comment = 'block'; i += 1; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`${name} did not terminate`);
}

const forced = functionRange(engine, 'refreshCatalogSnapshotAfterKnownMutation');
assert.match(forced, /readCatalogSnapshotFromLocalCache\(kind, uid\)/,
  'known-mutation recovery must start from the existing local Catalog');
assert.match(forced, /readRemoteCatalogSnapshot\(kind, uid, 0, local, false\)/,
  'known-mutation recovery must bypass warm cache and forbid bootstrap repair');
for (const forbidden of ['firestoreCatalogQuery(', 'bootstrapSharedCatalogFromCanonical(', '/bootstrap', 'collection(', 'getDocs(']) {
  assert.ok(!forced.includes(forbidden), `known-mutation recovery must not scan/bootstrap Firestore: ${forbidden}`);
}

const remote = functionRange(engine, 'readRemoteCatalogSnapshot');
assert.match(remote, /allowBootstrapRepair = true/,
  'normal Catalog path must preserve existing bootstrap compatibility by default');
assert.match(remote, /!allowBootstrapRepair[\s\S]*CATALOG_KNOWN_MUTATION_REPAIR_REQUIRED/,
  'mutation recovery must stop instead of canonical Firestore bootstrap');

const recover = functionRange(app, 'recoverMusicNoteCatalogAfterRemoteCanonical');
assert.match(recover, /refreshCatalogSnapshotAfterKnownMutation\('musicNote', safeUid\)/,
  'remote canonical recovery must read the bounded Music Note R2 Catalog');
assert.match(recover, /expectedMutationSettled/,
  'recovery must prove the triggering canonical mutation is present in Catalog');
assert.match(recover, /if \(!snapshot \|\| !expectedMutationSettled\) return;/,
  'stale Catalog must never overwrite the exact RTDB canonical patch');
assert.match(recover, /stripStudioHeartPendingLayerFromFavorites/,
  'Catalog reconciliation must compare against canonical local rows, not optimistic overlay');
assert.match(recover, /listStudioHeartPendingIntents\(safeUid\)/,
  'initiating-device pending latest intent must be protected');
assert.match(recover, /rememberRecentHeartAuthority\(/,
  'complete Catalog recovery must reconcile Recent saved-heart authority');
assert.match(recover, /writeFavoritesCache\(safeUid, authoritative, \{ publishDerived: false \}\)/,
  'remote recovery must not echo the received Catalog back to R2');
for (const forbidden of ['getDocs(', "collection(db, 'favorites')", 'setDoc(', 'updateDoc(']) {
  assert.ok(!recover.includes(forbidden), `Catalog catch-up must add no Firestore data IO: ${forbidden}`);
}

const queue = functionRange(app, 'queueMusicNoteCatalogRecoveryAfterRemoteCanonical');
assert.match(queue, /musicNoteCanonicalRecoveryTimerRef/,
  'multiple canonical signals must coalesce to one catch-up timer');
assert.match(queue, /recoverMusicNoteCatalogAfterRemoteCanonical/,
  'coalesced catch-up must call the bounded recovery');

const sync = functionRange(app, 'syncMusicNoteIncrementalFromRemoteVersion');
const previewStart = sync.indexOf('if (isHeartPreview)');
const recoveryCall = sync.indexOf('queueMusicNoteCatalogRecoveryAfterRemoteCanonical(');
assert.ok(previewStart >= 0 && recoveryCall > previewStart,
  'heart preview handling must remain before canonical Catalog recovery');
const previewTail = sync.indexOf('return;', previewStart);
assert.ok(previewTail >= 0 && previewTail < recoveryCall,
  'heart-preview save/unsave must return without R2 Catalog read');
assert.match(sync, /queueMusicNoteCatalogRecoveryAfterRemoteCanonical\([\s\S]*?!isRemovalOperation && !removed/,
  'canonical save/unsave exact-item path must schedule full Catalog convergence');

assert.match(app, /originDeviceId && originDeviceId === getMusicNoteDeviceId\(\)[\s\S]*?return;/,
  'initiating device canonical signal must keep its no-reread fast path');
assert.match(app, /STUDIO_HEART_BATCH_MS/,
  'existing +30s Studio heart batching must remain present');
assert.match(app, /publishMusicNoteHeartPreviewDelta/,
  'existing same-UID immediate preview must remain present');

console.log('APP426_MUSIC_NOTE_MISSED_MUTATION_CATALOG_RECOVERY=PASS');
console.log('APP426_HEART_PREVIEW_R2_READ_ZERO=PASS');
console.log('APP426_NO_FIRESTORE_SCAN_RECOVERY=PASS');
console.log('APP426_STALE_CATALOG_ROLLBACK_GUARD=PASS');
console.log('APP426_PENDING_INTENT_PRECEDENCE=PASS');
