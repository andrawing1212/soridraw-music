import fs from 'node:fs';

const musicNote = fs.readFileSync('src/pages/FavoritesPage.tsx', 'utf8');
const library = fs.readFileSync('src/pages/SunoLibraryPage.tsx', 'utf8');
const css = fs.readFileSync('src/components/studio/studioLayout.css', 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const token of [
  "MUSIC_NOTE_SEARCH_SESSION_KEY",
  "window.sessionStorage.getItem(MUSIC_NOTE_SEARCH_SESSION_KEY)",
  "window.sessionStorage.setItem(MUSIC_NOTE_SEARCH_SESSION_KEY, value)",
  'className="soridraw-responsive-search-clear',
  'aria-label="검색 취소"',
  'musicNoteSearchInputRef.current?.blur()',
  '"is-search-active"',
  '"has-search-value"',
  'soridraw-stable-mode-viewport',
  'soridraw-stable-top-controls',
  '{(isSearchFocused || Boolean(searchQuery)) && (',
]) {
  assert(musicNote.includes(token), `Music Note search token missing: ${token}`);
}

for (const token of [
  "LIBRARY_WORKSPACE_SEARCH_SESSION_KEY",
  "LIBRARY_PLAYLIST_SEARCH_SESSION_KEY",
  "readLibrarySearchSession(LIBRARY_WORKSPACE_SEARCH_SESSION_KEY)",
  "readLibrarySearchSession(LIBRARY_PLAYLIST_SEARCH_SESSION_KEY)",
  'activeSearchTerm',
  'clearActiveLibrarySearch',
  'soridraw-stable-mode-viewport',
  'soridraw-stable-top-controls',
  '{(isLibrarySearchFocused || Boolean(activeSearchTerm)) && (',
  'soridraw-responsive-search-clear',
  'is-search-active',
  'has-search-value',
  'librarySearchInputRef.current?.blur()',
]) {
  assert(library.includes(token), `Library search token missing: ${token}`);
}

for (const token of [
  '/* 1027 — Music Note / Library persistent mobile search.',
  '.soridraw-responsive-search-slot:is(:focus-within, .is-search-active)',
  'flex: 1.6 1 190px !important;',
  'min-width: min(180px, calc(100vw - 150px)) !important;',
  '.soridraw-responsive-search-slot.is-search-active.has-search-value',
  'padding-right: 40px !important;',
]) {
  assert(css.includes(token), `Mobile search CSS token missing: ${token}`);
}

// Search persistence must stay local-only. Do not add any remote query/write path
// just to preserve UI text between page visits.
const searchPersistenceSlices = [
  musicNote.slice(
    musicNote.indexOf("const MUSIC_NOTE_SEARCH_SESSION_KEY"),
    musicNote.indexOf("const mergeMusicNoteSearchSource"),
  ),
  library.slice(
    library.indexOf("const LIBRARY_WORKSPACE_SEARCH_SESSION_KEY"),
    library.indexOf("const SORIDRAW_ADAPTIVE_LIST_INDEX_V2_20260906"),
  ),
].join('\n');
for (const forbidden of ['getDoc(', 'getDocs(', 'setDoc(', 'updateDoc(', 'fetch(']) {
  assert(!searchPersistenceSlices.includes(forbidden), `Search persistence added server I/O: ${forbidden}`);
}

console.log('APP209_MUSIC_NOTE_SEARCH_CLEAR=PASS');
console.log('APP209_LIBRARY_SEARCH_CLEAR=PASS');
console.log('APP209_SEARCH_SESSION_PERSISTENCE=PASS');
console.log('APP209_MOBILE_ACTIVE_WIDTH_PERSISTENCE=PASS');

for (const token of [
  'APP457_FIXED_TABS_COLOR_SEARCH_CONTRACT',
  '.soridraw-stable-mode-viewport',
  'flex: 0 0 480px !important;',
  'width: 480px !important;',
  'flex: 0 1 auto !important;',
  'width: max-content !important;',
  '.soridraw-responsive-search-slot:not(.is-search-active)',
  'flex: 1 1 42px !important;',
  '.soridraw-responsive-search-slot.is-search-active',
  'padding-right: 40px !important;',
]) {
  assert(css.includes(token), `app457 passive split control contract missing: ${token}`);
}
assert(musicNote.includes("setSearchQuery('');"), 'Music Note X clears term');
assert(musicNote.includes('musicNoteSearchInputRef.current?.blur()'), 'Music Note X blurs input');
assert(library.includes('clearActiveLibrarySearch();'), 'Library X clears term');
assert(library.includes('librarySearchInputRef.current?.blur()'), 'Library X blurs input');

console.log('APP209_SEARCH_NO_SERVER_IO=PASS');
console.log('APP457_MUSIC_NOTE_LIBRARY_FIXED_MENU_COLOR_SEARCH_X=PASS');
