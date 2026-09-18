import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const MARKER = 'SORIDRAW_LIKED_TRACK_SCHEMA_REPAIR_053_20260914';
if (source.includes(MARKER)) {
  console.log('[053] liked track schema repair already applied.');
  process.exit(0);
}
if (!source.includes('SORIDRAW_LIKED_TRACK_COLLECTION_052_20260914')) {
  throw new Error('[053] Worker 052 liked collection prerequisite missing.');
}

const emptyBefore = "  if (!trackIds.length) return json({ ok: true, data: { items: [], unavailableTrackIds: [] } }, 200, cors);\n\n  let likedIds = await readExploreLikeR2Bundle(env, authContext.uid);";
const emptyAfter = "  let likedIds = await readExploreLikeR2Bundle(env, authContext.uid);";
if (source.split(emptyBefore).length - 1 !== 1) throw new Error('[053] empty-request anchor count mismatch');
source = source.replace(emptyBefore, emptyAfter);

const likedAnchor = "  if (!likedIds) throwApi('LIKED_TRACK_SNAPSHOT_UNAVAILABLE', '좋아요 곡 상태를 확인하지 못했습니다.', 503);\n\n  const requested = trackIds.filter((trackId) => likedIds.has(trackId));";
const likedReplacement = "  if (!likedIds) throwApi('LIKED_TRACK_SNAPSHOT_UNAVAILABLE', '좋아요 곡 상태를 확인하지 못했습니다.', 503);\n\n  const canonicalLikedTrackIds = [...likedIds];\n  if (!trackIds.length) {\n    return json({ ok: true, data: { likedTrackIds: canonicalLikedTrackIds, items: [], unavailableTrackIds: [] } }, 200, cors);\n  }\n\n  const requested = trackIds.filter((trackId) => likedIds.has(trackId));";
if (source.split(likedAnchor).length - 1 !== 1) throw new Error('[053] liked bundle anchor count mismatch');
source = source.replace(likedAnchor, likedReplacement);

const noRequestedBefore = "    return json({ ok: true, data: { items: [], unavailableTrackIds: trackIds } }, 200, cors);";
const noRequestedAfter = "    return json({ ok: true, data: { likedTrackIds: canonicalLikedTrackIds, items: [], unavailableTrackIds: trackIds } }, 200, cors);";
if (source.split(noRequestedBefore).length - 1 !== 1) throw new Error('[053] empty intersection response anchor count mismatch');
source = source.replace(noRequestedBefore, noRequestedAfter);

const ownerColumnsBefore = "      t.owner_uid,\n      t.owner_nickname,\n      t.owner_avatar_url,";
const ownerColumnsAfter = "      t.owner_uid,\n      p.nickname AS owner_nickname,\n      p.avatar_url AS owner_avatar_url,";
if (source.split(ownerColumnsBefore).length - 1 !== 1) throw new Error('[053] invalid track owner columns anchor count mismatch');
source = source.replace(ownerColumnsBefore, ownerColumnsAfter);

const joinBefore = "    JOIN tracks t ON t.id = r.id\n    LEFT JOIN track_stats s ON s.track_id = t.id";
const joinAfter = "    JOIN tracks t ON t.id = r.id\n    LEFT JOIN profiles p ON p.uid = t.owner_uid\n    LEFT JOIN track_stats s ON s.track_id = t.id";
if (source.split(joinBefore).length - 1 !== 1) throw new Error('[053] track join anchor count mismatch');
source = source.replace(joinBefore, joinAfter);

const finalBefore = "  return json({ ok: true, data: { items, unavailableTrackIds } }, 200, cors);";
const finalAfter = "  return json({ ok: true, data: { likedTrackIds: canonicalLikedTrackIds, items, unavailableTrackIds } }, 200, cors);";
if (source.split(finalBefore).length - 1 !== 1) throw new Error('[053] final response anchor count mismatch');
source = source.replace(finalBefore, finalAfter);

source += `\n\n// ${MARKER}\n`;

for (const required of [
  'canonicalLikedTrackIds',
  'p.nickname AS owner_nickname',
  'p.avatar_url AS owner_avatar_url',
  'LEFT JOIN profiles p ON p.uid = t.owner_uid',
  'likedTrackIds: canonicalLikedTrackIds',
]) {
  if (!source.includes(required)) throw new Error(`[053] final Worker missing: ${required}`);
}
if (source.includes('t.owner_nickname') || source.includes('t.owner_avatar_url')) {
  throw new Error('[053] invalid tracks owner profile columns remain');
}

writeFileSync(workerPath, source, 'utf8');
console.log('[053] liked collection uses profile join for owner metadata and exposes canonical R2 liked IDs without D1 on empty verification requests.');
