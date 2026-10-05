import fs from 'node:fs';
import assert from 'node:assert/strict';

const service = fs.readFileSync('src/services/playlistService.ts', 'utf8');
const page = fs.readFileSync('src/pages/SunoLibraryPage.tsx', 'utf8');

const deleteStart = service.indexOf('export const deletePlaylist = async (');
const deleteEnd = service.indexOf('export const getTrackGlobalId', deleteStart);
assert.ok(deleteStart >= 0 && deleteEnd > deleteStart, 'deletePlaylist region missing');
const region = service.slice(deleteStart, deleteEnd);

assert.ok(region.includes('): Promise<number> =>'), 'deletePlaylist must return its sync version');
assert.ok(region.includes('if (Array.isArray(knownItemIds))'), 'warm item-id handoff missing');
assert.ok(region.indexOf('if (Array.isArray(knownItemIds))') < region.indexOf('await getDocs(itemsRef)'), 'warm delete can still read before item-id handoff');
assert.ok(region.includes('const previousListCache = await readLibraryPlaylistListCache(uid);'), 'pre-commit list cache snapshot missing');
assert.ok(region.includes('writeLibraryPlaylistListCache('), 'pre-commit list cache advance missing');
assert.ok(region.indexOf('writeLibraryPlaylistListCache(') < region.indexOf('await batch.commit()'), 'list cache is not advanced before users revision commit');
assert.ok(region.includes('rollbackVersion'), 'failed canonical delete lacks local cache rollback');
assert.ok(region.includes('return syncVersion;'), 'delete sync version is not returned');

const handlerStart = page.indexOf('const handleDeletePlaylist = async');
const handlerEnd = page.indexOf('const handleAddPlaylist = async', handlerStart);
const handler = page.slice(handlerStart, handlerEnd);
assert.ok(handler.includes('loadedPlaylistItemsSnapshotRef.current'), 'delete handler does not use completed keyed snapshot');
assert.ok(handler.includes('const syncVersion = await deletePlaylist'), 'delete handler does not capture mutation version');
assert.ok(handler.includes('playlistListCacheVersionRef.current = Math.max'), 'page cache-version ref is not fenced after local delete');

const loadStart = page.indexOf("useEffect(() => {\n    if (!user || (libraryViewMode !== 'playlist'");
const loadEnd = page.indexOf('  }, [user?.uid, libraryViewMode, activePlaylistId, playlists]);', loadStart);
const load = page.slice(loadStart, loadEnd);
assert.ok(load.includes('loadedPlaylistItemsSnapshotRef.current = null;'), 'playlist switch does not invalidate completed snapshot');
assert.ok(load.includes('itemIds: sortedItems.map'), 'warm cache completion does not record exact ids');
assert.ok(load.includes('itemIds: items.map'), 'server completion does not record exact ids');

console.log('VERIFY_300_LIBRARY_DELETE_NO_REDUNDANT_READ=PASS');
