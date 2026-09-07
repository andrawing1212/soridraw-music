import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');

const favorites = read('src/pages/FavoritesPage.tsx');
assert.ok(favorites.includes("from '../lib/musicNoteDetailCache'"));
const hydrateStart = favorites.indexOf('const hydrateCatalogFavorite = async');
const hydrateEnd = favorites.indexOf('const openFavoriteDetail', hydrateStart);
assert.ok(hydrateStart >= 0 && hydrateEnd > hydrateStart);
const hydrate = favorites.slice(hydrateStart, hydrateEnd);
assert.ok(hydrate.includes('getOrLoadMusicNoteDetail'));
assert.ok(hydrate.includes('getMusicNoteDetailSourceVersion'));
assert.ok(hydrate.includes("getDoc(doc(db, 'favorites', sourceId))"));

const detailCache = read('src/lib/musicNoteDetailCache.ts');
assert.ok(detailCache.includes('SORIDRAW_MUSIC_NOTE_DETAIL_CACHE_029'));
assert.ok(detailCache.includes('indexedDB.open'));
assert.ok(detailCache.includes('inFlightLoads'));
assert.ok(detailCache.includes('cacheRecordIsFresh'));

const library = read('src/pages/SunoLibraryPage.tsx');
const applyStart = library.indexOf('const handleApplyNext = async');
const applyEnd = library.indexOf('const getPlaylistSaveIsShared', applyStart);
assert.ok(applyStart >= 0 && applyEnd > applyStart);
const apply = library.slice(applyStart, applyEnd);
assert.ok(apply.includes("getDoc(doc(db, 'suno_tracks', activeUid, 'tracks', sourceTrackId))"));
assert.ok(apply.includes('libraryAppliedKeywordsSessionCache'));
assert.ok(apply.includes('patchWorkspaceTrackLocally'));

const engine = read('src/lib/userDataEngine.ts');
const engineLibraryStart = engine.indexOf('const LIBRARY_SUMMARY_KEYS');
const engineLibraryEnd = engine.indexOf(']);', engineLibraryStart);
assert.ok(engineLibraryStart >= 0 && engineLibraryEnd > engineLibraryStart);
assert.ok(engine.slice(engineLibraryStart, engineLibraryEnd).includes("'appliedKeywords'"));

const worker = read('cloudflare/media-worker/src/index.js');
const workerLibraryStart = worker.indexOf('const LIBRARY_CATALOG_FIELDS');
const workerLibraryEnd = worker.indexOf('];', workerLibraryStart);
assert.ok(workerLibraryStart >= 0 && workerLibraryEnd > workerLibraryStart);
assert.ok(worker.slice(workerLibraryStart, workerLibraryEnd).includes("'appliedKeywords'"));

const player = read('src/components/GlobalPlayer.tsx');
assert.ok(player.includes("doc, getDoc, updateDoc"));
const playerApplyStart = player.indexOf('const handleApplyNext = async');
const playerApplyEnd = player.indexOf('const handleSaveOrMovePlaylist', playerApplyStart);
assert.ok(playerApplyStart >= 0 && playerApplyEnd > playerApplyStart);
assert.ok(player.slice(playerApplyStart, playerApplyEnd).includes("getDoc(doc(db, 'suno_tracks'"));

console.log('VERIFY_029_MUSIC_NOTE_LIBRARY=PASS');
