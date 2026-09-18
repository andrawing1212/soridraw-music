import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildBackfillSafetyPlan,
  deterministicFavoriteSongId,
  deterministicRecentSongId,
} from './backend_v2_backfill_safety_plan';

const writeNdjson = async (path: string, records: unknown[]): Promise<void> => {
  await writeFile(path, records.map((record) => JSON.stringify(record)).join('\n') + '\n', 'utf-8');
};

const main = async (): Promise<void> => {
  assert.equal(
    deterministicRecentSongId('u1', 'user_recent_songs/u1', 0),
    deterministicRecentSongId('u1', 'user_recent_songs/u1', 0),
    'recent migration ID must be rerun-stable',
  );
  assert.notEqual(
    deterministicRecentSongId('u1', 'user_recent_songs/u1', 0),
    deterministicRecentSongId('u1', 'user_recent_songs/u1', 1),
    'recent migration ID must preserve source provenance index',
  );
  assert.equal(
    deterministicFavoriteSongId('favorites/f1'),
    deterministicFavoriteSongId('favorites/f1'),
    'favorite fallback ID must be rerun-stable',
  );

  const dir = await mkdtemp(join(tmpdir(), 'soridraw-step34-contract-'));
  try {
    await writeFile(join(dir, 'manifest.json'), JSON.stringify({
      schemaVersion: 1,
      targetProjectId: 'soridraw-app-866a5',
      complete: true,
      datasets: [
        { id: 'user_structures', documentCount: 1 },
        { id: 'user_recent_songs', documentCount: 1 },
        { id: 'favorites', documentCount: 4 },
        { id: 'playlist_lists', documentCount: 1 },
        { id: 'playlist_items', documentCount: 1 },
      ],
    }), 'utf-8');

    await writeNdjson(join(dir, 'user_structures.ndjson'), [
      { path: 'user_structures/u1', data: { structures: [] } },
    ]);
    await writeNdjson(join(dir, 'user_recent_songs.ndjson'), [
      {
        path: 'user_recent_songs/u1',
        data: {
          songs: [
            { id: 'song-a', provider: 'suno', trackId: 'track-a', audioUrl: 'https://example.invalid/a.mp3', favoriteKey: 'key-a', title: 'A' },
            { id: 'song-b', provider: 'suno', trackId: 'track-b', audioUrl: 'https://example.invalid/b.mp3', favoriteKey: 'key-b', title: 'B' },
          ],
        },
      },
    ]);
    await writeNdjson(join(dir, 'favorites.ndjson'), [
      { path: 'favorites/f1', data: { uid: 'u1', id: 'song-a', title: 'A favorite' } },
      { path: 'favorites/f2', data: { uid: 'u1', provider: 'suno', trackId: 'track-b', title: 'B favorite' } },
      { path: 'favorites/f3', data: { uid: 'u1', favoriteKey: 'unknown', audioUrl: 'https://example.invalid/x.mp3' } },
      { path: 'favorites/f4', data: { title: 'missing uid must never be merged' } },
    ]);
    await writeNdjson(join(dir, 'playlist_lists.ndjson'), [
      { path: 'user_playlists/u1/lists/p1', data: { title: 'P1' } },
    ]);
    await writeNdjson(join(dir, 'playlist_items.ndjson'), [
      { path: 'user_playlists/u1/lists/p1/items/i1', data: { order: 0 } },
    ]);

    const summary = await buildBackfillSafetyPlan(dir);
    assert.equal(summary.source.backupDocuments, 8);
    assert.equal(summary.source.recentSongItems, 2);
    assert.equal(summary.identity.proposedStrongMatches, 2);
    assert.equal(summary.identity.explicitIdMatches, 1);
    assert.equal(summary.identity.providerTrackMatches, 1);
    assert.equal(summary.identity.favoritesMissingUid, 1);
    assert.equal(summary.identity.standaloneFavorites, 2);
    assert.equal(summary.projectedWrites.settingsCreates, 1);
    assert.equal(summary.projectedWrites.playlistHeaderCreates, 1);
    assert.equal(summary.projectedWrites.playlistItemCreates, 1);
    assert.equal(summary.projectedWrites.recentSongCreates, 2);
    assert.equal(summary.projectedWrites.favoriteTrustedUpdates, 2);
    assert.equal(summary.projectedWrites.favoriteStandaloneCreates, 2);
    assert.equal(summary.projectedWrites.total, 9);
    assert.equal(summary.safety.firestoreWrites, 0);
    assert.equal(summary.safety.actualBackfillExecutionAuthorized, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  console.log('Backend V2 Step 3-4 backfill safety planner contracts: PASS');
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
