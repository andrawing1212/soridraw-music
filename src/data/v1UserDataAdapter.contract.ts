import assert from 'node:assert/strict';
import {
  createV1UserDataAdapter,
  type V1CollectionDocument,
  type V1DocumentSnapshot,
  type V1ReadPort,
  type V1WhereFilter,
} from './v1UserDataAdapter';
import { BACKEND_V2_RUNTIME_MODE, BACKEND_V2_SAFETY_GATES, v1UserDataPaths } from './userDataRepository';

type Call =
  | { kind: 'get'; path: readonly string[] }
  | { kind: 'list'; path: readonly string[] }
  | { kind: 'query'; path: readonly string[]; filters: readonly V1WhereFilter[] };

const calls: Call[] = [];

const userPayload = { role: 'user', syncVersions: { recentSongs: 7 }, unknownUserField: 'preserve' };
const recentSongA = { id: 'song-a', title: 'A', unknownLegacyField: { keep: true } };
const recentSongB = { id: 'song-b', title: 'B', lyricRevisions: [{ version: 1 }] };
const sectionPayload = { customSections: ['verse', 'chorus'], unknownSectionField: 'preserve' };

const port: V1ReadPort = {
  async getDocument<Payload extends Record<string, unknown>>(
    path: readonly [string, ...string[]],
  ): Promise<V1DocumentSnapshot<Payload>> {
    calls.push({ kind: 'get', path });
    const joined = path.join('/');
    if (joined === 'users/user-1') {
      return { id: 'user-1', exists: true, data: userPayload as unknown as Payload };
    }
    if (joined === 'user_recent_songs/user-1') {
      return {
        id: 'user-1',
        exists: true,
        data: { songs: [recentSongA, recentSongB], unrelatedRootField: 'keep' } as unknown as Payload,
      };
    }
    if (joined === 'user_structures/user-1') {
      return { id: 'user-1', exists: true, data: sectionPayload as unknown as Payload };
    }
    if (joined === 'user_list_caches/user-1/bundles/music_note_latest_20') {
      return {
        id: 'music_note_latest_20',
        exists: true,
        data: { schemaVersion: 1, items: [{ id: 'fav-a' }] } as unknown as Payload,
      };
    }
    return { id: path[path.length - 1], exists: false, data: null };
  },

  async listCollection<Payload extends Record<string, unknown>>(
    path: readonly [string, ...string[]],
  ): Promise<readonly V1CollectionDocument<Payload>[]> {
    calls.push({ kind: 'list', path });
    return [
      { id: 'item-1', data: { order: 7, colorTag: 'blue', sourceId: 'source-1' } as unknown as Payload },
    ];
  },

  async queryCollection<Payload extends Record<string, unknown>>(
    path: readonly [string, ...string[]],
    filters: readonly V1WhereFilter[],
  ): Promise<readonly V1CollectionDocument<Payload>[]> {
    calls.push({ kind: 'query', path, filters });
    if (path.join('/') === 'favorites') {
      return [
        { id: 'fav-doc-1', data: { uid: 'user-1', favoriteKey: 'legacy-key', hidden: false } as unknown as Payload },
      ];
    }
    if (path.join('/') === 'user_playlists/user-1/lists') {
      return [
        { id: 'playlist-b', data: { type: 'normal', order: 2, title: 'B' } as unknown as Payload },
        { id: 'playlist-a', data: { type: 'normal', order: 1, title: 'A' } as unknown as Payload },
      ];
    }
    return [];
  },
};

assert.equal(BACKEND_V2_RUNTIME_MODE, 'v1-only');
assert.deepEqual(BACKEND_V2_SAFETY_GATES, {
  readFromV2: false,
  writeToV2: false,
  shadowWriteToV2: false,
  migrateOnRead: false,
  deleteV1: false,
});

assert.deepEqual(v1UserDataPaths.user('user-1'), ['users', 'user-1']);
assert.deepEqual(v1UserDataPaths.recentSongs('user-1'), ['user_recent_songs', 'user-1']);
assert.deepEqual(v1UserDataPaths.structures('user-1'), ['user_structures', 'user-1']);
assert.deepEqual(v1UserDataPaths.playlistsCollection('user-1'), ['user_playlists', 'user-1', 'lists']);
assert.deepEqual(v1UserDataPaths.playlistItemsCollection('user-1', 'playlist-1'), [
  'user_playlists', 'user-1', 'lists', 'playlist-1', 'items',
]);
assert.deepEqual(v1UserDataPaths.listBundle('user-1', 'music_note_latest_20'), [
  'user_list_caches', 'user-1', 'bundles', 'music_note_latest_20',
]);
assert.throws(() => v1UserDataPaths.recentSongs(''), /invalid uid/);
assert.throws(() => v1UserDataPaths.playlist('user-1', 'bad/id'), /invalid playlistId/);

const adapter = createV1UserDataAdapter(port);

const user = await adapter.loadUserDocument('user-1');
assert.equal(user.data, userPayload, 'user root payload must stay opaque/pass-through');
assert.deepEqual(calls.at(-1), { kind: 'get', path: ['users', 'user-1'] });

const recent = await adapter.loadRecentSongs<typeof recentSongA | typeof recentSongB>('user-1');
assert.equal(recent.length, 2);
assert.equal(recent[0], recentSongA, 'recent-song payload must pass through without schema conversion');
assert.equal((recent[0] as any).unknownLegacyField.keep, true);
assert.deepEqual(calls.at(-1), { kind: 'get', path: ['user_recent_songs', 'user-1'] });

const favorites = await adapter.loadFavoriteDocuments('user-1');
assert.equal(favorites[0]?.id, 'fav-doc-1');
assert.equal(favorites[0]?.data.favoriteKey, 'legacy-key');
assert.deepEqual(calls.at(-1), {
  kind: 'query',
  path: ['favorites'],
  filters: [{ field: 'uid', op: '==', value: 'user-1' }],
});

const sections = await adapter.loadSectionsDocument('user-1');
assert.equal(sections.data, sectionPayload, 'section payload must stay opaque/pass-through');
assert.deepEqual(calls.at(-1), { kind: 'get', path: ['user_structures', 'user-1'] });

const playlists = await adapter.loadPlaylistsByType('user-1', 'normal');
assert.deepEqual(playlists.map((item) => item.id), ['playlist-a', 'playlist-b']);
assert.deepEqual(calls.at(-1), {
  kind: 'query',
  path: ['user_playlists', 'user-1', 'lists'],
  filters: [{ field: 'type', op: '==', value: 'normal' }],
});

const items = await adapter.loadPlaylistItems('user-1', 'playlist-1');
assert.equal(items[0]?.id, 'item-1');
assert.equal(items[0]?.data.colorTag, 'blue');
assert.equal(items[0]?.data.sourceId, 'source-1');
assert.deepEqual(calls.at(-1), {
  kind: 'list',
  path: ['user_playlists', 'user-1', 'lists', 'playlist-1', 'items'],
});

const bundle = await adapter.loadListBundle('user-1', 'music_note_latest_20');
assert.equal(bundle.id, 'music_note_latest_20');
assert.deepEqual(calls.at(-1), {
  kind: 'get',
  path: ['user_list_caches', 'user-1', 'bundles', 'music_note_latest_20'],
});

// The Step 2-A2 port has no mutation capability by contract.
assert.equal('setDocument' in port, false);
assert.equal('updateDocument' in port, false);
assert.equal('deleteDocument' in port, false);
assert.equal('batch' in port, false);
assert.equal('transaction' in port, false);

console.log('Backend V2 Step 2-A2 V1 adapter contract: PASS');
