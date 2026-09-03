import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required.');
const workerPath = join(remoteDir, 'worker.js');
let source = readFileSync(workerPath, 'utf8');
const marker = 'SORIDRAW_COST_ZERO_PROFILE_FIRST_VIEW_003';
if (source.includes(marker) || source.includes('handlePublicProfileFirstViewSnapshot')) {
  console.log('[SORIDRAW Worker] Cost-Zero profile first-view endpoint already present.');
  process.exit(0);
}

const handlerAnchor = 'async function handlePublicProfile(profileRef, env, cors) {';
if (!source.includes(handlerAnchor)) throw new Error('003 public profile handler anchor missing');

const helpers = `// SORIDRAW_COST_ZERO_PROFILE_FIRST_VIEW_003
async function handlePublicProfileFirstViewSnapshot(profileRef, env, cors) {
  const ref = String(profileRef || "").trim().replace(/^@+/, "");
  if (!ref) return apiError("NOT_FOUND", "공개 프로필을 찾을 수 없습니다.", 404, cors);
  let row = null;
  try {
    row = await env.DB.prepare(\`
      SELECT uid, handle, schema_version, revision, payload_json, next_cursor, updated_at
      FROM public_profile_first_views
      WHERE uid = ? OR handle = ? COLLATE NOCASE
      ORDER BY CASE WHEN uid = ? THEN 0 ELSE 1 END
      LIMIT 1
    \`).bind(ref, ref, ref).first();
  } catch (error) {
    const message = String(error?.message || error || "");
    if (message.includes("no such table") || message.includes("public_profile_first_views")) {
      return apiError("FIRST_VIEW_SNAPSHOT_UNAVAILABLE", "공개 프로필 스냅샷을 준비 중입니다.", 404, cors);
    }
    throw error;
  }
  if (!row) return apiError("FIRST_VIEW_SNAPSHOT_MISS", "공개 프로필 스냅샷을 준비 중입니다.", 404, cors);
  let snapshot = null;
  try {
    snapshot = JSON.parse(String(row.payload_json || "{}"));
  } catch {
    return apiError("FIRST_VIEW_SNAPSHOT_INVALID", "공개 프로필 스냅샷을 다시 준비해야 합니다.", 409, cors);
  }
  if (!snapshot || typeof snapshot !== "object" || !snapshot.profile) {
    return apiError("FIRST_VIEW_SNAPSHOT_INVALID", "공개 프로필 스냅샷을 다시 준비해야 합니다.", 409, cors);
  }
  return json({
    ok: true,
    data: {
      ...snapshot,
      nextCursor: row.next_cursor || snapshot.nextCursor || null,
      revision: Number(row.revision || 0),
      schemaVersion: Number(row.schema_version || 1),
      updatedAt: Number(row.updated_at || 0)
    }
  }, 200, cors);
}

`;
source = source.replace(handlerAnchor, helpers + handlerAnchor);

const routeAnchor = 'if (request.method === "GET" && segments.length === 4 && segments[0] === "v1" && segments[1] === "profiles" && segments[3] === "tracks") {';
if (!source.includes(routeAnchor)) throw new Error('003 profile tracks route anchor missing');
const firstViewRoute = `if (request.method === "GET" && segments.length === 4 && segments[0] === "v1" && segments[1] === "profiles" && segments[3] === "first-view") {
      return await handlePublicProfileFirstViewSnapshot(decodeURIComponent(segments[2]), env, cors);
    }
    `;
source = source.replace(routeAnchor, firstViewRoute + routeAnchor);

if (!source.includes('handlePublicProfileFirstViewSnapshot(decodeURIComponent(segments[2]), env, cors)')) {
  throw new Error('003 route verification failed');
}
writeFileSync(workerPath, source, 'utf8');
console.log('[SORIDRAW Worker] Cost-Zero profile first-view snapshot endpoint prepared (no D1 migration/backfill performed).');
