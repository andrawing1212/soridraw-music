import assert from 'node:assert/strict';
import { IDBKeyRange as FakeIDBKeyRange, indexedDB as fakeIndexedDB } from 'fake-indexeddb';
import {
  BACKEND_V2_LOCAL_CACHE_RUNTIME_ENABLED,
  BackendV2IndexedDbCache,
  evaluateLocalCacheVersion,
} from './indexedDbLocalCache';

const makeCache = (name: string) => new BackendV2IndexedDbCache({
  factory: fakeIndexedDB as unknown as IDBFactory,
  keyRange: FakeIDBKeyRange as unknown as { only(value: IDBValidKey | IDBKeyRange): IDBKeyRange },
  dbName: name,
  now: () => 123456789,
});

const run = async () => {
  assert.equal(BACKEND_V2_LOCAL_CACHE_RUNTIME_ENABLED, false);
  assert.equal(evaluateLocalCacheVersion(false, null, 1), 'miss');
  assert.equal(evaluateLocalCacheVersion(true, 4, 4), 'fresh');
  assert.equal(evaluateLocalCacheVersion(true, 4, 5), 'stale');
  assert.equal(evaluateLocalCacheVersion(true, 4, undefined), 'stale');

  const cache = makeCache(`soridraw-v2-step2c-${Date.now()}`);
  assert.equal(cache.isAvailable(), true);

  assert.equal(await cache.cacheSongViewSnapshot(
    'user-a',
    'recentSongs',
    [
      { id: 'song-1', payload: { title: 'One', unknownLegacyField: { keep: true } } },
      { id: 'song-2', payload: { title: 'Two', lyrics: 'preserve me' } },
    ],
    ['song-2', 'song-1'],
    11,
  ), true);

  const freshRecent = await cache.readSongView('user-a', 'recentSongs', 11);
  assert.equal(freshRecent.status, 'fresh');
  assert.equal(freshRecent.fallbackRequired, false);
  assert.deepEqual(freshRecent.entries.map((entry) => entry.id), ['song-2', 'song-1']);
  assert.deepEqual(freshRecent.entries[1].payload.unknownLegacyField, { keep: true });

  const staleRecent = await cache.readSongView('user-a', 'recentSongs', 12);
  assert.equal(staleRecent.status, 'stale');
  assert.equal(staleRecent.fallbackRequired, true);

  // Music Note is an ID view over the same canonical local song entity, not a second full song database.
  assert.equal(await cache.cacheSongViewSnapshot('user-a', 'musicNote', [], ['song-1'], 21), true);
  const musicNote = await cache.readSongView('user-a', 'musicNote', 21);
  assert.equal(musicNote.status, 'fresh');
  assert.deepEqual(musicNote.entries.map((entry) => entry.id), ['song-1']);

  // A view that references a missing canonical entity must force V1/server fallback.
  assert.equal(await cache.cacheSongViewSnapshot('user-a', 'musicNote', [], ['song-missing'], 22), true);
  const incomplete = await cache.readSongView('user-a', 'musicNote', 22);
  assert.equal(incomplete.status, 'incomplete');
  assert.deepEqual(incomplete.missingSongIds, ['song-missing']);
  assert.equal(incomplete.fallbackRequired, true);

  // Empty collections can still be a fresh authoritative cache snapshot when a version token matches.
  assert.equal(await cache.replaceEntityCollection('user-a', 'playlist', [], { versionToken: 7 }), true);
  const emptyPlaylists = await cache.readEntityCollection('user-a', 'playlist', { expectedVersion: 7 });
  assert.equal(emptyPlaylists.status, 'fresh');
  assert.deepEqual(emptyPlaylists.entries, []);

  // Without an authority/version token, local data may render optimistically later but must still revalidate via V1.
  assert.equal(await cache.replaceEntityCollection('user-a', 'playlistItem', [
    { id: 'item-1', payload: { order: 3, colorTag: 'amber', customProviderField: 'keep' } },
  ], { parentId: 'playlist-1' }), true);
  const playlistItems = await cache.readEntityCollection('user-a', 'playlistItem', { parentId: 'playlist-1' });
  assert.equal(playlistItems.status, 'stale');
  assert.equal(playlistItems.fallbackRequired, true);
  assert.equal(playlistItems.entries[0].payload.customProviderField, 'keep');

  // Never silently collapse two records in the same snapshot.
  await assert.rejects(
    () => cache.replaceEntityCollection('user-a', 'playlist', [
      { id: 'dup', payload: { title: 'A' } },
      { id: 'dup', payload: { title: 'B' } },
    ]),
    /duplicate entity id/,
  );

  // Per-user cache clearing must not affect another user.
  assert.equal(await cache.replaceEntityCollection('user-b', 'sectionSettings', [
    { id: 'sections', payload: { customSections: ['keep-b'] } },
  ], { versionToken: 9 }), true);
  assert.equal(await cache.clearUserCache('user-a'), true);
  const userAAfterClear = await cache.readSongView('user-a', 'recentSongs', 11);
  assert.equal(userAAfterClear.status, 'miss');
  const userBAfterClear = await cache.readEntityCollection('user-b', 'sectionSettings', { expectedVersion: 9 });
  assert.equal(userBAfterClear.status, 'fresh');
  assert.deepEqual(userBAfterClear.entries[0].payload.customSections, ['keep-b']);

  await cache.close();

  const unavailable = new BackendV2IndexedDbCache({ factory: null, keyRange: null });
  assert.equal(unavailable.isAvailable(), false);
  const unavailableRead = await unavailable.readSongView('user-a', 'recentSongs', 1);
  assert.equal(unavailableRead.status, 'unavailable');
  assert.equal(unavailableRead.fallbackRequired, true);

  console.log('Backend V2 Step 2-C IndexedDB local-first contract PASS');
};

await run();
