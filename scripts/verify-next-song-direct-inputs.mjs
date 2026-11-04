import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transform} from 'esbuild';

const helper=readFileSync('src/lib/musicNoteNextSongRecipe.ts','utf8');
const {code}=await transform(helper,{loader:'ts',format:'esm',target:'es2022'});
const {resolveMusicNoteNextSongRecipe:resolve,
  mergeMusicNoteNextSongClickRecipe455:merge,
  resolveStoredAuthoredLyricDraft:authored}=await import(
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
const lib=readFileSync('src/pages/SunoLibraryPage.tsx','utf8');
const note=readFileSync('src/pages/FavoritesPage.tsx','utf8');
const app=readFileSync('src/App.tsx','utf8');
const player=readFileSync('src/components/GlobalPlayer.tsx','utf8');
const libraryApply=lib.slice(lib.indexOf('  const handleApplyNext = async (group: any, item: any) => {'),
                             lib.indexOf('  const getPlaylistSaveIsShared ='));
assert.match(libraryApply,/getDocFromServer\(doc\(db, 'suno_tracks', activeUid, 'tracks', sourceTrackId\)\)/);
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
assert.doesNotMatch(helper,/source\?\.prompt|source\?\.lyricsText|source\?\.generatedLyrics/);
console.log('NEXT_SONG_OLD_MENU_AND_COMMAND_FIELDS=PASS');
console.log('NEXT_SONG_ONLY_ORIGINAL_AUTHORED_LYRICS_DRAFT=PASS');
console.log('NEXT_SONG_ONE_EXPLICIT_ORIGINAL_READ_NO_BACKGROUND_SCANS=PASS');
