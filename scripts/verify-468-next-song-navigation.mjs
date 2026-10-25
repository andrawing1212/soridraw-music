#!/usr/bin/env node
// app468: exact next-song recipe and Studio routing survive browser quota 22.
// No network, Firebase, user-data reset or browser cache clearing.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';

const source = readFileSync('src/lib/nextSongPendingBridge.ts', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');
const note = readFileSync('src/pages/FavoritesPage.tsx', 'utf8');
const library = readFileSync('src/pages/SunoLibraryPage.tsx', 'utf8');
const { code } = await transform(source, { loader: 'ts', format: 'esm', target: 'es2022' });
const { stageNextSongKeywords: stage, readNextSongKeywords: read, clearNextSongKeywords: clear } =
  await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

const makeStore = (shouldThrow = false) => {
  const items = new Map([['other-user-draft', 'KEEP_ORIGINAL']]);
  return {
    items,
    setItem(key, value) {
      if (shouldThrow) throw Object.assign(new Error('Quota exceeded'), { code: 22, name: 'QuotaExceededError' });
      items.set(key, value);
    },
    getItem(key) { return items.get(key) ?? null; },
    removeItem(key) { items.delete(key); },
  };
};

const one = JSON.stringify({ genre: ['old'], userInput: 'EXACT FIRST SONG PROMPT' });
const two = JSON.stringify({ genre: ['new'], userInput: 'EXACT NEXT SONG PROMPT' });
for (const [sessionBlocked, localBlocked] of [[false, false], [false, true], [true, false], [true, true]]) {
  const sessionStorage = makeStore(sessionBlocked);
  const localStorage = makeStore(localBlocked);
  globalThis.window = { sessionStorage, localStorage };
  const result = stage(one);
  assert.equal(result.sessionSaved, !sessionBlocked);
  assert.equal(result.backupSaved, !localBlocked);
  assert.equal(read(), one, 'Always deliver the exact clicked settings in same-tab memory');
  clear(one);
  assert.equal(read(), null, 'Completed action must not reapply the old recipe');
  assert.equal(sessionStorage.items.get('other-user-draft'), 'KEEP_ORIGINAL');
  assert.equal(localStorage.items.get('other-user-draft'), 'KEEP_ORIGINAL');
}

const session = makeStore();
const local = makeStore(true);
globalThis.window = { sessionStorage: session, localStorage: local };
stage(one);
stage(two);
clear(one);
assert.equal(read(), two, 'Old async completion must not erase a newer click');
clear(two);
assert.equal(read(), null);

globalThis.window = { sessionStorage: makeStore(), localStorage: makeStore() };
window.sessionStorage.setItem('pendingAppliedKeywords', one);
assert.equal(read(), one, 'Reloaded tab may recover from persisted session key');
clear(one);
window.localStorage.setItem('pendingAppliedKeywordsBackup', two);
assert.equal(read(), two, 'Legacy backup continues to work when session key is absent');
clear(two);

globalThis.window = {
  get sessionStorage() { throw Object.assign(new Error('Storage denied'), { name: 'SecurityError' }); },
  get localStorage() { throw Object.assign(new Error('Storage denied'), { name: 'SecurityError' }); },
};
assert.deepEqual(stage(two), { sessionSaved: false, backupSaved: false });
assert.equal(read(), two, 'Both browser stores blocked: SPA route still receives keywords');
clear(two);
assert.equal(read(), null);

assert.match(note, /stageNextSongKeywords\(serialized\)/);
assert.match(note, /navigate\(`\/studio\?applyPending=1&t=\$\{Date\.now\(\)\}`\)/);
assert.match(library, /stageNextSongKeywords\(serialized\)/);
assert.match(library, /navigate\(`\/studio\?applyPending=1&t=\$\{Date\.now\(\)\}`\)/);
assert.match(app, /const pending = readNextSongKeywords\(\)/);
assert.match(app, /applyKeywordsToNext\(keywords\);\s*clearNextSongKeywords\(pending\)/);
assert.match(app, /onClick=\{\(\) => \{\s*applyKeywordsToNext\(result\.appliedKeywords\);[\s\S]{0,500}?navigateStudioWorkspaceView\('create'\)/);
for (const page of [note, library]) {
  assert.ok(!page.includes(`sessionStorage.setItem('pendingAppliedKeywords', serialized)`));
  assert.ok(!page.includes(`localStorage.setItem('pendingAppliedKeywordsBackup', serialized)`));
}
assert.ok(!/localStorage\.clear\(|sessionStorage\.clear\(|caches\.delete\(|indexedDB\.deleteDatabase\(/.test(source),
  'Next-song bridge must not erase shared browser caches or local-first drafts');
console.log('SORIDRAW_APP468_NEXT_SONG_STORAGE_NAVIGATION=PASS');
