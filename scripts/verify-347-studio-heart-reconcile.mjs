import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync('src/App.tsx', 'utf8');

function extractFunction(name) {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'missing function ' + name);
  const brace = source.indexOf('{', start);
  let depth = 0, quote = null, escape = false, line = false, block = false;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i], next = source[i + 1];
    if (line) { if (ch === '\n') line = false; continue; }
    if (block) { if (ch === '*' && next === '/') { block = false; i += 1; } continue; }
    if (quote) {
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '/' && next === '/') { line = true; i += 1; continue; }
    if (ch === '/' && next === '*') { block = true; i += 1; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error('unterminated function ' + name);
}

function extractConstArrow(name) {
  const marker = 'const ' + name + ' = (';
  const start = source.indexOf(marker);
  assert.ok(start >= 0, 'missing const arrow ' + name);
  const arrow = source.indexOf('=>', start);
  const brace = source.indexOf('{', arrow);
  let depth = 0, quote = null, escape = false, line = false, block = false;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i], next = source[i + 1];
    if (line) { if (ch === '\n') line = false; continue; }
    if (block) { if (ch === '*' && next === '/') { block = false; i += 1; } continue; }
    if (quote) {
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '/' && next === '/') { line = true; i += 1; continue; }
    if (ch === '/' && next === '*') { block = true; i += 1; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}' && --depth === 0) return source.slice(start, i + 1) + ';';
  }
  throw new Error('unterminated arrow ' + name);
}

const overlay = extractFunction('overlayStudioHeartPendingIntentsOnFavorites');
assert.match(overlay, /const currentFavorite = next\.find/);
assert.match(overlay, /\.\.\.\(currentFavorite \|\| \{\}\)/);
assert.ok(
  overlay.indexOf('...(currentFavorite || {})') > overlay.indexOf('...(intent.song || {})'),
  'newer current row must outrank stale pending song snapshot',
);

const pending = [{
  documentId: 'doc-a',
  identityKey: 'song-a',
  desiredSaved: true,
  baselineSaved: false,
  baselineFavorite: null,
  song: { id: 'doc-a', firestoreId: 'doc-a', title: 'A old', coverUrl: null, sunoUrlPrimary: null },
  updatedAtMs: 100,
}];
const ctx = {
  Date,
  listStudioHeartPendingIntents: () => pending,
  stripStudioHeartPendingLayerFromFavorites: (_uid, list) => [...list],
  normalizeFavoriteTitleFields: (x) => x,
  buildFavoriteIdentityKey: () => 'k',
  buildFavoriteSearchTokens: () => [],
  mergeFavoritePages: (a, b) => [...a, ...b.filter(x => !a.some(y => y.id === x.id))],
  sortFavoriteList: (x) => x,
};
vm.createContext(ctx);
vm.runInContext(ts.transpileModule(overlay, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText + '\nglobalThis.__overlay = overlayStudioHeartPendingIntentsOnFavorites;', ctx);
const merged = ctx.__overlay('u', [{
  id: 'doc-a',
  firestoreId: 'doc-a',
  title: 'A canonical',
  coverUrl: 'https://img/new.jpg',
  sunoUrlPrimary: 'https://suno/new',
  updatedAtMs: 200,
}]);
assert.equal(merged.length, 1);
assert.equal(merged[0].coverUrl, 'https://img/new.jpg');
assert.equal(merged[0].sunoUrlPrimary, 'https://suno/new');
assert.equal(merged[0].title, 'A canonical');
assert.equal(merged[0].__studioHeartPendingLocal, true);

const reconcile = extractConstArrow('reconcileStudioHeartPendingFromCanonicalSignal');
assert.match(reconcile, /pending\.documentId === safeRemoteId/);
assert.match(reconcile, /pending\.identityKey === remoteIdentityKey/);
assert.match(reconcile, /pending\.desiredSaved !== remoteSaved/);
assert.doesNotMatch(reconcile, /getDoc\(|getDocs\(|fetch\(/);

assert.match(source, /isCanonicalMembershipSignal = normalizedOperation === 'save'[\s\S]*?\|\| normalizedOperation === 'restore'[\s\S]*?\|\| normalizedOperation === 'shared-note-save'[\s\S]*?\|\| isRemovalOperation/);
assert.match(source, /reconcileStudioHeartPendingFromCanonicalSignal\([\s\S]*?remoteFavoriteId \|\| exactDocumentIds\[0\]/);
assert.doesNotMatch(source.slice(source.indexOf('const reconcileStudioHeartPendingFromCanonicalSignal'), source.indexOf('const persistRecentHeartAuthority')), /getDoc\(|getDocs\(|fetch\(/);

console.log('APP347_PENDING_MEMBERSHIP_CANONICAL_RECONCILE=PASS');
console.log('APP347_PENDING_OVERLAY_PRESERVES_NEWER_MEDIA=PASS');
console.log('APP347_RECOVERY_EXTRA_SERVER_IO=0');
