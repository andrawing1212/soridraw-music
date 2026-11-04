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

/* 2026-11-04 director Android regression: compact search must leave
 * all toolbar space to the color palette and keep BOTH buttons actionable. */
const mobileFold = extract(note, '/* Mobile-only search fold:', '`}</style>');
const compactRule = extract(mobileFold,
  '.soridraw-stable-top-controls .soridraw-responsive-search-slot.is-search-collapsed {',
  ':root body #root .soridraw-app-root\n        .soridraw-musicnote-theme');
assert(compactRule.includes('flex: 0 0 42px !important;'),
  'mobile collapsed search must not reserve 82px and push palette right');
assert(compactRule.includes('width: 42px !important;'));
assert(compactRule.includes('gap: 0 !important;'));
assert(!mobileFold.includes('82px !important'), 'old oversized mobile search footprint reintroduced');
const compactIcon = extract(mobileFold,
  '.soridraw-responsive-search-slot.is-search-collapsed .soridraw-responsive-search-icon {',
  ':root body #root .soridraw-app-root\n        .soridraw-musicnote-theme');
assert(compactIcon.includes('width: 22px !important;'),
  'magnifier should occupy only left half of existing 42px');
const compactClear = mobileFold.slice(mobileFold.lastIndexOf(
  '.soridraw-responsive-search-slot.is-search-collapsed .soridraw-musicnote-search-collapsed-clear {'));
assert(compactClear.includes('position: absolute !important;'),
  'X must not be another flex item pushing the palette');
assert(compactClear.includes('display: flex !important;'), 'X must be visible');
assert(compactClear.includes('right: 0 !important;') && compactClear.includes('width: 20px !important;'),
  'X must fit in the right half of 42px compact control');
assert(note.includes("onClick={expandMusicNoteSearch}"), 'magnifier reopens input');
assert(note.includes("onClick={clearMusicNoteSearch}"), 'compact X clears query');
assert(note.includes('is-search-collapsed'), 'collapsed state remains separate from search term');
assert(note.includes('collapseMusicNoteSearchAfterAction()'), 'Enter/row actions still fold');
console.log('MOBILE_MUSIC_NOTE_SEARCH_COMPACT_X_PALETTE_NO_SHIFT=PASS');

console.log('MUSIC_NOTE_FILTER_ORDER_AND_LIKE_LOCK_PUBLIC_URL_TRASH=PASS');
console.log('LIBRARY_FILTER_ORDER_SUPPORTED_AND_DISABLED_PLACEHOLDERS=PASS');
console.log('LIBRARY_PLAYLIST_DATE_LIKE_PUBLIC_DISPLAY_SELECTION_PARITY=PASS');
console.log('FILTER_MENUS_NO_IDLE_CLOSE_SCROLL_RESIZE_CLICK_AWAY=PASS');
