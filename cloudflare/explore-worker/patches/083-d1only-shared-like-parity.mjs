import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required');
const path = join(remoteDir, 'worker.js');
let source = readFileSync(path, 'utf8');
const marker = 'SORIDRAW_D1ONLY_SHARED_LIKE_PARITY_083_20260924';
if (source.includes(marker)) {
  console.log('[083/155] D1-only shared like parity already applied.');
  process.exit(0);
}

for (const needed of [
  'SORIDRAW_LIKE_D1ONLY_ROUTE_172_20260921',
  'async function patchSharedFeedLikeCounts065(',
  'async function patchExploreVisibleProfiles056(',
  "queue: 'd1only171'",
]) {
  if (!source.includes(needed)) throw new Error('[083/155] prerequisite missing: ' + needed);
}

const start = source.indexOf('async function handleLikeBatch034(request, env, cors) {');
const end = source.indexOf('\n}', start);
if (start < 0 || end <= start) throw new Error('[083/155] batch handler missing');
let body = source.slice(start, end + 2);

const parseAnchor = `    byTrack.set(trackId, {
      trackId, liked: row.liked, baseLiked, mutationAt, likeCount,
      operationId, expectedRevision,
    });`;
if (body.split(parseAnchor).length !== 2) throw new Error('[083/155] 172 parse anchor changed');
body = body.replace(parseAnchor, `    byTrack.set(trackId, {
      trackId,
      ownerUid: String(row?.ownerUid || '').trim(),
      liked: row.liked,
      baseLiked,
      mutationAt,
      likeCount,
      operationId,
      expectedRevision,
    });`);

const returnAnchor = `    return json({
      ok: true,
      data: {
        results: results171,
        queued: false,
        batchId: null,
        queue: 'd1only171',
        canonicalD1: 'settled',
        personalLikeSnapshot: 'pending',
      },
    }, 200, cors);`;
if (body.split(returnAnchor).length !== 2) throw new Error('[083/155] d1only return anchor changed');

const replacement = `    // ${marker}
    // Canonical D1 is already settled. Publish only these changed/canonical track
    // counts into the existing R2 projections so other accounts see the same number.
    // This adds no D1 query/write and never rebuilds the full Feed.
    const mutationByTrack155 = new Map(mutations.map((mutation) => [mutation.trackId, mutation]));
    const sharedRows155 = results171
      .filter((row) => row.status !== 'ineligible')
      .map((row) => ({
        trackId: String(row.trackId || '').trim(),
        ownerUid: String(mutationByTrack155.get(row.trackId)?.ownerUid || '').trim(),
        likeCount: Math.max(0, Number(row.likeCount || 0)),
      }))
      .filter((row) => row.trackId);

    if (sharedRows155.length) {
      const projectionResults155 = await Promise.allSettled([
        patchSharedFeedLikeCounts065(env, sharedRows155),
        patchExploreVisibleProfiles056(env, sharedRows155),
      ]);
      for (const result of projectionResults155) {
        if (result.status === 'rejected') {
          console.warn('[SORIDRAW 083] D1-only shared like projection deferred:', String(result.reason?.message || result.reason || 'unknown'));
        }
      }
    }

${returnAnchor}`;
body=body.replace(returnAnchor,replacement);
source=source.slice(0,start)+body+source.slice(end+2);

const finalStart=source.indexOf('async function handleLikeBatch034(request, env, cors) {');
const finalEnd=source.indexOf('\n}',finalStart);
const finalBody=source.slice(finalStart,finalEnd+2);
for(const required of [
  marker,
  "ownerUid: String(row?.ownerUid || '').trim()",
  'patchSharedFeedLikeCounts065(env, sharedRows155)',
  'patchExploreVisibleProfiles056(env, sharedRows155)',
  'Promise.allSettled',
]) {
  if(!finalBody.includes(required)) throw new Error('[083/155] final runtime missing: '+required);
}
const added=finalBody.slice(finalBody.indexOf(marker), finalBody.indexOf(returnAnchor));
if (/env\.DB|\.prepare\s*\(|\.batch\s*\(/.test(added)) {
  throw new Error('[083/155] shared parity block must not add D1 work');
}

writeFileSync(path, source, 'utf8');
console.log('[083/155] D1-only likes now publish changed track counts to shared Feed/Profile/Card R2; no extra D1.');
