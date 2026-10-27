import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// app516 safety rollback: the independent audit proved that a client can
// re-save a row in shared R2 after another device unsaves it in Firestore.
// This guard deliberately verifies a *read-only* diagnostic, not a repair.
const diagnosticPath = 'src/lib/studioHeartSingleDocDiagnostic.ts';
const uiPath = 'src/components/StudioHeartSingleDocDiagnostic.tsx';
const enginePath = 'src/lib/userDataEngine.ts';
const unsafePath = 'src/lib/musicNoteSingleDocCatalogRepair516.ts';
const diagnostic = readFileSync(diagnosticPath, 'utf8');
const ui = readFileSync(uiPath, 'utf8');
const engine = readFileSync(enginePath, 'utf8');

assert.equal(existsSync(unsafePath), false, 'unsafe client repair module must not exist');
assert.doesNotMatch(ui, /repairSingleExactMusicNoteCatalog516|server.*복구|저장곡 목록 1건 복구/);
assert.doesNotMatch(engine, /reconcileExactMusicNoteCatalogFromCanonical516|readRemoteCatalogForExactRecovery516/);
assert.match(ui, /inspectExactStudioHeartDocument/);
assert.match(diagnostic, /getDocsFromServer\(exactOwnerQuery\)/);
assert.match(diagnostic, /limit\(1\)/);
assert.doesNotMatch(diagnostic, /setDoc\(|updateDoc\(|deleteDoc\(|publishRemoteCatalogDelta|publishMusicNoteSaveStateDelta/);

const compiled = ts.transpileModule(diagnostic, {
  fileName: diagnosticPath,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const api = {};
const active = item => Boolean(item) && item.saved !== false && item.favoriteRemoved !== true
  && item.hidden !== true && !item.deletedAt && !item.trashedAt;
runInNewContext(compiled, {
  exports: api,
  require: name => {
    if (name === '../firebase') return { auth: {}, db: {} };
    if (name === './firestoreMeasured') return {};
    if (name === 'firebase/firestore') return {};
    if (name === './cacheDiagnostics') return {};
    if (name === '../hooks/useFavoritesStore') return { favoritesStore: {} };
    if (name === './studioHeartBatch') return {};
    if (name === './userDataEngine') return {};
    if (name === './musicNoteSavedState') return { isMusicNoteItemRemoved: item => !active(item) };
    throw new Error('unexpected import: ' + name);
  },
});
const id = 'correct-firestore-document-id';
assert.equal(api.catalogContainsExactFavoriteDocument516(
  [{ id, firestoreId: 'wrong-legacy-alias', saved: true }], id), true,
  'canonical item.id must be primary');
assert.equal(api.catalogContainsExactFavoriteDocument516(
  [{ id: 'other', firestoreId: id, saved: true }], id), false,
  'an unrelated row must not match an alias');
assert.equal(api.catalogContainsExactFavoriteDocument516(
  [{ id, saved: false }], id), false,
  'tombstone must not show as active');
assert.equal(api.catalogContainsExactFavoriteDocument516(
  [{ firestoreId: id, saved: true }], id), true,
  'legacy rows without canonical id keep fallback support');
console.log('APP516_CANONICAL_ID_COMPARISON_NO_FALSE_NEGATIVE=PASS');
console.log('APP516_UNSAFE_R2_WRITE_AND_RTDB_SAVE_REPLAY_REMOVED=PASS');
console.log('APP516_ONE_DOC_DIAGNOSTIC_READ_ONLY_PRESERVED=PASS');
