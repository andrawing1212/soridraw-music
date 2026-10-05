import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const page = fs.readFileSync('src/pages/FavoritesPage.tsx', 'utf8');

function extractConstArrow(source, name, nextMarker) {
  const start = source.indexOf('  const ' + name + ' = (');
  assert.ok(start >= 0, 'missing ' + name);
  const end = source.indexOf(nextMarker, start);
  assert.ok(end > start, 'missing end for ' + name);
  return source.slice(start, end);
}

const settleMarker = app.indexOf('// app349 — capture the visible pending row');
assert.ok(settleMarker >= 0, 'app349 settlement marker missing');
const settleStart = app.lastIndexOf('  const removeStudioHeartIntentLocal = (', settleMarker);
const settleEnd = app.indexOf('\n\n  // app347', settleMarker);
assert.ok(settleStart >= 0 && settleEnd > settleMarker, 'app349 settlement helper bounds missing');
const settle = app.slice(settleStart, settleEnd);
assert.equal((app.match(/  const removeStudioHeartIntentLocal = \(uid: string, documentId: string\) => \{/g) || []).length, 1, 'duplicate settlement helper');
assert.match(settle, /const settlingIntent = readStudioHeartPendingIntent/);
assert.match(settle, /favoritesStore\.setFavorites\(settled\)/);
assert.match(settle, /writeFavoritesCache\(safeUid, settled\)/);
assert.match(settle, /delete canonicalRow\.__studioHeartPendingLocal/);
assert.doesNotMatch(settle, /getDoc\(|getDocs\(|setDoc\(|updateDoc\(|fetch\(/);

// Simulate the exact A-device failure: only the pending overlay is visible
// when +30s canonical settlement finishes. Removing the intent must leave
// one ordinary saved row, not an empty list.
const settleJs = ts.transpileModule(settle + '\n;globalThis.__settle = removeStudioHeartIntentLocal;', {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
let current = [{
  id: 'doc-a', firestoreId: 'doc-a', title: 'A', saved: true,
  sunoCoverUrl: 'cover-a', __studioHeartPendingLocal: true, updatedAtMs: 200,
}];
const pending = {
  documentId: 'doc-a', desiredSaved: true, updatedAtMs: 100,
  baselineFavorite: null, song: { id: 'doc-a', title: 'A', saved: true },
};
let removed = false;
let cached = null;
const ctx = {
  String, Number,
  readStudioHeartPendingIntent: () => pending,
  favoritesStore: {
    getFavorites: () => current,
    setFavorites: (next) => { current = next; },
  },
  clearStudioHeartIntentTimer: () => {},
  removeStudioHeartPendingIntent: () => { removed = true; },
  normalizeFavoriteTitleFields: (x) => x,
  mergeFavoritePages: (a, b) => [...a, ...b.filter((x) => !a.some((y) => y.id === x.id))],
  sortFavoriteList: (x) => x,
  writeFavoritesCache: (_uid, next) => { cached = next; },
  setFavorites: () => { throw new Error('fallback setFavorites must not run'); },
};
vm.createContext(ctx);
vm.runInContext(settleJs, ctx);
ctx.__settle('u', 'doc-a');
assert.equal(removed, true);
assert.equal(current.length, 1);
assert.equal(current[0].id, 'doc-a');
assert.equal(current[0].saved, true);
assert.equal(current[0].sunoCoverUrl, 'cover-a');
assert.equal(current[0].__studioHeartPendingLocal, undefined);
assert.equal(cached.length, 1);

const remote = extractConstArrow(app, 'applyRemoteStudioHeartPreview', '\n\n  const clearRemoteStudioHeartPreviewFromCanonical');
assert.match(remote, /favoritesStore\.setFavorites\(visible\)/);
assert.match(remote, /writeFavoritesCache\(safeUid, visible\)/);
assert.match(remote, /overlayStudioHeartRemotePreviewsOnFavorites/);
assert.doesNotMatch(remote, /getDoc\(|getDocs\(|setDoc\(|updateDoc\(|fetch\(/);

const cardStart = page.indexOf('  const syncFavoriteSunoCardMedia = (');
const cardEnd = page.indexOf('\n\n  const publishFavoriteSunoMediaDraft', cardStart);
const card = page.slice(cardStart, cardEnd);
assert.match(card, /soridraw_favorites_cache_/);
assert.match(card, /localStorage\.setItem/);
assert.match(card, /'sunoLinks'/);
assert.match(card, /'sunoCoverUrl'/);
assert.match(card, /'thumbnailUrl'/);
assert.doesNotMatch(card, /getDoc\(|updateFavorite\(/);

const overlayStart = page.indexOf('// A full R2 catalog can arrive after a local URL edit');
const overlayEnd = page.indexOf('\n\n  const queueFavoriteDetailPatch', overlayStart);
const draftOverlay = page.slice(overlayStart, overlayEnd);
assert.match(draftOverlay, /const mediaVersionCompatible/);
assert.match(draftOverlay, /currentMediaVersion <= draftMediaVersion/);
assert.match(draftOverlay, /if \(!compatible && !mediaVersionCompatible\) continue/);
assert.doesNotMatch(draftOverlay, /getDoc\(|updateFavorite\(/);

const openStart = page.indexOf('  const openFavoriteDetail = async');
const openEnd = page.indexOf('\n\n  const executeFavoriteMenuAction', openStart);
const open = page.slice(openStart, openEnd);
assert.match(open, /const mediaVersionCompatible/);
assert.match(open, /compatible \|\| mediaVersionCompatible/);

assert.match(app, /const STUDIO_HEART_BATCH_MS = 30_000;/);
assert.match(app, /publishMusicNoteHeartPreviewDelta\(uid, safeDocumentId, intent\.song, desiredSaved\)/);

console.log('APP349_A_CANONICAL_SETTLEMENT_NO_DISAPPEAR=PASS');
console.log('APP349_B_REMOTE_MUSIC_NOTE_IMMEDIATE_CACHE=PASS');
console.log('APP349_SUNO_LIST_MEDIA_DURABLE_LOCAL_CACHE=PASS');
console.log('APP349_SUNO_DRAFT_MEDIA_REVISION_ISOLATED=PASS');
console.log('APP349_EXTRA_FIRESTORE_D1_IO=0');
