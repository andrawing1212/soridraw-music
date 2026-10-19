import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source=fs.readFileSync('src/lib/musicNoteNextSongRecipe.ts','utf8');
const transpiled=ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
const ctx={exports:{}};
vm.runInNewContext(transpiled,ctx);
const resolve=ctx.exports.resolveMusicNoteNextSongRecipe;
const mergeOnClick=ctx.exports.mergeMusicNoteNextSongClickRecipe455;
assert.equal(typeof mergeOnClick,'function');
const existingFullCard={id:'old-one',title:'Saved local song',appliedKeywords:{genre:['indie']}};
const exactHistoricalDocument={
  id:'old-one',title:'Old server title',
  appliedKeywords:{genre:['indie']},
  requestPayload:{appliedKeywords:{commandInput:'Recorded original manual command; do not invent.'},genre:['indie']},
};
const local=resolve(existingFullCard);
const remote=resolve(exactHistoricalDocument);
const merged={...remote,...local};
assert.equal(local.userInput,undefined,'the fully painted local card does not necessarily carry original command');
assert.equal(merged.userInput,'Recorded original manual command; do not invent.');
const placeholderOldCard = { ...existingFullCard, userInput: '' };
const restored = mergeOnClick(placeholderOldCard, exactHistoricalDocument);
assert.equal(restored.userInput,'Recorded original manual command; do not invent.',
 'historical card empty top-level placeholder must not hide the stored direct command');
const legacyAutoEmpty = mergeOnClick({
  ...existingFullCard, appliedKeywords: { genre:['indie'], userInput:'' },
},exactHistoricalDocument);
assert.equal(legacyAutoEmpty.userInput,'Recorded original manual command; do not invent.',
 'a legacy auto-empty appliedKeywords.userInput cannot suppress a persisted command');
const explicitEmpty = mergeOnClick({
  ...existingFullCard, appliedKeywords: { genre:['indie'], userInput:'', manualCommandClearedAt:123456 },
},exactHistoricalDocument);
assert.equal(explicitEmpty.userInput,'',
 'a verified explicit clear marker must keep an intentionally removed command');
assert.equal(mergeOnClick({ id:'old-one', userInput:'' },{ id:'old-one',prompt:'AI GENERATED TEXT' }).userInput,'',
 'must not fabricate a direct command from a generated prompt');

assert.equal(merged.genre[0],'indie');
assert.equal(resolve({appliedKeywords:{userInput:''},requestPayload:{commandInput:'older command'}}).userInput,'older command',
 'empty automatic appliedKeywords field cannot erase a stored legacy direct command');
assert.equal(resolve({appliedKeywords:{userInput:'',manualCommandClearedAt:1234},requestPayload:{commandInput:'older command'}}).userInput,'',
 'a proven later manual clear wins');
assert.equal(resolve({requestPayload:{directInput:'genuine direct instructions'}}).userInput,'genuine direct instructions');
assert.ok(!resolve({prompt:'Generated prompt only'}).userInput,'no hallucinated manual command from generated prompt');

const favorite=fs.readFileSync('src/pages/FavoritesPage.tsx','utf8');
assert.match(favorite,/const hydrateCatalogFavorite = async \(song: any, requireStoredRecipe = false\)/);
assert.match(favorite,/if \(requireStoredRecipe\) \{[\s\S]{0,1000}mergeMusicNoteNextSongClickRecipe455\(song, detail\)/);
assert.ok(favorite.includes("getDocFromServer(doc(db, 'favorites', sourceId))"),
 'explicit Next Song must read its one exact original, not stale same-version cache');
assert.ok(favorite.includes('if (ownerUid && ownerUid !== user.uid) return null'),
 'explicit source verification must block mismatched ownership');
assert.ok(favorite.includes('getOrLoadMusicNoteOriginalRecipe456({'),
 'explicit next-song uses special action-scoped source loader');
assert.ok(favorite.includes(': getOrLoadMusicNoteDetail({'),
 'ordinary Detail retains normal cache-first behavior');
assert.match(favorite,/hydrateCatalogFavorite\(song, true\)\.then\(\(hydrated\) => applyKeywordsToNext\(hydrated\)\)/);
assert.match(favorite,/hydrateCatalogFavorite\(selectedSong, true\)\.then\(\(hydrated\) => applyKeywordsToNext\(hydrated\)\)/);
assert.doesNotMatch(favorite,/getDocs\(collection\(db, 'favorites'/,'no collection scan');

const detailCacheSource=fs.readFileSync('src/lib/musicNoteDetailCache.ts','utf8');
const detailJs=ts.transpileModule(detailCacheSource, {
 compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}
}).outputText;
const detailCtx={exports:{}};
vm.runInNewContext(detailJs,detailCtx);
const getOriginal=detailCtx.exports.getOrLoadMusicNoteOriginalRecipe456;
assert.equal(typeof getOriginal,'function');
let reads=0;
const originalArgs={
 uid:'same-account',sourceId:'historical-song-1',sourceVersion:1000,
 loader:async()=>{reads++;return {requestPayload:{commandInput:'persisted old command'}};},
};
const first=await getOriginal(originalArgs);
const second=await getOriginal({...originalArgs,loader:async()=>{throw Error('same sourceVersion should memoize');}});
assert.equal(first.requestPayload.commandInput,'persisted old command');
assert.equal(second.requestPayload.commandInput,first.requestPayload.commandInput);
assert.equal(reads,1,'one exact user-click source read per song and version/session');
await getOriginal({...originalArgs,sourceVersion:1001});
assert.equal(reads,2,'new canonical sourceVersion must invalidate old action memo');
let missingReads=0;
const missing={uid:'account',sourceId:'not-found',sourceVersion:0,loader:async()=>{missingReads++;return null;}};
await getOriginal(missing);
await getOriginal(missing);
assert.equal(missingReads,2,'null cannot poison source verification indefinitely');
let failures=0;
try {await getOriginal({uid:'account',sourceId:'offline',sourceVersion:1,loader:async()=>{failures++;throw Error('offline');}});}catch {}
const afterOffline=await getOriginal({uid:'account',sourceId:'offline',sourceVersion:1,loader:async()=>{failures++;return {requestPayload:{directInput:'original text'}};}});
assert.equal(afterOffline.requestPayload.directInput,'original text');
assert.equal(failures,2,'offline is not cached as verified no-command');

console.log('APP454_LEGACY_NEXT_SONG_COMMAND_AND_ID_EXACT_DOCUMENT=PASS');
console.log('APP454_OLD_LOCAL_SONG_AND_AUTO_EMPTY_FIELDS_FILL_KNOWN_COMMAND=PASS');
console.log('APP454_NO_GENERATED_PROMPT_INVENTED=PASS');
