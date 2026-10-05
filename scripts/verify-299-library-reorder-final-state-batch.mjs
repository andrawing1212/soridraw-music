import fs from 'node:fs';

const service = fs.readFileSync('src/services/playlistService.ts', 'utf8');
const page = fs.readFileSync('src/pages/SunoLibraryPage.tsx', 'utf8');

const reorderStart = service.indexOf('export const reorderPlaylist = async (');
const reorderEnd = service.indexOf('export const addPlaylistItem', reorderStart);
if (reorderStart < 0 || reorderEnd < 0) throw new Error('reorderPlaylist block missing');
const reorder = service.slice(reorderStart, reorderEnd);

for (const marker of [
  'queueLibraryPlaylistOrderBatch(uid, playlistId, safeOrder, safePreviousOrder, syncVersion)',
  "publishLibraryPlaylistSyncSignal(uid, 'playlist-order'",
  'patchLibraryPlaylistListCache(uid',
]) {
  if (!reorder.includes(marker)) throw new Error(`reorder missing immediate/local-first marker: ${marker}`);
}
if (reorder.includes('batch.commit()') || reorder.includes("batch.update(doc(db, 'user_playlists'")) {
  throw new Error('reorder still writes canonical Firestore immediately');
}

for (const marker of [
  'LIBRARY_PLAYLIST_ORDER_BATCH_MS = 60_000',
  'export const flushLibraryPlaylistOrderBatch',
  'export const resumeLibraryPlaylistOrderBatch',
  "publishLibraryPlaylistSyncSignal(safeUid, 'playlist-order-batch'",
  'cancelLibraryPlaylistOrderBatch(uid, playlistId);',
]) {
  if (!service.includes(marker)) throw new Error(`order batch marker missing: ${marker}`);
}

if (!service.includes('Math.abs(safeOrder - baseOrder) < 1e-9')) {
  throw new Error('net-zero reorder collapse missing');
}
if (!service.includes("signal.operation === 'playlist-order-batch'")) {
  throw new Error('cross-device settled order batch receiver missing');
}
if (!page.includes('resumeLibraryPlaylistOrderBatch(uid)')) {
  throw new Error('Library page does not resume durable order batch');
}
if (!page.includes('.then(() => flushLibraryPlaylistOrderBatch(uid))')) {
  throw new Error('pagehide order settlement chain missing');
}
if (!page.includes('reorderPlaylist(user.uid, playlistId, movedOrder, originalMovedOrder)')) {
  throw new Error('reorder base-order handoff missing');
}

console.log('app299 Library reorder final-state batch verifier PASS');
