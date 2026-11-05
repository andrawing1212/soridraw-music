import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transform} from 'esbuild';

const helper=readFileSync('src/lib/musicNoteNextSongRecipe.ts','utf8');
const {code}=await transform(helper,{loader:'ts',format:'esm',target:'es2022'});
const {resolveMusicNoteNextSongRecipe:resolve,
  mergeMusicNoteNextSongClickRecipe455:merge,
  resolveStoredAuthoredLyricDraft:authored,
  recoverLinkedSunoOriginalDirectInputs:recoverLinked}=await import(
    'data:text/javascript;base64,'+Buffer.from(code).toString('base64')
  );
const legacy=resolve({
  appliedKeywords:{genre:['indie-folk'],userInput:''},
  requestPayload:{
    appliedKeywords:{userInput:'MY ORIGINAL COMMAND',customStyleInput:'my brushed drums',
      lyricDraft:'MY OWN ORIGINAL VERSE',isLyricMode:true,lyricMode:'preserve'},
    moods:['warm'],themes:['rain'],styles:['acoustic pop'],
    instrumentSounds:['vintage guitar'],
  },
  prompt:'AI GENERATED PROMPT NEVER USER INPUT',
  lyrics:'GENERATED FINAL LYRICS NEVER DIRECT DRAFT',
});
assert.equal(legacy.userInput,'MY ORIGINAL COMMAND');
assert.equal(legacy.customStyleInput,'my brushed drums');
assert.deepEqual(legacy.mood,['warm']);
assert.deepEqual(legacy.theme,['rain']);
assert.deepEqual(legacy.style,['acoustic pop']);
assert.deepEqual(legacy.instrumentSound,['vintage guitar']);
assert.deepEqual(authored(legacy),{
  lyricDraft:'MY OWN ORIGINAL VERSE',isLyricMode:true,lyricMode:'preserve'
});
const noInput=resolve({
  appliedKeywords:{genre:['folk']},prompt:'GENERATED PROMPT',
  lyrics:'FINISHED AI LYRICS',lyricsText:'FINISHED AI LYRICS'
});
assert.equal(noInput.userInput,undefined);
assert.deepEqual(authored(noInput),{lyricDraft:'',isLyricMode:false,lyricMode:'assist'});
assert.deepEqual(authored({lyricDraft:'old draft',isLyricMode:false}),
  {lyricDraft:'',isLyricMode:false,lyricMode:'assist'});
assert.equal(authored({lyricDraft:'older manual draft'}).isLyricMode,true);
assert.deepEqual(resolve({requestPayload:{genre:'dream pop',styles:'airbrush guitar'}}).genre,['dream pop']);
const click=merge(
  {appliedKeywords:{userInput:'STALE LOCAL COMMAND',customGenreInput:'stale custom genre'}},
  {appliedKeywords:{genre:[],userInput:'',manualCommandCleared:true},
    requestPayload:{userInput:'OLD REQUEST COMMAND'}}
);
assert.deepEqual(click.genre,[],'explicit current cleared genre stays cleared');
assert.equal(click.userInput,'','explicit current command clear beats older command');
assert.equal(click.customGenreInput,undefined,'cleared genre does not resurrect stale custom genre');
const older=merge(
  {appliedKeywords:{userInput:''}},
  {appliedKeywords:{genre:['indie'],userInput:''},
    requestPayload:{commandInput:'EXACT OLD DIRECT COMMAND'}}
);
assert.equal(older.userInput,'EXACT OLD DIRECT COMMAND');

const aprilFavorite={
  uid:'own',taskId:'task-2026-04',sourceTrackId:'exact-own-track',
  appliedKeywords:{genre:['Dance'],userInput:''},
  prompt:'AI GENERATED PROMPT MUST NOT BECOME COMMAND'
};
const aprilSuno={
  taskId:'task-2026-04',
  requestPayload:{appliedKeywords:{
    userInput:'EXACT APRIL USER COMMAND',lyricDraft:'MY OLD LYRIC DRAFT',
    isLyricMode:true,lyricMode:'preserve',
  }},
  lyrics:'GENERATED FINAL LYRICS',
};
const restoredApril=recoverLinked(aprilFavorite,aprilSuno,
  resolve(aprilFavorite));
assert.equal(restoredApril.userInput,'EXACT APRIL USER COMMAND');
assert.deepEqual(authored(restoredApril),{
  lyricDraft:'MY OLD LYRIC DRAFT',isLyricMode:true,lyricMode:'preserve'
});
assert.equal(recoverLinked(aprilFavorite,
  {...aprilSuno,taskId:'other-song'},resolve(aprilFavorite)).userInput,'',
  'mismatched task cannot supply another song command');
assert.equal(recoverLinked({...aprilFavorite,appliedKeywords:{
  userInput:'',manualCommandCleared:true}},aprilSuno,
  {userInput:''}).userInput,'','explicit canonical clear wins');
assert.equal(recoverLinked(aprilFavorite,aprilSuno,{userInput:''},
  {appliedKeywords:{userInput:''}}).userInput,'',
  'newer verified pending blank must not be replaced');
assert.equal(recoverLinked({...aprilFavorite,appliedKeywords:{
  userInput:'',isLyricMode:false}},aprilSuno,resolve(aprilFavorite)).lyricDraft,
  undefined,'explicit lyrics off cannot be revived');
assert.equal(recoverLinked(aprilFavorite,{prompt:'GENERATED',lyrics:'GENERATED'},
  resolve(aprilFavorite)).userInput,'',
  'never infer original direct input from rendered output');

const lib=readFileSync('src/pages/SunoLibraryPage.tsx','utf8');
const note=readFileSync('src/pages/FavoritesPage.tsx','utf8');
const app=readFileSync('src/App.tsx','utf8');
const player=readFileSync('src/components/GlobalPlayer.tsx','utf8');
const libraryApply=lib.slice(lib.indexOf('  const handleApplyNext = async (group: any, item: any) => {'),
                             lib.indexOf('  const getPlaylistSaveIsShared ='));
assert.equal((libraryApply.match(/getDocFromServer\(doc\(db, 'suno_tracks', activeUid, 'tracks', sourceTrackId\)\)/g) || []).length, 2,
 'Library exact owned source is read once, with at most one transient retry');
assert.match(libraryApply,/\['unavailable', 'deadline-exceeded', 'network-request-failed'\]\.includes\(code\)/,
 'Library only retries transient exact-source failures');
assert.match(libraryApply,/mergeMusicNoteNextSongClickRecipe455\(clickedSource, fullTrack\)/);
assert.match(libraryApply,/const serialized = JSON.stringify\(appliedKeywords\)/);
assert.match(libraryApply,/stageNextSongKeywords\(serialized\)/);
assert.ok(libraryApply.indexOf('getDocFromServer')<libraryApply.indexOf('stageNextSongKeywords'));
assert.match(player,/getDocFromServer\(doc\(db, 'suno_tracks', currentUser.uid, 'tracks', sourceTrackId\)\)/);
assert.match(player,/mergeMusicNoteNextSongClickRecipe455\(clickedSource, original\)/);
assert.match(note,/const authoredLyrics = resolveStoredAuthoredLyricDraft\(resolvedRecipe\)/);
assert.match(note,/lyricDraft: authoredLyrics.lyricDraft/);
assert.match(app,/const authoredLyrics = resolveStoredAuthoredLyricDraft\(appliedKeywords as any\)/);
assert.match(app,/setLyricDraft\(authoredLyrics.lyricDraft\)/);
assert.match(app,/setIsLyricMode\(authoredLyrics.isLyricMode\)/);
assert.match(app,/legacyGenreCustom/);
assert.match(app,/legacyCustomStyle/);
assert.match(app,/legacyCustomSound/);
assert.ok(note.includes("doc(db, 'suno_tracks', user.uid, 'tracks', linkedTrackId)"));
assert.ok(note.includes('recoverLinkedSunoOriginalDirectInputs('));
assert.ok(note.includes('if (needsOriginalText && !isSharedMusicNoteItem(song)'));
assert.doesNotMatch(helper,/source\?\.prompt|source\?\.lyricsText|source\?\.generatedLyrics/);
console.log('NEXT_SONG_OLD_MENU_AND_COMMAND_FIELDS=PASS');
console.log('NEXT_SONG_ONLY_ORIGINAL_AUTHORED_LYRICS_DRAFT=PASS');
console.log('NEXT_SONG_ONE_EXPLICIT_ORIGINAL_READ_NO_BACKGROUND_SCANS=PASS');
console.log('NEXT_SONG_APRIL_EXACT_LINKED_SUNO_ORIGINAL_SAFETY=PASS');

const ownedSourceLink = readFileSync('src/lib/musicNoteFavoriteSourceLink.ts', 'utf8');
const ownedSourceLinkJs = (await transform(ownedSourceLink, {
  loader: 'ts', format: 'esm', target: 'es2022',
})).code;
const { pickOwnedSunoOriginalLinkForFavorite: sourceLink } = await import(
  'data:text/javascript;base64,' + Buffer.from(ownedSourceLinkJs).toString('base64')
);
assert.deepEqual(sourceLink(
  {sourceType:'suno_track',sourceId:'own_Suno_123',ownerUid:'account-a',taskId:'task_A'},
  'account-a',
), {sourceTrackId:'own_Suno_123',sourceTaskId:'task_A'},
 'new owned Library source must retain canonical source and task identity');
assert.deepEqual(sourceLink(
  {sourceTrackId:'exactOwnSuno123',sourceTaskId:'task_B',uid:'account-a'},
  'account-a',
), {sourceTrackId:'exactOwnSuno123',sourceTaskId:'task_B'});
assert.deepEqual(sourceLink({sourceType:'suno-api',trackId:'sunoRef001'},'account-a'),
  {sourceTrackId:'sunoRef001'});
for (const unsafe of [
  {id:'favorite-1',taskId:'task1',title:'a',sourceId:'maybe-a-song'},
  {sourceType:'shared_track',sourceTrackId:'foreignRef'},
  {sourceType:'suno_track',sourceId:'foreignRef',ownerUid:'account-b'},
  {sourceTrackId:'foreignRef',uid:'account-b'},
  {sourceTrackId:'bad/path'},
  {sourceTrackId:'staleRef',sourceId:'differentRef',sourceType:'suno_track'},
  {sourceTrackId:'oldRef',recentFavoriteDetachedAt:1},
  {sourceTrackId:'oldRef',appliedKeywords:{editedInStudio:true}},
  {sourceTrackId:'oldRef',sourceTaskId:'task-A',taskId:'task-B'},
]) {
  assert.deepEqual(sourceLink(unsafe,'account-a'),{},
    'ambiguous, shared or edited song must never invent an owned Suno link');
}
assert.deepEqual(sourceLink({sourceTrackId:'exactOwnSuno123'},''),{});
const favoritePayloadStart = app.indexOf('const favoritePayload = sanitizeForFirestore({');
const favoritePayloadEnd = app.indexOf('const deterministicRecentIdentity =', favoritePayloadStart);
assert.ok(favoritePayloadStart >= 0 && favoritePayloadEnd > favoritePayloadStart);
const favoritePayloadCode = app.slice(favoritePayloadStart, favoritePayloadEnd);
assert.match(favoritePayloadCode,/\.\.\.pickOwnedSunoOriginalLinkForFavorite\(song, user\.uid\)/,
  'link fields are carried in the existing new-favorite canonical W1, not a second write');
assert.doesNotMatch(favoritePayloadCode,/getDoc\(|getDocs\(|getDocFromServer\(/,
  'preserving an already-known identity must not add a per-save source read');
assert.match(note,/doc\(db, 'suno_tracks', user.uid, 'tracks', linkedTrackId\)/,
  'Next Song must validate the saved exact same-user link');
console.log('NEW_MUSIC_NOTE_KNOWN_OWNED_SUNO_LINK_W1_R0=PASS');
