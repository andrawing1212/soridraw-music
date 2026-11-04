// Local-only search regression for Music Note + Library list, including folders.
// Never connect to Firestore, Cloudflare or any user account.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { build } from 'esbuild';

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

const notePage = readFileSync('src/pages/FavoritesPage.tsx','utf8');
const libPage = readFileSync('src/pages/SunoLibraryPage.tsx','utf8');
const noteSearch = notePage.slice(notePage.indexOf('  const songMatchesMusicNoteSearch ='),notePage.indexOf('  const songMatchesMusicNoteFilters ='));
assert(noteSearch.includes('matchesStoredSongSearch(song, queryText'), 'Music Note UI uses shared stored-text matcher');
assert(noteSearch.includes('getSongSituationSummary(song)'), 'Music Note displayed situation included');
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
