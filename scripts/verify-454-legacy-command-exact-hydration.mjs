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
// A confirmed present genre (even when deliberately empty) invalidates old
// customGenreInput from either local cache or historical requestPayload.
const clearedCustomGenre = mergeOnClick(
 {appliedKeywords:{genre:['OLD'],customGenreInput:'OLD_LOCAL_CUSTOM'}},
 {appliedKeywords:{genre:[]},requestPayload:{customGenreInput:'OLD_REQUEST_CUSTOM'}},
);
assert.equal(clearedCustomGenre.genre.length,0);
assert.equal(clearedCustomGenre.customGenreInput,undefined,
 'confirmed empty genre must suppress stale custom field from both old layers');
const changedCustomGenre = mergeOnClick(
 {appliedKeywords:{genre:['OLD'],customGenreInput:'OLD_LOCAL_CUSTOM'}},
 {appliedKeywords:{genre:['CURRENT_GENRE']},requestPayload:{customGenreInput:'OLD_REQUEST_CUSTOM'}},
);
assert.equal(changedCustomGenre.customGenreInput,undefined,
 'changed canonical genre must not inherit custom selection from old layers');
const currentCanonicalCustom = mergeOnClick(
 {appliedKeywords:{genre:['OLD'],customGenreInput:'OLD_LOCAL_CUSTOM'}},
 {appliedKeywords:{genre:[],customGenreInput:'LATEST_ORIGINAL_CUSTOM'}},
);
assert.equal(currentCanonicalCustom.customGenreInput,'LATEST_ORIGINAL_CUSTOM',
 'explicit original custom genre must still be applied');
const clearedPendingCustom = mergeOnClick(
 {appliedKeywords:{genre:['OLD'],customGenreInput:'OLD_LOCAL_CUSTOM'}},
 {appliedKeywords:{genre:['CURRENT'],customGenreInput:'CURRENT_CUSTOM'}},
 {appliedKeywords:{genre:[]}},
);
assert.equal(clearedPendingCustom.customGenreInput,undefined,
 'verified pending genre clear must cancel older original custom input');
const activePendingCustom = mergeOnClick(
 {appliedKeywords:{genre:['OLD'],customGenreInput:'OLD_LOCAL_CUSTOM'}},
 {appliedKeywords:{genre:['CURRENT'],customGenreInput:'CURRENT_CUSTOM'}},
 {appliedKeywords:{genre:[],customGenreInput:'NEW_PENDING_CUSTOM'}},
);
assert.equal(activePendingCustom.customGenreInput,'NEW_PENDING_CUSTOM',
 'verified pending custom input remains authoritative');
// P1: a confirmed tempo clear must cancel old BPM range/random flags from
// both old requestPayload and stale device cache, even with tempo:null intact.
const clearedTempo = mergeOnClick(
 {appliedKeywords:{tempo:'145-155',tempoConfig:{enabled:true,min:145,max:155},
   tempoSource:'manual',isRandomTempo:false}},
 {appliedKeywords:{tempo:null},requestPayload:{
   tempoConfig:{enabled:true,min:145,max:155},tempoSource:'manual',isRandomTempo:false}},
);
assert.equal(clearedTempo.tempo,null);
assert.equal(clearedTempo.tempoConfig,undefined);
assert.equal(clearedTempo.tempoSource,undefined);
assert.equal(clearedTempo.isRandomTempo,undefined);
const pendingTempoClear=mergeOnClick(
 {appliedKeywords:{tempo:'old',tempoConfig:{min:145,max:155,enabled:true}}},
 {appliedKeywords:{tempo:'new',tempoConfig:{min:105,max:115,enabled:true}}},
 {appliedKeywords:{tempo:null}},
);
assert.equal(pendingTempoClear.tempo,null);
assert.equal(pendingTempoClear.tempoConfig,undefined,
 'verified new tempo clear must also remove an older canonical tempoConfig');
const currentTempoConfig=mergeOnClick(
 {appliedKeywords:{tempo:'old',tempoConfig:{min:145,max:155,enabled:true}}},
 {appliedKeywords:{tempo:null,tempoConfig:{min:90,max:110,enabled:false}}},
);
assert.equal(currentTempoConfig.tempoConfig.min,90,
 'an explicitly stored same-original tempoConfig is not an obsolete fallback');
const originalLegacyCommand = {appliedKeywords:{genre:['current'],userInput:''},
 requestPayload:{appliedKeywords:{commandInput:'GENUINE HISTORICAL COMMAND'}}};
assert.equal(mergeOnClick({appliedKeywords:{genre:['stale']}},originalLegacyCommand).userInput,
 'GENUINE HISTORICAL COMMAND');
assert.equal(mergeOnClick({
 appliedKeywords:{genre:['old'],userInput:'OUTDATED LOCAL COMMAND'},
},originalLegacyCommand).userInput,'GENUINE HISTORICAL COMMAND',
 'unverified old cached direct text must not overwrite exact server legacy command');
assert.equal(mergeOnClick({
 appliedKeywords:{genre:['old'],userInput:'',manualCommandClearedAt:100},
},originalLegacyCommand).userInput,'GENUINE HISTORICAL COMMAND',
 'unverified cached clear marker must not erase an exact server stored command');
assert.equal(mergeOnClick({
 appliedKeywords:{genre:['old'],userInput:'OUTDATED LOCAL COMMAND'},
},originalLegacyCommand,{appliedKeywords:{userInput:'NEW DURABLE DRAFT COMMAND'}}).userInput,
 'NEW DURABLE DRAFT COMMAND',
 'verified current user edit still wins over old original');
const oldLocalClear = {
  ...existingFullCard, appliedKeywords: { genre:['indie'], userInput:'', manualCommandClearedAt:123456 },
};
assert.equal(mergeOnClick(oldLocalClear,exactHistoricalDocument).userInput,
 'Recorded original manual command; do not invent.',
 'a local-only deletion marker cannot erase a proven exact original direct command');
const explicitEmpty = mergeOnClick(oldLocalClear,exactHistoricalDocument,{
 appliedKeywords:{userInput:'',manualCommandClearedAt:123457},
});
assert.equal(explicitEmpty.userInput,'',
 'version-compatible durable explicit pending clear must win over original');
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
// Execute the REAL FavoritesPage click consumer, not only the recipe merge.
// The display-genre stub deliberately falls back to prompt text to verify
// exact explicitly cleared genre bypasses that display-only fallback.
const clickStart=favorite.indexOf('  const applyKeywordsToNext = (song: any) => {');
const clickEnd=favorite.indexOf('\n\n  const FAVORITE_MUSIC_API_LANGUAGE_ORDER:',clickStart);
assert.ok(clickStart>=0 && clickEnd>clickStart,'real next-song handler must be extractable');
const realClick=ts.transpileModule(favorite.slice(clickStart,clickEnd),{
 compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS},
}).outputText;
const sent=new Map();
let displayGenreCalls=0;
let navigated='';
const clickContext={
 exports:{},
 onHover(){}, onLongPressEnd(){}, setSelectedSong(){}, setActiveFavoriteMenuId(){},
 document:{activeElement:null}, window:{dispatchEvent(){}},
 CustomEvent:class {constructor(type){this.type=type;}},
 sessionStorage:{setItem:(k,v)=>sent.set(k,v)},
 localStorage:{setItem:(k,v)=>sent.set(k,v)},
 requestAnimationFrame:(fn)=>fn(), navigate:(route)=>{navigated=route;},
 resolveMusicNoteNextSongRecipe:resolve,
 getSongGenreValues:(song)=>{
   displayGenreCalls++;
   return song.appliedKeywords.genre?.length ? song.appliedKeywords.genre : ['INFERRED FROM [Genre] PROMPT'];
 },
 getSongSubGenreValues:(song)=>song.appliedKeywords.subGenre ?? song.appliedKeywords.subGenreIds ?? [],
 getSongMoodValues:(song)=>song.appliedKeywords.mood ?? [],
 getSongThemeValues:(song)=>song.appliedKeywords.theme ?? [],
 getSongSituationSummary:(song)=>song.appliedKeywords.situationSummary ?? '',
 getSongStyleValues:(song)=>song.appliedKeywords.style ?? [],
 getSongInstrumentSoundValues:(song)=>song.appliedKeywords.instrumentSound ?? [],
};
vm.runInNewContext(realClick+'\nexports.applyKeywordsToNext=applyKeywordsToNext;',clickContext);
const clicked=clickContext.exports.applyKeywordsToNext;
const clearedOriginal={
 appliedKeywords:{genre:[],tempo:null,userInput:''},
 requestPayload:{genre:['OLD_REQUEST_GENRE'],tempo:95,commandInput:'REAL LEGACY DIRECT'},
};
clicked({
 prompt:'[Genre] hallucinated genre\\nGenerated prompt',
 requestPayload:clearedOriginal.requestPayload,
 appliedKeywords:mergeOnClick(
  {appliedKeywords:{genre:['OLD_LOCAL_GENRE'],tempo:88,userInput:'OUTDATED COMMAND'}},
  clearedOriginal),
 __musicNoteNextSongOriginalVerified462:true,
});
const passedToStudio=JSON.parse(sent.get('pendingAppliedKeywords'));
assert.equal(passedToStudio.tempo,null,'actual click must keep canonical cleared tempo null');
assert.equal(passedToStudio.genre.length,0,'actual click must not infer prompt genre over cleared original');
assert.equal(passedToStudio.userInput,'REAL LEGACY DIRECT',
 'actual click must apply exact real stored legacy command, not stale local input');
assert.equal(displayGenreCalls,0,'display-only prompt fallback must not run for proven cleared genre');
assert.ok(navigated.startsWith('/studio?applyPending=1'), 'verified next-song action must navigate to Studio');
clicked({
 prompt:'[Genre] another inferred genre',
 appliedKeywords:mergeOnClick(
  {appliedKeywords:{genre:['local stale'],tempo:85}},
  {appliedKeywords:{genre:['CONFIRMED_GENRE'],tempo:123,userInput:'CANONICAL'}},
 ),
 __musicNoteNextSongOriginalVerified462:true,
});
const nonemptyToStudio=JSON.parse(sent.get('pendingAppliedKeywords'));
assert.equal(nonemptyToStudio.genre[0],'CONFIRMED_GENRE');
assert.equal(nonemptyToStudio.tempo,123);
assert.equal(nonemptyToStudio.userInput,'CANONICAL');
assert.equal(displayGenreCalls,1,'normal nonempty genre display normalization remains available');

// Assert the actual Studio genre-restoration branch, not only the outbound
// FavoritesPage handoff: Studio prefers nonempty customGenreInput to genre[].
const studio=fs.readFileSync('src/App.tsx','utf8');
const genreStart=studio.indexOf("    const explicitCustomGenreInput = String((appliedKeywords as any).customGenreInput || '').trim();");
const genreEnd=studio.indexOf('    const rawMoodValues = ',genreStart);
assert.ok(genreStart>=0 && genreEnd>genreStart,
 'real Studio genre restoration must remain extractable');
const restoreGenreJs=ts.transpileModule(
  'const appliedKeywords = rawKeywords;\n'+studio.slice(genreStart,genreEnd),
  {compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}},
).outputText;
const applyToStudioGenre=(rawKeywords)=>{
 let selected;
 const studioCtx={
  rawKeywords, isCustomGenreKeyword:()=>false,
  resolveSelectableGenreId:(v)=>String(v),
  makeCustomKeywordId:(_prefix,value)=>'custom:'+value,
  CUSTOM_GENRE_PREFIX:'custom:',
  limitFusionGenreIds:(ids)=>ids,
  setSelectedGenres:()=>{}, setSubGenre:(ids)=>{selected=Array.from(ids);},
 };
 vm.runInNewContext(restoreGenreJs,studioCtx);
 return selected;
};
clicked({
 prompt:'[Genre] OBSOLETE PROMPT GENRE',
 appliedKeywords:clearedCustomGenre,
 __musicNoteNextSongOriginalVerified462:true,
});
const clearedToStudio=JSON.parse(sent.get('pendingAppliedKeywords'));
assert.equal(clearedToStudio.customGenreInput,undefined,
 'outbound handoff must exclude any obsolete custom input');
assert.deepEqual(applyToStudioGenre(clearedToStudio),[],
 'real Studio must select NO custom genre for server-confirmed empty genre');
clicked({
 appliedKeywords:currentCanonicalCustom,
 __musicNoteNextSongOriginalVerified462:true,
});
assert.deepEqual(applyToStudioGenre(JSON.parse(sent.get('pendingAppliedKeywords'))),
 ['custom:LATEST_ORIGINAL_CUSTOM'],
 'real Studio must retain a current confirmed original custom genre');
clicked({
 appliedKeywords:activePendingCustom,
 __musicNoteNextSongOriginalVerified462:true,
});
assert.deepEqual(applyToStudioGenre(JSON.parse(sent.get('pendingAppliedKeywords'))),
 ['custom:NEW_PENDING_CUSTOM'],
 'real Studio must preserve a verified newly edited custom genre');

// Execute Studio's actual tempo restore decisions, starting from the normal
// clearAll default range (90-110) rather than trusting the recipe in isolation.
const tempoStart=studio.indexOf('    const appliedTempoSource = String((appliedKeywords as any).tempoSource');
const tempoEnd=studio.indexOf('    setIsLyricMode(false);',tempoStart);
assert.ok(tempoStart>=0 && tempoEnd>tempoStart);
const restoreTempoJs=ts.transpileModule('const appliedKeywords = rawKeywords;\n'
 +studio.slice(tempoStart,tempoEnd),{
 compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS},
}).outputText;
const applyToStudioTempo=(rawKeywords)=>{
 const state={enabled:true,min:90,max:110};
 vm.runInNewContext(restoreTempoJs,{
  rawKeywords,
  setTempoEnabled:(v)=>{state.enabled=v;},
  setMinBPM:(v)=>{state.min=v;},
  setMaxBPM:(v)=>{state.max=v;},
 });
 return state;
};
clicked({appliedKeywords:clearedTempo,__musicNoteNextSongOriginalVerified462:true});
const clearedTempoToStudio=JSON.parse(sent.get('pendingAppliedKeywords'));
assert.equal(clearedTempoToStudio.tempo,null);
assert.equal(clearedTempoToStudio.tempoConfig,undefined);
assert.deepEqual(applyToStudioTempo(clearedTempoToStudio),{enabled:true,min:90,max:110},
 'cleared tempo cannot set old 145-155 BPM after Studio initialization');
clicked({appliedKeywords:pendingTempoClear,__musicNoteNextSongOriginalVerified462:true});
assert.deepEqual(applyToStudioTempo(JSON.parse(sent.get('pendingAppliedKeywords'))),
 {enabled:true,min:90,max:110},'verified pending cleared tempo must not restore old BPM');
clicked({appliedKeywords:currentTempoConfig,__musicNoteNextSongOriginalVerified462:true});
assert.deepEqual(applyToStudioTempo(JSON.parse(sent.get('pendingAppliedKeywords'))),
 {enabled:false,min:90,max:110},'trusted same-original tempo configuration is preserved');

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
assert.match(favorite,/void applyStoredRecipeToNext\(song\)/,
 'catalog Apply action must check exact original verification before Studio');
assert.ok(favorite.includes('__musicNoteNextSongOriginalVerified462: true'),
 'only successfully read exact original receives click-only trusted recipe marker');
assert.ok(favorite.includes('const exactRecipeVerified462 = song?.__musicNoteNextSongOriginalVerified462 === true'),
 'final click must not rehydrate confirmed original through loose legacy normalizer');
assert.match(favorite,/void applyStoredRecipeToNext\(selectedSong\)/,
 'modal Apply action must enforce the same exact original guard');
assert.match(favorite,/const pendingDraft = await readMusicNoteDetailDraft\(user\.uid, sourceId\)/);
assert.match(favorite,/originalVersion > 0 && pendingBase > 0 && pendingBase >= originalVersion/,
 'a version-compatible durable draft is required to override original');
assert.match(favorite,/mergeMusicNoteNextSongClickRecipe455\(song, detail, verifiedPendingUpdates\)/);
assert.ok(source.includes('mergeAbsentOnlyClick462(persisted, local)'),
 'confirmed original must outrank older cached genre, tempo and explicit clear');
assert.doesNotMatch(favorite,/getDocs\(collection\(db, 'favorites'/,'no collection scan');
// P2: run the real source hydrator and guarded click wrapper. Simulated
// missing/offline/foreign-owner source must never show a success or navigate.
const hydrateStart=favorite.indexOf('  const hydrateCatalogFavorite = async (song: any, requireStoredRecipe = false): Promise<any> => {');
const wrapStart=favorite.indexOf('  const applyStoredRecipeToNext = async (song: any) => {',hydrateStart);
const wrapEnd=favorite.indexOf('\n\n  const openFavoriteDetail',wrapStart);
assert.ok(hydrateStart>=0 && wrapStart>hydrateStart && wrapEnd>wrapStart,
 'real owned Original hydrator and guarded apply wrapper must remain extractable');
const verifyClickJs=ts.transpileModule(favorite.slice(hydrateStart,wrapEnd)
 + '\nexports.applyStoredRecipeToNext=applyStoredRecipeToNext;',
 {compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
const guardedCalls={applied:[],toasts:[]};
let originalReadMode='offline';
let originalReads=0;
const verifyCtx={
 exports:{},user:{uid:'owner'},isMusicNoteSharedView:false,
 isSharedMusicNoteItem:()=>false,
 getFavoriteDocumentId:(song)=>song?.id||'',
 getMusicNoteDetailSourceVersion:()=>0,
 getOrLoadMusicNoteOriginalRecipe456:async(args)=>args.loader(),
 getOrLoadMusicNoteDetail:async()=>null,
 getDocFromServer:async()=>{
  originalReads++;
  if(originalReadMode==='offline') throw Error('network offline');
  if(originalReadMode==='missing')return {exists:()=>false};
  if(originalReadMode==='foreign')return {exists:()=>true,data:()=>({uid:'other-user',appliedKeywords:{tempo:145}})};
  return {exists:()=>true,data:()=>({uid:'owner',appliedKeywords:{genre:['LATEST'],tempo:null}})};
 },
 doc:(_db,_collection,id)=>id,db:{},
 readMusicNoteDetailDraft:async()=>null,
 mergeMusicNoteNextSongClickRecipe455:mergeOnClick,
 applyKeywordsToNext:(song)=>guardedCalls.applied.push(song),
 showFavoriteToast:(s)=>guardedCalls.toasts.push(s),
 console:{warn:()=>{}},
};
vm.runInNewContext(verifyClickJs,verifyCtx);
const applyOwned=verifyCtx.exports.applyStoredRecipeToNext;
for(const mode of ['offline','missing','foreign']){
 originalReadMode=mode;
 await applyOwned({id:'owned-old',appliedKeywords:{tempo:'145-155'}});
 assert.equal(guardedCalls.applied.length,0,mode+' cannot silently apply stale cache');
 assert.match(guardedCalls.toasts.at(-1),/다시 시도해주세요/,
  mode+' must tell user to retry rather than showing Studio success');
}
originalReadMode='success';
await applyOwned({id:'owned-old',appliedKeywords:{tempo:'145-155'}});
assert.equal(guardedCalls.applied.length,1,'successful exact owned original may apply');
assert.equal(guardedCalls.applied[0].__musicNoteNextSongOriginalVerified462,true);
assert.equal(guardedCalls.applied[0].appliedKeywords.tempo,null);
assert.equal(originalReads,4,'only explicit apply click reads one original per attempt');
verifyCtx.isMusicNoteSharedView=true;
await applyOwned({id:'shared-song',appliedKeywords:{tempo:'100-110'}});
assert.equal(guardedCalls.applied.length,2,'intentional shared-view recipe path remains supported');
assert.equal(originalReads,4,'shared view cannot read another account-owned original');


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
assert.equal(first.requestPayload.commandInput,'persisted old command');
const second=await getOriginal({...originalArgs,loader:async()=>{
 reads++;return {requestPayload:{commandInput:'changed on another device'}};
}});
assert.equal(second.requestPayload.commandInput,'changed on another device');
assert.equal(reads,2,'each sequential explicit click must verify fresh canonical even with unchanged cached card version');
// Legacy versions often never advance the visible cache version.
const originalUnknownVersion={uid:'same-account',sourceId:'historical-song-version-zero',sourceVersion:0};
let unknownReads=0;
const zeroFirst=await getOriginal({...originalUnknownVersion,loader:async()=>{
 unknownReads++;return {appliedKeywords:{genre:['before remote edit']}};
}});
const zeroSecond=await getOriginal({...originalUnknownVersion,loader:async()=>{
 unknownReads++;return {appliedKeywords:{genre:['updated on another device']}};
}});
assert.equal(zeroFirst.appliedKeywords.genre[0],'before remote edit');
assert.equal(zeroSecond.appliedKeywords.genre[0],'updated on another device');
assert.equal(unknownReads,2,'version=0 old local card may not pin an old server original for a session');
// Concurrent explicit clicks share one exact document read and no full scan.
let concurrentReads=0;
let releaseConcurrent;
const waitForServer=new Promise((done)=>{releaseConcurrent=done;});
const concurrency={uid:'same-account',sourceId:'inflight-dedupe',sourceVersion:0};
const concurrentOne=getOriginal({...concurrency,loader:async()=>{
 concurrentReads++;await waitForServer;return {appliedKeywords:{genre:['fresh']}};
}});
const concurrentTwo=getOriginal({...concurrency,loader:async()=>{
 throw Error('concurrent click must share pending read');
}});
releaseConcurrent();
const both=await Promise.all([concurrentOne,concurrentTwo]);
assert.equal(both[0].appliedKeywords.genre[0],'fresh');
assert.equal(both[1].appliedKeywords.genre[0],'fresh');
assert.equal(concurrentReads,1,'concurrent clicks share one bounded exact document read');
await getOriginal({...originalArgs,sourceVersion:1001});
assert.equal(reads,3,'changed sourceVersion remains a separate explicit source read');
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
