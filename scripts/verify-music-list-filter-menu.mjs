import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const note = readFileSync('src/pages/FavoritesPage.tsx','utf8');
const library = readFileSync('src/pages/SunoLibraryPage.tsx','utf8');
const extract = (src, a, b) => {
  const start=src.indexOf(a), end=src.indexOf(b,start+1);
  assert(start>=0 && end>start,'missing source block: '+a);
  return src.slice(start,end);
};
const run = (code, mocks, symbol) => {
  const source = code + '\nexports.result=' + symbol + ';';
  const compiled = ts.transpileModule(source,{compilerOptions:{
    target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
  }}).outputText;
  const exports={};
  vm.runInNewContext(compiled,{...mocks,exports});
  return exports.result;
};

const noteOptions = extract(note, "{([\n                    { value: 'all', label: '전체' }", "                  ] as const).map");
assert.deepEqual([...noteOptions.matchAll(/value: '([^']+)', label: '([^']+)'/g)].map(x=>x[2]),
  ['전체','최신','오래된','좋아요','잠금','공개','URL 등록']);
assert(note.includes("onClick={() => applyMusicNoteListFilter('trash')}"));
assert(note.includes("musicNoteListFilter === 'trash'"), 'trash has its own selected state');
assert(!note.includes('sortPopupTimerRef'), 'regression: no five-second idle dismissal');
assert(!/setTimeout\(\(\) => setShowSortPopup\(false\)/.test(note));
assert(note.includes("window.addEventListener('scroll', closeOnMove, true)"));
assert(note.includes("window.addEventListener('resize', closeOnMove)"));
assert(note.includes("document.addEventListener('mousedown', closeOutside)"));
assert(note.includes("window.addEventListener('soridraw-split-drag-start', onSplitDragStart)"));

const noteFn=extract(note,'  const songMatchesMusicNoteFilters =','  const localSearchMatchCount =');
const filterSong=(mode,song,extra={})=>run(noteFn,{
 isMusicNoteSharedView:false,
 isFavoriteSoftRemoved:(s)=>!!s.removed,
 favoriteColorFilter:'all',
 getFavoriteColorValue:(s)=>s.color,
 isFavoriteInTrash:(s)=>!!s.trash,
 favoriteTrashView:mode==='trash',
 musicNoteViewMode:'noteSpace',
 musicNoteListFilter:mode,
 isMusicNoteCardLiked:(s)=>!!s.liked,
 isMusicNoteCardLocked:(s)=>!!s.locked,
 getFavoriteDocumentId:(s)=>s.id,
 explorePublicationStateBySongId:extra.publications||{},
 getFavoriteSunoShareUrl:(s)=>s.sunoShareUrl||'',
 isSharedMusicNoteItem:()=>false,
 getMyNoteFolderIdsFromSong:()=>[],
 getMusicNoteFolderIdFromSong:()=>null,
 selectedMyNoteFolderId:'default',selectedSharedNoteFolderId:'default',
},'songMatchesMusicNoteFilters')(song);
const song={id:'song',liked:true,locked:true,isPublic:true,sunoShareUrl:'https://suno.com/s/ok'};
for(const mode of ['all','latest','oldest','liked','locked','public','url']) {
 assert(filterSong(mode,song), 'Music Note should match '+mode);
}
assert(!filterSong('liked',{...song,liked:false}));
assert(!filterSong('locked',{...song,locked:false}));
assert(!filterSong('public',{...song,isPublic:false}));
assert(!filterSong('url',{...song,sunoShareUrl:''}));
assert(!filterSong('public',song,{publications:{song:{status:'private'}}}), 'explicit private wins over stale public metadata');
assert(filterSong('trash',{...song,trash:true}));
assert(!filterSong('trash',{...song,trash:false}));
assert(!filterSong('all',{...song,trash:true}), 'trash must not leak into all');

const libOptions=extract(library,"  const libraryMenuOptions:", "  const renderLibraryFilterChoices =");
assert.deepEqual([...libOptions.matchAll(/value: '([^']+)', label: '([^']+)'/g)].map(x=>x[2]),
 ['전체','최신','오래된','좋아요','잠금','공개','휴지통']);
assert(library.includes("const deferred = value === 'locked' || (!workspace && value === 'trash')"),'unsupported Library actions remain disabled');
assert(library.includes("disabled={deferred}"));
assert(library.includes('renderLibraryFilterChoices(true)'));
assert(library.includes('renderLibraryFilterChoices(false)'));
assert(library.includes("window.addEventListener('scroll', closeOnMotion, true)"));
assert(library.includes("window.addEventListener('resize', closeOnMotion)"));
assert(library.includes("document.addEventListener('mousedown', handleLibraryFilterOutside)"));
const menuSection=extract(library, '  const renderLibraryFilterChoices =','  const renderLibraryTopControls =');
assert(!menuSection.includes('setTimeout('), 'idle timeout must never close filter');
assert(library.includes('const items = getVisiblePlaylistItemsForSelection();'),'visible playlist list and selection use identical filter');
assert(library.includes("filter === 'latest' || filter === 'oldest'"),'Library workspace sorts by age');

const timeSrc=extract(library,'const getLibraryPlaylistItemAddedAtMs =','const mergeLibraryWorkspaceSessionTracks =');
const stamp=run(timeSrc,{},'getLibraryPlaylistItemAddedAtMs');
assert.equal(stamp({addedAt:{seconds:100}}),100000);
assert.equal(stamp({addedAt:{toMillis:()=>250000}}),250000);
const playlistSrc=extract(library,'  const getVisiblePlaylistItemsForSelection =','  const getVisibleMultiSelections =');
const all=[
 {id:'old',sourceId:'one',order:2,addedAt:{seconds:100},favorite:false},
 {id:'new',sourceId:'two',order:1,addedAt:{seconds:300},favorite:true},
 {id:'shared',sourceType:'shared_track',sourceId:'other',order:3,addedAt:{seconds:200}},
];
const visible=(quick,visibility='all')=>run(timeSrc+playlistSrc,{
 deferredPlaylistSearchTerm:'',playlistItems:all,
 matchesPlaylistVisibilityFilter:(item)=>visibility==='all'||item.id==='new',
 playlistColorFilter:'all',getPlaylistItemColor:()=>null,
 playlistMenuFilter:quick,playlistSearchTrackById:new Map([['one',{favorite:false}],['two',{favorite:true}]]),
 playlistItemMatchesStoredSearch:()=>true,playlistSortMode:'added',
},'getVisiblePlaylistItemsForSelection')().map(item=>item.id);
assert.deepEqual([...visible('latest')],['new','shared','old']);
assert.deepEqual([...visible('oldest')],['old','shared','new']);
assert.deepEqual([...visible('all')],['new','old','shared']);
assert.deepEqual([...visible('favorite')],['new']);
assert.deepEqual([...visible('public','public')],['new']);

/* 2026-11-04 physical Android recording 22153:
 * 42px shared/absolute magnifier & X overlapped. Remove orange only from
 * the top filter, and use the saved space for 36px + gap + 32px controls. */
const paletteOptions = extract(note,
  '  const FAVORITE_COLOR_OPTIONS = [',
  '  const getFavoriteColorValue =');
assert(paletteOptions.includes("{ value: 'orange', color: '#f97316'"),
  'stored orange remains a valid color: no destructive migration');
assert(paletteOptions.includes("FAVORITE_COLOR_FILTER_OPTIONS = FAVORITE_COLOR_OPTIONS.filter((color) => color.value !== 'orange')"),
  'filter-only orange removal must not change the stored palette');
const colorBar = extract(note,
  '<div className="soridraw-responsive-color-filter flex h-[46px]',
  '<div ref={sortPopupRef}');
assert(colorBar.includes('{FAVORITE_COLOR_FILTER_OPTIONS.map((color) => ('),
  'top search dots must use six colors, excluding orange');
assert(!colorBar.includes('{FAVORITE_COLOR_OPTIONS.map((color) => ('),
  'do not render seven filter dots again');
const mobileFold = extract(note, '/* Only the mobile Music Note search\'s folded state changes.', '`}</style>');
const compactRule = extract(mobileFold,
  '.soridraw-stable-top-controls .soridraw-responsive-search-slot.is-search-collapsed {',
  ':root body #root .soridraw-app-root\n        .soridraw-musicnote-theme');
assert(compactRule.includes('flex: 0 0 70px !important;')
  && compactRule.includes('width: 70px !important;')
  && compactRule.includes('gap: 2px !important;'),
  'folded search row slot is exactly 70px with 2px separation');
const compactMagnifier = extract(mobileFold,
  '.soridraw-responsive-search-slot.is-search-collapsed .soridraw-responsive-search-icon {',
  ':root body #root .soridraw-app-root\n        .soridraw-musicnote-theme');
assert(compactMagnifier.includes('width: 36px !important;')
  && compactMagnifier.includes('left: 0 !important;'),
  'magnifier has its own 36px click area');
const compactClear = mobileFold.slice(mobileFold.lastIndexOf(
  '.soridraw-responsive-search-slot.is-search-collapsed .soridraw-musicnote-search-collapsed-clear {'),
  mobileFold.indexOf('/* With only six filter dots'));
assert(compactClear.includes('position: relative !important;'),
  'X must sit as an independent flex sibling, not an overlay');
assert(compactClear.includes('display: flex !important;')
  && compactClear.includes('flex: 0 0 32px !important;')
  && compactClear.includes('width: 32px !important;'),
  'X must be visible and get a full 32px hit box');
assert(!compactClear.includes('position: absolute !important;'),
  'a positioned X could again overlap the magnifier');
assert(mobileFold.includes('calc((100cqi - 158px) / 8)'),
  '320px pane must reclaim narrow invisible dot spacing');
assert(note.includes('onClick={expandMusicNoteSearch}'), 'magnifier still reopens search');
assert(note.includes('onClick={clearMusicNoteSearch}'), 'X still clears search');
assert(note.includes('collapseMusicNoteSearchAfterAction()'), 'Enter/color/row actions still fold');
console.log('MOBILE_NOTE_SIX_COLOR_FILTER_TWO_SEPARATE_SEARCH_TOUCH_TARGETS=PASS');

console.log('MUSIC_NOTE_FILTER_ORDER_AND_LIKE_LOCK_PUBLIC_URL_TRASH=PASS');
console.log('LIBRARY_FILTER_ORDER_SUPPORTED_AND_DISABLED_PLACEHOLDERS=PASS');
console.log('LIBRARY_PLAYLIST_DATE_LIKE_PUBLIC_DISPLAY_SELECTION_PARITY=PASS');
console.log('FILTER_MENUS_NO_IDLE_CLOSE_SCROLL_RESIZE_CLICK_AWAY=PASS');
