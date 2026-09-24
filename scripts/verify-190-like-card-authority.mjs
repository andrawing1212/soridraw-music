import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';

// Execute the actual liked-card service implementation, not a second copy of its algorithm.
const liked = readFileSync('src/services/exploreLikedTracksService.ts', 'utf8');
const personal = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const extract = (start, end) => {
  const from = liked.indexOf(start);
  const to = liked.indexOf(end, from);
  assert.ok(from >= 0 && to > from, 'missing production function: ' + start);
  return liked.slice(from, to);
};
const implementation = [
  extract('export const reconcileExploreLikedTrackCollectionSnapshot127 =', 'export const getExploreLikedTrackCollectionIds ='),
  extract('export const getExploreLikedTracks =', '\n};\n') + '\n};',
].join('\n');
const compiled = (await transform(implementation, { loader: 'ts', format: 'cjs', target: 'es2022' })).code;

const ids = Array.from({ length: 10 }, (_, i) => 'track-' + (i + 1));
const cache = {
  items: Object.fromEntries(ids.slice(0, 5).map(id => [id, { id, likeCount: 1 }])),
  unavailable: Object.fromEntries(ids.slice(5).map(id => [id, true])),
  canonicalLikedTrackIds: ids.slice(0, 5),
  dormantSince: {},
};
const requests = [];
const normalizeIds = value => [...new Set((Array.isArray(value) ? value : [])
  .map(id => String(id || '').trim()).filter(Boolean))];
const normalizeId = value => String(value || '').trim();
const context = {
  normalizeId, normalizeIds,
  readCache: () => cache, writeCache: (_uid, next) => Object.assign(cache, next),
  requestLikedTracks: async (_user, trackIds) => {
    requests.push([...trackIds]);
    return { items: trackIds.map(id => ({ id, likeCount: 1 })), unavailableTrackIds: [] };
  },
  LIKED_TRACK_BATCH_MAX: 200,
  LIKED_TRACK_ROUTE: '/v1/me/liked-tracks',
  recordCloudflareLocalCacheHit: () => {},
  console,
};
const factory = new Function(...Object.keys(context),
  compiled + '\nreturn { reconcileExploreLikedTrackCollectionSnapshot127, getExploreLikedTracks };');
const service = factory(...Object.values(context));
service.reconcileExploreLikedTrackCollectionSnapshot127('A', ids, {});
assert.deepEqual(cache.canonicalLikedTrackIds, ids, 'fresh complete catalog has all 10 liked IDs');
assert.deepEqual(cache.unavailable, {}, 'old missing-card hints must not outvote complete catalog');
const first = await service.getExploreLikedTracks({ uid: 'A' }, ids);
assert.equal(first.length, 10, 'My Likes returns all 10 cached/fetched song cards');
assert.deepEqual(requests, [ids.slice(5)], 'fetch ONLY five missing cards, not entire catalog');
const second = await service.getExploreLikedTracks({ uid: 'A' }, ids);
assert.equal(second.length, 10);
assert.equal(requests.length, 1, 'warm revisit must remain local-only');
service.reconcileExploreLikedTrackCollectionSnapshot127('A', ids, { 'track-10': false });
assert.equal(cache.canonicalLikedTrackIds.includes('track-10'), false,
  'newer unsent unlike must outrank the server snapshot');

// Remote changed-track membership must update the liked-card index even when
// the local heart already matches it; otherwise the two surfaces may diverge.
const start = personal.indexOf('const applyRemoteLikeSignal127 =');
const end = personal.indexOf('\nlet activeLikeSignalUid127', start);
assert.ok(start >= 0 && end > start, 'personal signal owner not found');
const receiver = personal.slice(start, end);
assert.match(receiver, /if \(cache\.get\(item\.trackId\) !== item\.liked\) \{[\s\S]*?\n    \}\n    [\s\S]*?patchExploreLikedTrackMembership\(uid, item\.trackId, item\.liked\);/,
  'accepted changed-track event must repair card index independently of heart equality');
assert.doesNotMatch(receiver, /if \(cache\.get\(item\.trackId\) !== item\.liked\) \{[\s\S]*?patchExploreLikedTrackMembership\(uid, item\.trackId, item\.liked\);[\s\S]*?\n    \}/,
  'card membership must not be gated on a heart value change');
console.log('APP190_PERSONAL_LIKED_CARD_10_OF_10=PASS');
console.log('APP190_MISSING_ONLY_5_FETCH_AND_WARM_R0=PASS');
console.log('APP190_LIVE_OUTBOX_UNLIKE_PROTECTED=PASS');
console.log('APP190_REMOTE_MEMBER_CARD_INDEX_PARITY=PASS');
