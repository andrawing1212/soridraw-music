import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const marker = 'SORIDRAW_LIKE_075_SHARED_COUNT_PARITY_067_20260919';
if (source.includes(marker)) {
  console.log('[067] already applied.');
  process.exit(0);
}

for (const required of [
  'processExploreLikeUserQueueWave075',
  'patchSharedFeedLikeCounts065',
  'patchExploreFeedR2Like044',
  'patchExploreProfileR2Like044',
]) {
  if (!source.includes(required)) throw new Error('[067] required runtime missing: ' + required);
}

const anchor = [
  '  await Promise.allSettled(changedRows.flatMap((row) => {',
  "    const trackId = String(row?.track_id || '').trim();",
  "    const ownerUid = String(row?.owner_uid || '').trim();",
  "    const likeCount = Math.max(0, Number(row?.next_like_count || 0));",
  '    return [',
  '      patchExploreFeedR2Like044(env, trackId, likeCount),',
  '      patchExploreProfileR2Like044(env, ownerUid, trackId, likeCount),',
  '    ];',
  '  }));',
  '',
  '  return {',
].join('\n');

const replacement = [
  '  await Promise.allSettled(changedRows.flatMap((row) => {',
  "    const trackId = String(row?.track_id || '').trim();",
  "    const ownerUid = String(row?.owner_uid || '').trim();",
  "    const likeCount = Math.max(0, Number(row?.next_like_count || 0));",
  '    return [',
  '      patchExploreFeedR2Like044(env, trackId, likeCount),',
  '      patchExploreProfileR2Like044(env, ownerUid, trackId, likeCount),',
  '    ];',
  '  }));',
  '',
  '  // SORIDRAW_LIKE_075_SHARED_COUNT_PARITY_067_20260919',
  '  // 075 is the active like path. Patch only changed tracks into shared R2.',
  '  if (changedRows.length) {',
  '    const sharedRows067 = changedRows.map((row) => ({',
  "      trackId: String(row?.track_id || '').trim(),",
  "      ownerUid: String(row?.owner_uid || '').trim(),",
  "      likeCount: Math.max(0, Number(row?.next_like_count || 0)),",
  '    })).filter((row) => row.trackId);',
  '    if (sharedRows067.length) {',
  '      try {',
  '        await patchSharedFeedLikeCounts065(env, sharedRows067);',
  '      } catch (error) {',
  "        console.warn('[SORIDRAW 067] 075 shared like-count patch deferred:', String(error?.message || error || 'unknown'));",
  '      }',
  '    }',
  '  }',
  '',
  '  return {',
].join('\n');

const count = source.split(anchor).length - 1;
if (count !== 1) throw new Error('[067] 075 anchor count=' + count);
source = source.replace(anchor, replacement);

const start = source.indexOf('async function processExploreLikeUserQueueWave075');
const end = source.indexOf('// SORIDRAW_LIKED_TRACK_PUBLIC_PROFILE_JOIN_056_20260915', start);
const patched = start >= 0 && end > start ? source.slice(start, end) : '';
for (const required of [
  marker,
  'patchSharedFeedLikeCounts065(env, sharedRows067)',
  'patchExploreFeedR2Like044(env, trackId, likeCount)',
  'patchExploreProfileR2Like044(env, ownerUid, trackId, likeCount)',
]) {
  if (!patched.includes(required)) throw new Error('[067] final runtime missing: ' + required);
}

const addedStart = patched.indexOf(marker);
const addedEnd = patched.indexOf('  return {', addedStart);
const added = addedStart >= 0 && addedEnd > addedStart ? patched.slice(addedStart, addedEnd) : '';
if (added.includes('env.DB') || added.includes('.prepare(') || added.includes('.batch(')) {
  throw new Error('[067] shared parity block must not add D1 work');
}
if (added.includes('mirrorExploreSharedFeeds059')) {
  throw new Error('[067] shared parity must not rebuild entire Feed');
}

writeFileSync(workerPath, source, 'utf8');
console.log('[067] Active 075 like path patches changed tracks into shared latest/popular/card R2 only; no extra D1.');
