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

const historicalAutoEmptyOriginal = {
  ...exactHistoricalDocument,
  appliedKeywords:{genre:['indie'],userInput:''},
  userInput:'',
};
assert.equal(resolve(historicalAutoEmptyOriginal).userInput,
 'Recorded original manual command; do not invent.',
 'even the original favorite may include default empty userInput while storing a real old direct command');
assert.equal(mergeOnClick({
  ...existingFullCard,
  appliedKeywords:{genre:['indie'],userInput:''},
  userInput:'',
},historicalAutoEmptyOriginal).userInput,
 'Recorded original manual command; do not invent.',
 'two automatic blank layers may not shadow a historical original direct command');
assert.equal(mergeOnClick({
 ...existingFullCard,appliedKeywords:{genre:['indie'],userInput:'RECENT NEW COMMAND'},
}, {requestPayload:{appliedKeywords:{commandInput:'OLD COMMAND',manualCommandClearedAt:100}}}).userInput,
 'RECENT NEW COMMAND','a newer real command outranks an older clear record');
assert.equal(resolve({appliedKeywords:{userInput:'NEW'},requestPayload:{manualCommandClearedAt:100}}).userInput,
 'NEW','a lower-precedence clear must not erase a newer nonempty direct command');

// A genuinely newer canonical command must not be cleared by a lower-priority
// old requestPayload deletion record when the clicked local card has no text.
const canonicalWinsOlderClear = mergeOnClick(
  {id:'old-one', appliedKeywords:{genre:['indie']}},
  {appliedKeywords:{genre:['indie'], userInput:'LATEST REAL COMMAND'},
    requestPayload:{commandInput:'OLD COMMAND',manualCommandClearedAt:100}},
);
assert.equal(canonicalWinsOlderClear.userInput,'LATEST REAL COMMAND',
 'click merge must preserve new canonical command above old requestPayload clear');
const verifiedOriginalClear = mergeOnClick(
  {id:'old-one',appliedKeywords:{genre:['indie']}},
  {appliedKeywords:{userInput:'',manualCommandClearedAt:300},requestPayload:{commandInput:'OLD COMMAND'}},
);
assert.equal(verifiedOriginalClear.userInput,'',
 'verified newest original clear must still beat the old stored command');

// A server-verified original wins over stale local card settings, except for
// a durable explicitly compatible pending edit.
const staleLocal = {appliedKeywords:{
 genre:['STALE'],subGenre:['OLD_SUB'],tempo:85,vocalType:'male',
 userInput:'OLD_CACHED_COMMAND',mood:['old-mood'],
}};
const canonicalLatest = {appliedKeywords:{
 genre:['CURRENT'],subGenre:['CURRENT_SUB'],tempo:123,vocalType:'female',
 userInput:'CURRENT_COMMAND',mood:['new-mood'],
}};
const correct = mergeOnClick(staleLocal,canonicalLatest);
assert.equal(correct.genre[0],'CURRENT');
assert.equal(correct.subGenre[0],'CURRENT_SUB');
assert.equal(correct.tempo,123);
assert.equal(correct.vocalType,'female');
assert.equal(correct.userInput,'CURRENT_COMMAND');
assert.equal(correct.mood[0],'new-mood');
const pendingCorrect = mergeOnClick(staleLocal,canonicalLatest,{
 appliedKeywords:{genre:['PENDING_NEW'],tempo:140,userInput:'PENDING_COMMAND'},
});
assert.equal(pendingCorrect.genre[0],'PENDING_NEW');
assert.equal(pendingCorrect.tempo,140);
assert.equal(pendingCorrect.vocalType,'female');
assert.equal(pendingCorrect.userInput,'PENDING_COMMAND');
assert.equal(mergeOnClick(staleLocal,canonicalLatest,{
 appliedKeywords:{userInput:''},
}).userInput,'CURRENT_COMMAND','default empty pending field cannot erase genuine stored command');
const explicitServerEmpty = mergeOnClick(
 {appliedKeywords:{tempo:130,genre:['old']}},
 {appliedKeywords:{tempo:null,genre:[]},requestPayload:{tempo:95,genre:['older-request']}},
);
assert.equal(explicitServerEmpty.tempo,null,'null is a deliberate canonical clear');
assert.equal(explicitServerEmpty.genre.length,0,'empty canonical array must not restore stale genre');
const staleGenreSub = mergeOnClick(
 {appliedKeywords:{genre:['OLD_GENRE'],subGenre:['OLD_CACHED_SUB']}},
 {appliedKeywords:{genre:['CURRENT_GENRE']},requestPayload:{subGenre:['OLD_REQUEST_SUB']}},
);
assert.equal(staleGenreSub.genre[0],'CURRENT_GENRE');
assert.equal(staleGenreSub.subGenre,undefined,
 'new canonical genre cannot be replaced on display by old request/local subgenre');
const pendingChangedGenre = mergeOnClick(
 {appliedKeywords:{genre:['old'],subGenre:['old sub']}},
 {appliedKeywords:{genre:['confirmed'],subGenre:['confirmed sub']}},
 {appliedKeywords:{genre:['pending latest']}},
);
assert.equal(pendingChangedGenre.subGenre,undefined,
 'newer verified pending genre must not inherit obsolete canonical subgenre');
assert.equal(mergeOnClick(
 {appliedKeywords:{genre:['old'],instrumentSound:['legacy-only']}},
 {appliedKeywords:{genre:['current']}},
).instrumentSound[0],'legacy-only','only truly absent old fields may fill historical gaps');
const originalLegacyCommand = {appliedKeywords:{genre:['current'],userInput:''},
 requestPayload:{appliedKeywords:{commandInput:'GENUINE HISTORICAL COMMAND'}}};
assert.equal(mergeOnClick({appliedKeywords:{genre:['stale']}},originalLegacyCommand).userInput,
 'GENUINE HISTORICAL COMMAND');
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
assert.match(favorite,/if \(requireStoredRecipe\) \{[\s\S]{0,2300}mergeMusicNoteNextSongClickRecipe455\(song, detail, verifiedPendingUpdates\)/,
 'click-only exact original must pass a version-verified local pending draft');
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
assert.match(favorite,/const pendingDraft = await readMusicNoteDetailDraft\(user\.uid, sourceId\)/);
assert.match(favorite,/originalVersion > 0 && pendingBase > 0 && pendingBase >= originalVersion/,
 'a version-compatible durable draft is required to override original');
assert.match(favorite,/mergeMusicNoteNextSongClickRecipe455\(song, detail, verifiedPendingUpdates\)/);
assert.ok(source.includes('mergeAbsentOnlyClick462(persisted, local)'),
 'confirmed original must outrank older cached genre, tempo and explicit clear');
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
