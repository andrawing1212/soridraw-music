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

/* 2026-11-04 Android regression: nested active-search overlay covered X,
 * and previous CSS widths failed even after shrinking the orange top dot.
 * The folded input must be display:none, replaced with TWO sibling buttons
 * outside the original input slot in BOTH Music Note and Library. */
const layout = readFileSync('src/components/studio/studioLayout.css','utf8');
const paletteOptions = extract(note,'  const FAVORITE_COLOR_OPTIONS = [','  const getFavoriteColorValue =');
assert(paletteOptions.includes("{ value: 'orange', color: '#f97316'"),
  'Music Note previously stored orange must remain valid');
assert(paletteOptions.includes("FAVORITE_COLOR_FILTER_OPTIONS = FAVORITE_COLOR_OPTIONS.filter((color) => color.value !== 'orange')"),
  'Music Note orange removed only from display filter');
const noteBar = extract(note,
  '<div className="soridraw-responsive-color-filter flex h-[46px]',
  '<div ref={sortPopupRef}');
assert(noteBar.includes('{FAVORITE_COLOR_FILTER_OPTIONS.map((color) => ('),
  'Music Note top filter uses six colors');
const libraryOptions = extract(library,'const COLOR_OPTIONS = [','const getColorHex =');
assert(libraryOptions.includes("{ value: 'orange', color: '#f97316'"),
  'Library previously stored orange must remain valid');
assert(libraryOptions.includes("COLOR_FILTER_OPTIONS = COLOR_OPTIONS.filter((color) => color.value !== 'orange')"),
  'Library orange removed only from top filter');
assert((library.match(/\{COLOR_FILTER_OPTIONS\.map\(opt => \(/g)||[]).length === 2,
  'Library workspace and playlists must both have six top filter dots');
for (const [label,page] of [['note',note],['library',library]]) {
  assert(page.includes('soridraw-compact-search-controls hidden'),
    label+': two standalone buttons must be rendered as a sibling group');
  assert(page.includes('data-soridraw-search-folded={'),
    label+': toolbar folded state drives structural swap');
  assert(page.includes('aria-label="검색창 펼치기"') && page.includes('aria-label="검색어 지우기"'),
    label+': both independent touch targets have accessible labels');
  assert(page.includes("data-soridraw-responsive-mode") || page.includes("soridrawResponsiveMode"),
    label+': fold only in mobile responsive mode');
  assert(page.includes('onKeyDown='), label+': Enter collapses while search continues on input');
}
assert(!note.includes('/* Only the mobile Music Note search\'s folded state changes.'),
  'delete all old in-component overlay/position hacks');
assert(!note.includes('soridraw-musicnote-search-collapsed-clear'),
  'nested X button must not remain');
assert(layout.includes('SORIDRAW_MUSIC_SEARCH_SEPARATE_MOBILE_CONTROLS_20261104'),
  'one shared mobile CSS owner for Music Note and Library');
const newCss = layout.slice(layout.indexOf('SORIDRAW_MUSIC_SEARCH_SEPARATE_MOBILE_CONTROLS_20261104'));
assert(newCss.includes('.soridraw-stable-top-controls[data-soridraw-search-folded="true"]'),
  'only explicit folded state can switch controls');
assert(newCss.includes('> .soridraw-responsive-search-slot {\n  display: none !important;'),
  'original active text slot must NOT paint or intercept folded buttons');
assert(newCss.includes('> .soridraw-compact-search-controls {')
  && newCss.includes('display: flex !important;')
  && newCss.includes('flex: 0 0 70px !important;'),
  'replacement control group stays real 70px flex sibling');
assert(newCss.includes('> .soridraw-compact-search-controls > button {')
  && newCss.includes('position: static !important;')
  && newCss.includes('flex: 0 0 34px !important;'),
  'each control must have distinct 34px hit area, not overlays');
assert(newCss.includes('gap: 2px !important;'),
  'two 34px controls must remain separated by 2px');
assert(newCss.includes('calc((100cqi - 158px) / 8)'),
  'narrow 320px container space reclamation preserved');
/* Keep visible folded-search status: both page-specific glyphs must
 * be brand-colored, and both backgrounds as bright as the toolbar buttons.
 * No changes are allowed to the two hitboxes or query lifecycle. */
assert(newCss.includes('background: #2c2c2e !important;'),
  'folded controls use the normal button background, not dim secondary');
assert(newCss.includes('color: var(--soridraw-search-active-accent, #FF7A72) !important;'),
  'folded icon tint reflects active query');
assert(newCss.includes('--soridraw-search-active-accent: #FF7A72;'),
  'Music Note controls have page coral accent');
assert(newCss.includes('--soridraw-search-active-accent: #A98BFF;'),
  'Library controls have page purple accent');
assert(newCss.includes('flex: 0 0 34px !important;')
  && newCss.includes('gap: 2px !important;'),
  'the approved two-button no-overlap geometry must remain');
console.log('MUSIC_NOTE_LIBRARY_FOLDED_SEARCH_BRAND_COLOR_VISIBLE=PASS');

console.log('MUSIC_NOTE_LIBRARY_MOBILE_SEARCH_SIBLING_CONTROLS_GEOMETRY=PASS');
console.log('MUSIC_NOTE_LIBRARY_ORANGE_FILTER_REMOVAL_SAVED_ORIGINALS_SAFE=PASS');

console.log('MUSIC_NOTE_FILTER_ORDER_AND_LIKE_LOCK_PUBLIC_URL_TRASH=PASS');
console.log('LIBRARY_FILTER_ORDER_SUPPORTED_AND_DISABLED_PLACEHOLDERS=PASS');
console.log('LIBRARY_PLAYLIST_DATE_LIKE_PUBLIC_DISPLAY_SELECTION_PARITY=PASS');
console.log('FILTER_MENUS_NO_IDLE_CLOSE_SCROLL_RESIZE_CLICK_AWAY=PASS');
