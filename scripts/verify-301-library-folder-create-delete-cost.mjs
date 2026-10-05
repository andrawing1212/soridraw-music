import fs from 'node:fs';
import assert from 'node:assert/strict';

const service = fs.readFileSync('src/services/playlistService.ts', 'utf8');
const page = fs.readFileSync('src/pages/SunoLibraryPage.tsx', 'utf8');

const region = (startMarker, endMarker) => {
  const start = service.indexOf(startMarker);
  const end = service.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `region missing: ${startMarker}`);
  return service.slice(start, end);
};

const create = region('export const createPlaylist = async', 'export const renamePlaylist = async');
assert.ok(!create.includes('await getDoc(') && !create.includes('await getDocs('), 'folder create gained a Firestore read');
assert.ok(create.includes('batch.set(newDocRef, created)'), 'folder create must persist exactly its new playlist document');
assert.ok(!create.includes("batch.update(doc(db, 'users'"), 'folder create must not immediately write users revision');
assert.ok(create.includes('queueLibraryPlaylistRevisionBatch(uid, syncVersion)'), 'folder create compatibility revision is not delayed/batched');
assert.ok(create.includes('writeLibraryPlaylistItemsCache(uid, newDocRef.id, [], syncVersion)'), 'new empty folder cache seed missing');

const del = region('export const deletePlaylist = async', 'export const getTrackGlobalId');
assert.ok(del.includes('if (Array.isArray(knownItemIds))'), 'warm delete exact item ids missing');
assert.ok(del.indexOf('if (Array.isArray(knownItemIds))') < del.indexOf('await getDocs(itemsRef)'), 'warm delete can still read before exact item ids');
assert.ok(!del.includes("batch.update(doc(db, 'users'"), 'folder delete still immediately writes users revision');
assert.ok(del.includes('queueLibraryPlaylistRevisionBatch(uid, syncVersion)'), 'folder delete compatibility revision is not delayed/batched');
assert.ok(!del.includes('markLibraryPlaylistRevisionCommitted(uid, syncVersion)'), 'folder delete falsely marks delayed users revision committed');
assert.ok(del.includes('batch.delete(playlistRef)'), 'folder delete lost canonical playlist deletion');
assert.ok(del.includes('itemIds.forEach((itemId)'), 'folder delete lost contained-item deletion');

const signalEffectStart = page.indexOf('return subscribeLibraryPlaylistSync(uid, (signal) => {');
const signalEffectEnd = page.indexOf('  }, [user?.uid, isSharedView]);', signalEffectStart);
assert.ok(signalEffectStart >= 0 && signalEffectEnd > signalEffectStart, 'Library sync subscription missing');
const signalEffect = page.slice(signalEffectStart, signalEffectEnd);
const committedListLine = signalEffect.split('\n').find((line) => line.includes("['item-add'")) || '';
assert.ok(!committedListLine.includes("'playlist-delete'"), 'RTDB playlist-delete still clears delayed revision batch');
assert.ok(signalEffect.includes("applyLibraryPlaylistSyncSignalToCache(uid, signal)"), 'cross-device cache apply missing');

console.log('VERIFY_301_LIBRARY_FOLDER_CREATE_DELETE_COST=PASS');
