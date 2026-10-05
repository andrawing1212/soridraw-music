import fs from 'node:fs';
import assert from 'node:assert/strict';

const service = fs.readFileSync('src/services/playlistService.ts', 'utf8');
const page = fs.readFileSync('src/pages/SunoLibraryPage.tsx', 'utf8');

const deleteStart = service.indexOf('export const deletePlaylist = async (');
const deleteEnd = service.indexOf('export const getTrackGlobalId', deleteStart);
assert.ok(deleteStart >= 0 && deleteEnd > deleteStart, 'deletePlaylist region missing');
const deleteRegion = service.slice(deleteStart, deleteEnd);

assert.ok(
  deleteRegion.includes('knownItemIds?: string[]'),
  'deletePlaylist does not accept the already-loaded active playlist item ids',
);
assert.ok(
  deleteRegion.includes('if (Array.isArray(knownItemIds))'),
  'warm delete does not prefer caller-provided item ids',
);
assert.ok(
  deleteRegion.indexOf('if (Array.isArray(knownItemIds))') < deleteRegion.indexOf('await getDocs(itemsRef)'),
  'warm delete can still read Firestore before using caller-provided ids',
);
assert.ok(
  deleteRegion.includes('const itemsSnap = await getDocs(itemsRef);'),
  'cold/stale safety fallback was removed',
);

const handlerStart = page.indexOf('const handleDeletePlaylist = async');
const handlerEnd = page.indexOf('const handleAddPlaylist = async', handlerStart);
assert.ok(handlerStart >= 0 && handlerEnd > handlerStart, 'Library delete handler missing');
const handler = page.slice(handlerStart, handlerEnd);

assert.ok(
  handler.includes("activePlaylistId === playlist.id && !loadingPlaylistItems"),
  'Library delete does not prove the visible playlist snapshot is loaded before reusing ids',
);
assert.ok(
  handler.includes("playlistItems.map((item) => String(item.id || '').trim()).filter(Boolean)"),
  'Library delete does not derive ids from the already-loaded active playlist snapshot',
);
assert.ok(
  handler.includes('await deletePlaylist(user.uid, playlist.id!, knownItemIds);'),
  'Library delete does not pass warm item ids into the service',
);

console.log('VERIFY_298_LIBRARY_DELETE_WARM_ZERO_READ=PASS');
