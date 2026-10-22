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


// APP453 real-device correction: all new rules must remain result-pane scoped.
const app453Css = css.slice(css.indexOf('APP453_STABLE_MOBILE_COLOR_SPLIT_TOP_CONTROLS'));
assert(app453Css.startsWith('APP453_STABLE_MOBILE_COLOR_SPLIT_TOP_CONTROLS'), 'app453 CSS missing');
for (const token of [
  '@media (min-width: 1100px)', 'width: min(100%, 480px) !important;',
  'grid-template-columns: repeat(3, minmax(0, 1fr)) !important;',
  'min-width: max-content !important;', '.soridraw-color-reset-text',
  '.soridraw-color-reset-icon', 'flex: 1 1 42px !important;',
  'left: 16px !important;', 'top: 7px !important;',
  'pointer-events: auto !important;',
]) assert(app453Css.includes(token), 'app453 missing control token: ' + token);
assert(!app453Css.includes('requestAnimationFrame('), 'app453 must not add drag work');
console.log('APP453_MOBILE_PALETTE_TABS_SEARCH_X=PASS');


// APP454: actual pane-mobile-only overlay with a fixed search layout footprint.
// Only the inner input surface may grow; palette and filter stay untouched.
const app454Css = css.slice(
  css.indexOf('APP454_SPLIT_MOBILE_SEARCH_OVERLAY'),
  css.indexOf('APP455_SPLIT_SEARCH_FILTER_CONTINUOUS_FLEX'),
);
assert(app454Css.startsWith('APP454_SPLIT_MOBILE_SEARCH_OVERLAY'), 'app454 overlay contract missing');
for (const token of [
  '@media (min-width: 1100px)',
  '.soridraw-studio-result-pane',
  '[data-soridraw-responsive-mode="mobile"]',
  'flex: 0 0 42px !important;',
  'width: 42px !important;',
  'height: 46px !important;',
  'position: absolute !important;',
  'width: 260px !important;',
  'z-index: 80 !important;',
  'left: 13px !important;',
  'left: 16px !important;',
  'padding-right: 44px !important;',
  'overflow: visible !important;',
]) assert(app454Css.includes(token), 'app454 missing token: ' + token);
for (const forbidden of ['.soridraw-responsive-color-filter {', '.soridraw-responsive-filter-button {', 'requestAnimationFrame(', 'getBoundingClientRect(', 'ResizeObserver(']) {
  assert(!app454Css.includes(forbidden), 'app454 unexpected non-search change: ' + forbidden);
}
console.log('APP454_MOBILE_SPLIT_SEARCH_OVERLAY_PALETTE_FIXED=PASS');


// APP455 video regression: mobile result row must fill 100% without a trailing
// gap. Search and filter share growth until the filter caps at full width.
const app455Css = css.slice(css.indexOf('APP455_SPLIT_SEARCH_FILTER_CONTINUOUS_FLEX'));
assert(app455Css.startsWith('APP455_SPLIT_SEARCH_FILTER_CONTINUOUS_FLEX'), 'app455 CSS missing');
for (const token of [
  '[data-soridraw-responsive-mode="mobile"]',
  '.soridraw-stable-top-controls',
  'width: 100% !important;',
  'flex: 1 1 42px !important;',
  'max-width: 104px !important;',
  'container-type: inline-size;',
  '@container (min-width: 103px)',
  '.soridraw-filter-label, .soridraw-filter-chevron',
  'width: max(260px, 100%) !important;',
  'overflow: visible !important;',
]) assert(app455Css.includes(token), 'app455 missing contract: ' + token);
for (const forbidden of ['.soridraw-responsive-color-filter {', 'requestAnimationFrame(', 'getBoundingClientRect(', 'ResizeObserver(', 'fetch(']) {
  assert(!app455Css.includes(forbidden), 'app455 must not change colors or drag/server work: ' + forbidden);
}
console.log('APP455_CONTINUOUS_FILTER_CAP_SEARCH_FILLS_NO_GAP=PASS');
