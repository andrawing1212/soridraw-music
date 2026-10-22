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
const app455Css = css.slice(
  css.indexOf('APP455_SPLIT_SEARCH_FILTER_CONTINUOUS_FLEX'),
  css.indexOf('APP456_CENTERED_SEARCH_CONTINUOUS_RESET'),
);
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


// APP456: exact split-only layout contract, with the old app455 rules frozen
// independently. Runtime/browser geometry is verified separately.
const app456Css = css.slice(
  css.indexOf('APP456_CENTERED_SEARCH_CONTINUOUS_RESET'),
  css.indexOf('APP457_NO_MOBILE_TABLET_CONTROL_HANDOFF'),
);
assert(app456Css.startsWith('APP456_CENTERED_SEARCH_CONTINUOUS_RESET'), 'app456 CSS missing');
for (const token of [
  '@media (min-width: 1100px)',
  '.soridraw-studio-result-pane',
  'container-type: inline-size;',
  'width: clamp(34px, calc(33.333cqi - 95.333px), 52px) !important;',
  'max-width: 52px !important;',
  '.soridraw-color-reset-text',
  'display: none !important;',
  '.soridraw-color-reset-icon',
  '[data-soridraw-responsive-mode="mobile"]',
  '.soridraw-responsive-search-slot:not(:focus-within):not(.is-search-active)',
  'min(16px, calc(50cqi - 8px))',
  'max(0px, 100cqi - 104px)',
]) assert(app456Css.includes(token), 'app456 required rule missing: ' + token);
for (const forbidden of [
  '.soridraw-responsive-color-filter {',
  '.soridraw-responsive-filter-button {',
  'requestAnimationFrame(', 'getBoundingClientRect(', 'ResizeObserver(', 'fetch('
]) assert(!app456Css.includes(forbidden), 'app456 must not change palette/filter/drag/backend: ' + forbidden);
console.log('APP456_SEARCH_CENTER_TO_LEFT_AND_RESET_SMOOTH_GROWTH=PASS');


// APP457: no geometry/placeholder/filter ownership switch when responsive
// content mode moves from mobile to tablet; keep old 456 source assertions.
const app457Css = css.slice(
  css.indexOf('APP457_NO_MOBILE_TABLET_CONTROL_HANDOFF'),
  css.indexOf('APP458_CANONICAL_COMPACT_TOP_CONTROLS_ALL_SHELLS'),
);
assert(app457Css.startsWith('APP457_NO_MOBILE_TABLET_CONTROL_HANDOFF'), 'app457 CSS missing');
for (const token of [
  '.soridraw-stable-top-controls',
  '.soridraw-responsive-search-slot:is(:focus-within, .is-search-active)',
  'container-type: inline-size;',
  'flex: 1 1 42px !important;',
  'max-width: 104px !important;',
  'width: max(260px, 100%) !important;',
  '.soridraw-responsive-search-placeholder',
  'opacity: 0 !important;',
  '@container (min-width: 200px)',
  'opacity: 1 !important;',
  '@container (min-width: 103px)',
  'calc(50cqi - 8px - max(0px, 100cqi - 104px))',
]) assert(app457Css.includes(token), 'app457 missing stable property: '+token);
assert(!app457Css.includes('[data-soridraw-responsive-mode="mobile"]'), 'app457 cannot re-add mobile/tablet rule split');
for(const forbidden of ['requestAnimationFrame(', 'getBoundingClientRect(', 'ResizeObserver(', 'fetch(']){
  assert(!app457Css.includes(forbidden), 'app457 must be passive CSS: '+forbidden);
}
console.log('APP457_CROSS_MODE_ROW_PLACEHOLDER_PARITY=PASS');


// APP458: the accepted split-result compact top-row contract is reused by
// both external mobile-window and real phone standalone modes, regardless
// of dark/Studio theme. It adds NO new render loop, API, or split handler.
const app458Css=css.slice(
  css.indexOf('APP458_CANONICAL_COMPACT_TOP_CONTROLS_ALL_SHELLS'),
  css.indexOf('APP459_COMPACT_ROW_FIT_WITHOUT_COLLISION'),
);
assert(app458Css.startsWith('APP458_CANONICAL_COMPACT_TOP_CONTROLS_ALL_SHELLS'),'app458 compact UI missing');
for(const token of [
  '@media (max-width: 1099px)',
  '[data-soridraw-responsive-mode="mobile"]',
  '.soridraw-stable-top-controls',
  'flex: 1 1 42px !important;',
  'width: max(260px, 100%) !important;',
  'min-width: max-content !important;',
  '.soridraw-responsive-color-filter > button:not(.soridraw-color-reset-button)',
  'grid-template-columns: repeat(3, minmax(0, 1fr)) !important;',
  '.soridraw-filter-label, .soridraw-filter-chevron',
  'max-width: 104px !important;',
  '@container (min-width: 103px)',
  '@container (min-width: 200px)',
  'width: clamp(34px, calc(33.333cqi - 95.333px), 52px) !important;',
  'calc(50cqi - 8px - max(0px, 100cqi - 104px))',
  'pointer-events: auto !important;',
  '@media (max-width: 399px)',
]) assert(app458Css.includes(token),'app458 required compact parity missing: '+token);
for(const forbidden of ['.soridraw-studio-result-pane','requestAnimationFrame(', 'ResizeObserver(', 'getBoundingClientRect(', 'fetch(']){
  assert(!app458Css.includes(forbidden),'app458 standalone CSS must not edit split engine or server: '+forbidden);
}
console.log('APP458_MUSIC_NOTE_LIBRARY_EXTERNAL_MOBILE_COMPACT_PARITY=PASS');


// APP459: physical mobile and detached-window min-content fit without
// shrinking painted seven dots; same row-container rule in narrow split.
const app459Css=css.slice(
  css.indexOf('APP459_COMPACT_ROW_FIT_WITHOUT_COLLISION'),
  css.indexOf('APP460_STANDALONE_IDLE_SEARCH_PILL_EXACT_FIT'),
);
assert(app459Css.startsWith('APP459_COMPACT_ROW_FIT_WITHOUT_COLLISION'),'app459 CSS missing');
for(const token of [
  '@container (max-width: 420px)',
  'clamp(2px, calc((100cqi - 290px) / 20), 6px)',
  'clamp(14px, calc((100cqi - 150px) / 8), 28px)',
  'max-width: 100% !important;',
  'max(100%, min(260px, calc(100vw - 24px)))',
  '.soridraw-responsive-search-slot:not(:focus-within):not(.is-search-active)',
]) assert(app459Css.includes(token),'app459 fit rule missing: '+token);
for(const w of [256,280,296,320,336,360,376,396,420]){
  const dotHit=Math.max(14,Math.min(28,(w-150)/8));
  const gap=Math.max(2,Math.min(6,(w-290)/20));
  const reset=Math.max(34,Math.min(52,w/3-95.333));
  const used=42+42+12+reset+7*dotHit+7*gap+10;
  assert(used <= w+0.02,'app459 row overflow at '+w+'px: '+used.toFixed(2));
}
console.log('APP459_PHONE_ROW_256_TO_420_NO_RESTING_OVERFLOW=PASS');


// APP460: source-only guard, independent of existing app459 overflow rules.
const app460Css=css.slice(css.indexOf('APP460_STANDALONE_IDLE_SEARCH_PILL_EXACT_FIT'));
assert(app460Css.startsWith('APP460_STANDALONE_IDLE_SEARCH_PILL_EXACT_FIT'),'app460 idle search missing');
for(const token of [
  '@media (max-width: 1099px)',
  '[data-soridraw-responsive-mode="mobile"]',
  '.soridraw-responsive-search-slot:not(:focus-within):not(.is-search-active)',
  'position: absolute !important;',
  'width: 100% !important;',
  'min-width: 0 !important;',
  'max-width: 100% !important;',
  'height: 46px !important;',
  'border-radius: 16px !important;',
  'clip-path: inset(0 round 16px);',
]) assert(app460Css.includes(token),'app460 missing: '+token);
for(const prohibited of ['.soridraw-responsive-color-filter {','.soridraw-responsive-filter-button {','requestAnimationFrame(','ResizeObserver(','getBoundingClientRect(','fetch(']) {
  assert(!app460Css.includes(prohibited),'app460 touched unrelated UI/logic: '+prohibited);
}
console.log('APP460_CLASSIC_DARK_MOBILE_IDLE_SEARCH_ROUNDING=PASS');

// APP463_MUSIC_NOTE_KEYWORDS_READABLE_12PX: font-only override for the Music Note saved-song keyword strip.
// Keep the old narrow-pane size rules as historical CSS; the scoped later
// override wins without widening cards or changing native scroll behavior.
const app463Css=css.slice(css.indexOf('APP463_MUSIC_NOTE_SONG_KEYWORD_12PX'));
assert(app463Css.startsWith('APP463_MUSIC_NOTE_SONG_KEYWORD_12PX'), 'app463 keyword font CSS missing');
for (const token of [
  '.soridraw-musicnote-theme .soridraw-musicnote-song-keywords > .soridraw-musicnote-keyword-chip',
  '.soridraw-musicnote-theme.soridraw-responsive-content-page .soridraw-musicnote-song-keywords > .soridraw-musicnote-keyword-chip',
  'font-size: 12px !important;',
  'line-height: 1.1 !important;',
]) assert(app463Css.includes(token), 'app463 keyword readability token missing: '+token);
for (const forbidden of ['height:', 'overflow:', 'padding:', 'color:', 'background:', 'pointer-events:', 'fetch(', 'getBoundingClientRect(', 'requestAnimationFrame(']) {
  assert(!app463Css.includes(forbidden), 'app463 must be font-only with no layout/behavior changes: '+forbidden);
}
console.log('APP463_MUSIC_NOTE_KEYWORD_12PX_ONLY=PASS');
