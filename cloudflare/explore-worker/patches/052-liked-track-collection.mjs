import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');

const MARKER = 'SORIDRAW_LIKED_TRACK_COLLECTION_052_20260914';
if (source.includes(MARKER)) {
  console.log('[052] liked track collection already applied.');
  process.exit(0);
}
for (const required of [
  'handleMySocialSnapshot042',
  'readExploreLikeR2Bundle',
  'rebuildExploreLikeR2Bundle',
  'requireExploreAuth',
  'track_stats',
]) {
  if (!source.includes(required)) throw new Error(`[052] prerequisite missing: ${required}`);
}

const handlerAnchor = 'async function handleMySocialSnapshot042(request, env, cors) {';
const handlerIndex = source.indexOf(handlerAnchor);
if (handlerIndex < 0) throw new Error('[052] social snapshot handler anchor missing');

const handler = `async function handleMyLikedTracks052(request, env, cors) {
  const authContext = await requireExploreAuth(request);
  let body = null;
  try { body = await request.json(); } catch { throwApi('INVALID_BODY', '좋아요 곡 요청이 올바르지 않습니다.', 400); }
  const raw = Array.isArray(body?.trackIds) ? body.trackIds : [];
  const trackIds = [...new Set(raw.map((value) => String(value || '').trim()).filter(Boolean))].slice(0, 200);
  if (raw.length > 200) throwApi('TOO_MANY_TRACKS', '한 번에 확인할 수 있는 좋아요 곡 수를 초과했습니다.', 400);
  if (trackIds.some((trackId) => trackId.length > 512)) throwApi('INVALID_TRACK_ID', '곡 ID가 올바르지 않습니다.', 400);
  if (!trackIds.length) return json({ ok: true, data: { items: [], unavailableTrackIds: [] } }, 200, cors);

  let likedIds = await readExploreLikeR2Bundle(env, authContext.uid);
  if (!likedIds) {
    await rebuildExploreLikeR2Bundle(env, authContext.uid);
    likedIds = await readExploreLikeR2Bundle(env, authContext.uid);
  }
  if (!likedIds) throwApi('LIKED_TRACK_SNAPSHOT_UNAVAILABLE', '좋아요 곡 상태를 확인하지 못했습니다.', 503);

  const requested = trackIds.filter((trackId) => likedIds.has(trackId));
  if (!requested.length) {
    return json({ ok: true, data: { items: [], unavailableTrackIds: trackIds } }, 200, cors);
  }

  const values = requested.map((_, index) => \`(?,\${index})\`).join(',');
  const result = await env.DB.prepare(\`
    WITH requested(id, sort_order) AS (VALUES \${values})
    SELECT
      t.id,
      t.owner_uid,
      t.owner_nickname,
      t.owner_avatar_url,
      t.title,
      t.cover_url,
      t.suno_url_primary,
      t.suno_url_secondary,
      t.published_at,
      t.profile_pinned,
      COALESCE(s.like_count, 0) AS like_count,
      r.sort_order
    FROM requested r
    JOIN tracks t ON t.id = r.id
    LEFT JOIN track_stats s ON s.track_id = t.id
    WHERE t.is_public = 1 AND t.status = 'published'
    ORDER BY r.sort_order ASC
  \`).bind(...requested).all();

  const items = (result.results || []).map((row) => ({
    id: String(row.id || ''),
    ownerUid: String(row.owner_uid || ''),
    ownerNickname: String(row.owner_nickname || ''),
    ownerAvatarUrl: String(row.owner_avatar_url || ''),
    title: String(row.title || ''),
    coverUrl: String(row.cover_url || ''),
    sunoUrlPrimary: String(row.suno_url_primary || ''),
    openUrl: String(row.suno_url_primary || row.suno_url_secondary || ''),
    likeCount: Math.max(0, Number(row.like_count || 0)),
    publishedAt: Math.max(0, Number(row.published_at || 0)),
    profilePinned: Boolean(row.profile_pinned),
  })).filter((item) => item.id);
  const returned = new Set(items.map((item) => item.id));
  const unavailableTrackIds = trackIds.filter((trackId) => !returned.has(trackId));
  return json({ ok: true, data: { items, unavailableTrackIds } }, 200, cors);
}

`;
source = source.slice(0, handlerIndex) + handler + source.slice(handlerIndex);

const routeAnchor = `    if (url.pathname === "/v1/me/social-snapshot" && request.method === "GET") {
      return await handleMySocialSnapshot042(request, env, cors);
    }`;
const routeCount = source.split(routeAnchor).length - 1;
if (routeCount !== 1) throw new Error(`[052] social snapshot route anchor count=${routeCount}`);
source = source.replace(routeAnchor, `    if (url.pathname === "/v1/me/liked-tracks" && request.method === "POST") {
      return await handleMyLikedTracks052(request, env, cors);
    }
${routeAnchor}`);

source += `\n\n// ${MARKER}\n`;

for (const required of [
  'handleMyLikedTracks052',
  '"/v1/me/liked-tracks"',
  'readExploreLikeR2Bundle(env, authContext.uid)',
  'JOIN tracks t ON t.id = r.id',
  'LEFT JOIN track_stats s ON s.track_id = t.id',
  't.is_public = 1',
  "t.status = 'published'",
]) {
  if (!source.includes(required)) throw new Error(`[052] final worker missing: ${required}`);
}
if (source.includes('WHERE t.owner_uid = ? AND t.id IN')) {
  throw new Error('[052] owner-wide liked track scan introduced');
}

writeFileSync(workerPath, source, 'utf8');
console.log('[052] liked track collection resolves only viewer-liked missing IDs with bounded PK joins; no schema change or mutation-time read added.');
