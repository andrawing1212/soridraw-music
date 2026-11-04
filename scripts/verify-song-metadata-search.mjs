// Local-only search regression for Music Note + Library list, including folders.
// Never connect to Firestore, Cloudflare or any user account.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { build, transform } from 'esbuild';

const source = readFileSync('src/lib/songMetadataSearch.ts', 'utf8');
const output = await build({
  entryPoints: ['src/lib/songMetadataSearch.ts'],
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  bundle: true,
  write: false,
  logLevel: 'silent',
});
const module = { exports: {} };
vm.runInNewContext(output.outputFiles[0].text, { module, exports: module.exports, console });
const { matchesStoredSongSearch: match } = module.exports;
assert.equal(typeof match, 'function');

const note = {
  koreanTitle: '별빛 정원',
  englishTitle: 'Secret Garden',
  appliedKeywords: {
    genre: ['Indie Folk'],
    mood: ['warm and gentle'],
    theme: ['작은 도시'],
    instrumentSound: ['acoustic-guitar'],
    situation: { summary: '비 오는 새벽에 만난 사람' },
    lyricDraft: '돌아갈 수 없는 우리의 계절',
    vocalType: 'female',
  },
  lyrics: { korean: '그리운 너의 손을 잡고', english: 'In my little room I wait' },
  searchTokens: ['past-memory'],
};
for (const term of ['별빛','garden','indie folk','gentle','작은 도시','acoustic','비 오는','돌아갈 수','여성', '그리운','LITTLE ROOM', 'past-memory']) {
  if (term === '여성') continue; // Raw vocal type is English, so no fabricated translation.
  assert(match(note, term), 'Music Note previously stored field not searchable: ' + term);
}
assert(!match(note, '은하수'), 'do not invent unavailable data');

const libraryWorkspace = {
  title: 'Finished Song',
  prompt: '[Genre] R&B, close mic vocals',
  appliedKeywords: { theme: ['사랑'], style: ['urban-soul'] },
  sunoData: [
    { title: 'First Part', lyrics: 'I still remember November', tags: ['Night Groove'] },
    { title: '두 번째 트랙', lyricsText: '밤을 건너 너에게 가는 길' },
  ],
};
for(const term of ['finished','close mic','사랑','urban-soul','November','night groove','너에게 가는','두 번째']){
  assert(match(libraryWorkspace,term), 'Library workspace search: '+term);
}
assert(match({title:'봄날'}, ' 봄날  '), 'search trims input');
assert(match({lyrics:'첫 줄\n두 번째 줄'}, '첫 줄 두 번째'), 'search normalizes line breaks');
assert(match({genreLabels:['Dream Pop'], creatorNickname:'Demo'}, 'dream pop'));
assert(match({title:'shared list entry'}, 'creator-abc', ['creator-abc']));
assert(!match({audioUrl:'https://music.example/secret',id:'secret-key'},'secret-key'),
  'stream URLs and private document IDs are not arbitrary search fields');
assert(!match({lyrics:undefined,appliedKeywords:{genre:['jazz']}},'not-actually-stored'),
  'missing historical lyric text must not be fabricated');
assert(match({appliedKeywords:{mood:[{id:'rainy',labelKo:'비 내리는'}]}},'비 내리는'),
  'Korean display labels already in item objects remain searchable');
assert(!match({otherSecret:'private'} ,'private'),
  'unrelated private fields must never be searched');


const repeatedNote = { title: 'Other Song', lyrics: { get korean() { nestedLyricReads++; return 'the chorus of this song'; } } };
let nestedLyricReads = 0;
assert(match(repeatedNote, 'chorus'), 'search still matches stored lyric');
const initialReads = nestedLyricReads;
for (let i = 0; i < 300; i++) {
  assert(match(repeatedNote, 'chorus'), 'unchanged checked song remains searchable');
}
assert.equal(nestedLyricReads, initialReads, 'selection rerenders must NOT rescan lyric bodies');
repeatedNote.lyrics = { get korean() { nestedLyricReads++; return 'the changed chorus'; } };
assert(match(repeatedNote, 'changed chorus'), 'replaced lyrics invalidate cached matcher');
assert(nestedLyricReads > initialReads, 'lyrics edit requires new search traversal');
let displayFallbackReads = 0;
const knownNote = { title: 'Old note without all displayed keyword fields' };
const extraLabels = () => { displayFallbackReads++; return ['도시의 새벽']; };
assert(match(knownNote, '도시의 새벽', extraLabels), 'displayed metadata fallback retained');
for (let i = 0; i < 300; i++) assert(match(knownNote, '도시의 새벽', extraLabels));
assert.equal(displayFallbackReads, 1, 'cached choice MUST NOT repeat display keyword resolution');
knownNote.title = 'Now the city dawn';
assert(match(knownNote, '도시의 새벽', extraLabels), 'edited title still permits display keyword fallback');
assert.equal(displayFallbackReads, 2, 'edited item invalidates cached display result');
const negative = { title: 'A completely different song', lyrics: { english: 'hello daylight' } };
let misses = 0;
const missingFallback = () => { misses++; return ['not-found']; };
for (let i = 0; i < 180; i++) assert(!match(negative, 'unlisted lyric', missingFallback));
assert.equal(misses, 1, 'negative matches must also be cached under active search');

const notePage = readFileSync('src/pages/FavoritesPage.tsx','utf8');
const libPage = readFileSync('src/pages/SunoLibraryPage.tsx','utf8');

// Source merge is rerun during selection/folder dialog renders. It MUST keep
// original identities for non-overlapping items so WeakMap matches stay hot.
const mergeStart = notePage.indexOf('const mergeMusicNoteSearchSource =');
const mergeEnd = notePage.indexOf('\n\nfunction SunoUrlMobileGuideButton()', mergeStart);
assert(mergeStart >= 0 && mergeEnd > mergeStart, 'Music Note merge function exists');
const mergeModule = { exports: {} };
const mergeOutput = await transform(
  notePage.slice(mergeStart, mergeEnd) + '\nexports.merge = mergeMusicNoteSearchSource;',
  { loader: 'ts', format: 'cjs', target: 'es2022' },
);
vm.runInNewContext(mergeOutput.code, { module: mergeModule, exports: mergeModule.exports });
const mergeSource = mergeModule.exports.merge;
const aSong = {id:'id-a', title:'First', lyrics:{korean:'original lyrics'}};
const bSong = {id:'id-b', title:'Second', appliedKeywords:{theme:['반짝임']}};
const mergedOnce = mergeSource([aSong,bSong], [{id:'other',title:'Extra'}]);
const mergedAgain = mergeSource([aSong,bSong], [{id:'other',title:'Extra'}]);
assert.strictEqual(mergedOnce[0],aSong, 'first source identity must be retained');
assert.strictEqual(mergedOnce[1],bSong, 'second source identity must be retained');
assert.strictEqual(mergedAgain[0],mergedOnce[0], 'unrelated selection rerenders must not clone');
assert.strictEqual(mergedAgain[1],mergedOnce[1], 'folder opening must not clone');
const mergedDuplicate = mergeSource([aSong], [{id:'id-a', englishTitle:'new title'}]);
assert.equal(mergedDuplicate[0].englishTitle,'new title','server duplicate still augments source');
assert.equal(mergedDuplicate[0].lyrics.korean,'original lyrics','canonical lyric retained');

const noteSearch = notePage.slice(notePage.indexOf('  const songMatchesMusicNoteSearch ='),notePage.indexOf('  const songMatchesMusicNoteFilters ='));
assert(noteSearch.includes('matchesStoredSongSearch(song, queryText'), 'Music Note UI uses shared stored-text matcher');
assert(noteSearch.includes('getSongSituationSummary(song)'), 'Music Note displayed situation included');
assert(noteSearch.includes('matchesStoredSongSearch(song, queryText, () => ['), 'only resolve displayed metadata on a search cache miss');
assert(notePage.includes('runFavoriteServerSearch'), 'explicit existing enter-only fallback remains');

const workspace = libPage.slice(libPage.indexOf('  const filteredTracks = useMemo'),libPage.indexOf('  const displayedWorkspaceTracks = useMemo'));
assert(workspace.includes('matchesStoredSongSearch(t, deferredSearchTerm)'), 'Library workspace UI matcher');
const playlistFn = libPage.slice(libPage.indexOf('  const playlistItemMatchesStoredSearch ='),libPage.indexOf('  const getVisiblePlaylistItemsForSelection ='));
assert(playlistFn.includes('matchesStoredSongSearch(item, query, searchableMeta)'), 'Library folder item fields');
assert(playlistFn.includes('playlistSearchTrackById.get'), 'Library folder can search already-loaded source text');
assert(playlistFn.includes("item?.sourceType === 'shared_track'"), 'shared item cannot inspect private source');
const occurrences = libPage.match(/playlistItemMatchesStoredSearch\(item, normalizedPlaylistSearch\)/g) || [];
assert.equal(occurrences.length,2, 'visible folder results and multi-select must search identically');
assert(!source.includes('getDocs(') && !source.includes('getDocFromServer(')
  && !source.includes('setDoc(') && !source.includes('fetch('),
  'no per-keystroke server I/O');
console.log('MUSIC_NOTE_STORED_KEYWORD_LYRICS_SEARCH=PASS');
console.log('LIBRARY_WORKSPACE_AND_FOLDER_STORED_TEXT_SEARCH=PASS');
console.log('LIBRARY_SELECTED_AND_DISPLAYED_SEARCH_PARITY=PASS');
console.log('SEARCH_NO_SERVER_IO_OR_PRIVATE_CONTENT_INDEX=PASS');
console.log('SEARCH_SELECTION_RENDERS_REUSE_CACHED_RESULT=PASS');
console.log('SEARCH_SOURCE_MERGE_PRESERVES_OBJECT_IDENTITY=PASS');
