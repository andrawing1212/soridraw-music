import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const liked = readFileSync('src/services/exploreLikedTracksService.ts', 'utf8');

const sliceFunction = (startNeedle, nextNeedle) => {
  const start = liked.indexOf(startNeedle);
  assert.ok(start >= 0, `missing ${startNeedle}`);
  const end = nextNeedle ? liked.indexOf(nextNeedle, start + startNeedle.length) : liked.length;
  assert.ok(end > start, `missing end for ${startNeedle}`);
  return liked.slice(start, end);
};

assert.ok(liked.includes('SORIDRAW_EXPLORE_LIKED_CARD_RETENTION_100_20260916'));
assert.match(liked, /const LIKED_TRACK_CACHE_SCHEMA_VERSION = 1;/);
assert.match(liked, /const LIKED_TRACK_DORMANT_CARD_MAX = 100;/);
assert.match(liked, /const LIKED_TRACK_DORMANT_CARD_TTL_MS = 7 \* 24 \* 60 \* 60_000;/);
assert.ok(liked.includes('dormantSince: Record<string, number>'));
assert.ok(liked.includes('const trimDormantCards = (data: LikedTrackCacheData) =>'));
assert.ok(liked.includes('if (data.canonicalLikedTrackIds === null) return;'));

const membership = sliceFunction(
  'export const patchExploreLikedTrackMembership',
  'export const invalidateExploreLikedTrackCollection',
);
assert.ok(!membership.includes('delete cache.items[normalizedTrackId]'));
assert.ok(membership.includes('cache.dormantSince[normalizedTrackId] = Date.now()'));
assert.ok(membership.includes('delete cache.dormantSince[normalizedTrackId]'));

const remember = sliceFunction(
  'export const rememberExploreLikedTrack',
  'export const patchExploreLikedTrackCachedCount091',
);
assert.ok(remember.includes('cache.items[trackId] = { ...(track || {}), id: trackId }'));
assert.ok(!remember.includes('delete cache.items[trackId]'));
assert.ok(remember.includes('cache.dormantSince[trackId] = Date.now()'));

const getter = sliceFunction('export const getExploreLikedTracks', null);
assert.ok(!getter.includes('cache.items = {}'));
assert.ok(!getter.includes('if (!likedSet.has(trackId)) delete cache.items[trackId]'));
assert.ok(getter.includes('const missing = likedTrackIds.filter((trackId) => !cache.items[trackId] && !cache.unavailable[trackId])'));
assert.ok(getter.includes('requestLikedTracks(user, page)'));
assert.ok(getter.includes("recordCloudflareLocalCacheHit(LIKED_TRACK_ROUTE, 'LOCAL HIT · 좋아요 곡 전체 캐시')"));

console.log('PASS 100: unlike/re-like no longer destroys reusable liked-card payloads; active cache schema stays compatible; only genuinely never-cached cards can use targeted recovery.');
