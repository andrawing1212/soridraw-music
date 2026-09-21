import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const remoteDir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!remoteDir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required');
const path = join(remoteDir, 'worker.js');
let source = readFileSync(path, 'utf8');
const marker = 'SORIDRAW_LIKE_D1ONLY_ROUTE_172_20260921';
if (source.includes(marker)) {
  console.log('[082/172] D1-only route already applied.');
  process.exit(0);
}
for (const needed of [
  'SORIDRAW_BATCH_LIKE_FINAL_CUTOVER_FREEZE_169_20260921',
  'SORIDRAW_DIRECT_LIKE_ATOMIC_D1_BATCH_168_20260921',
  'SORIDRAW_LIKE_CUTOVER_PRECONDITION_PROOF_164_20260921',
]) {
  if (!source.includes(needed)) throw new Error('[082/172] predecessor missing: ' + needed);
}

// 1) Inject the audited 171 canonical adapter as dormant runtime code.
const runtimePath = new URL('../runtime/like-d1only-171.mjs', import.meta.url);
let runtime = readFileSync(runtimePath, 'utf8');
runtime = runtime.replace('export function createLikeD1OnlyCanonical171', 'function createLikeD1OnlyCanonical171');
if (!runtime.includes('SORIDRAW_LIKE_D1ONLY_CANONICAL_171_20260921') ||
    !runtime.includes('rowsWritten !== 2') ||
    !runtime.includes('revision-conflict')) {
  throw new Error('[082/172] unreviewed 171 runtime fragment');
}
const directAnchor = 'async function handleLikeD1Core(request, env, cors, trackId, shouldLike) {';
if (source.split(directAnchor).length !== 2) throw new Error('[082/172] direct handler anchor changed');
source = source.replace(directAnchor, runtime + '\n// ' + marker + '\n' + directAnchor);

// 2) Extend the shared cutover manifest reader. Existing overlay157 schema v1
// remains valid; 171 requires a distinct schema v2 proof and can never be
// activated merely by a caller boolean.
const readStart = source.indexOf('async function readLikeCutoverState162(env) {');
const readEnd = source.indexOf('\n}', readStart);
if (readStart < 0 || readEnd <= readStart) throw new Error('[082/172] cutover reader missing');
let readBody = source.slice(readStart, readEnd + 2);
const proofAnchor = "  const proof164 = value?.preCutoverProof164;\n";
if (readBody.split(proofAnchor).length !== 2) throw new Error('[082/172] proof164 anchor changed');
readBody = readBody.replace(proofAnchor, `  if (Number(value?.schemaVersion) === 2 || value?.relationMode === 'd1only171') {
    const proof172 = value?.preCutoverProof172;
    const queueRows172 = proof172?.legacyQueueRows || {};
    const queuesDrained172 = ['035', '066', '069', '075'].every((key) =>
      Number.isSafeInteger(queueRows172[key]) && queueRows172[key] === 0
    );
    const shaMap172 = proof172?.workerSha256ByEnvironment || {};
    const versionMap172 = proof172?.workerVersionByEnvironment || {};
    const markerMap172 = proof172?.workerMarkerReadyByEnvironment || {};
    const allWorkerEvidence172 = ['preview', 'test', 'production'].every((stage) =>
      /^[0-9a-f]{64}$/i.test(String(shaMap172?.[stage] || '')) &&
      String(versionMap172?.[stage] || '').trim().length > 0 &&
      markerMap172?.[stage] === true
    );
    const proofReady172 = Number(proof172?.schemaVersion) === 1 &&
      proof172?.proofAuthority === 'release-controller-173' &&
      Number.isSafeInteger(Number(proof172?.observedAt)) && Number(proof172.observedAt) > 0 &&
      proof172?.legacyIntakeClosed === true &&
      queuesDrained172 &&
      Number(proof172?.queueStablePasses) === 2 &&
      proof172?.legacyProcessorIdle === true &&
      proof172?.allEnvironmentWorkerShaVerified === true &&
      allWorkerEvidence172 &&
      /^[0-9a-f]{64}$/i.test(String(proof172?.drainTokenHash || '')) &&
      Number(proof172?.drainQuiescenceMs) >= 30000 &&
      proof172?.d1OnlySchemaOwnerReady === true &&
      proof172?.d1OnlySchemaOwner === 'shared-d1' &&
      Number(proof172?.d1OnlyHotSecondaryIndexes) === 0 &&
      proof172?.relationTable === 'explore_like_overrides_171' &&
      proof172?.countTable === 'explore_like_count_deltas_171' &&
      proof172?.ownerProtocol === 'd1-only-171';
    const armed172 = Number(value?.schemaVersion) === 2 &&
      value?.relationMode === 'd1only171' &&
      value?.legacyRelationWritersFrozen === true &&
      value?.legacyCountWritersFrozen === true &&
      value?.allEnvironmentReadersReady === true &&
      value?.allEnvironmentWritersReady === true &&
      value?.ownerProtocol === 'd1-only-171' &&
      proofReady172 &&
      token.length > 0 && token.length <= 128;
    if (!armed172) throw new Error('172 D1-only cutover manifest present but not fully armed');
    return { mode: 'd1only171', cutoverToken: token };
  }
` + proofAnchor);
source = source.slice(0, readStart) + readBody + source.slice(readEnd + 2);

// 3) Any final relation mode freezes legacy scheduled/direct writers.
source = source.replace(
  "  if (state?.mode === 'overlay157') {\n    throw new Error('[SORIDRAW 163] legacy like writer frozen after shared cutover: ' + String(writerName || 'unknown'));\n  }\n  if (!state || state.mode !== 'legacy') {",
  "  if (state && state.mode !== 'legacy') {\n    throw new Error('[SORIDRAW 163] legacy like writer frozen after shared cutover: ' + String(writerName || 'unknown'));\n  }\n  if (!state || state.mode !== 'legacy') {"
);

// 4) The bounded visible-ID reader supports both immutable-baseline overlays.
const boundedStart = source.indexOf('async function readBoundedEffectiveLikeMemberships162(env, uid, trackIds) {');
const boundedEnd = source.indexOf('\n}', boundedStart);
if (boundedStart < 0 || boundedEnd <= boundedStart) throw new Error('[082/172] bounded reader missing');
let bounded = source.slice(boundedStart, boundedEnd + 2);
const oldLegacyBranch = `  if (cutover.mode !== 'overlay157') {
    return {
      likedIds: await readBoundedLegacyLikeMemberships161(env, normalized, ids),
      mode: 'legacy',
      cutoverToken: null,
    };
  }
  const values = ids.map(() => '(?)').join(',');
  const result = await env.DB.prepare(
    'WITH requested(track_id) AS (VALUES ' + values + ') ' +
    'SELECT r.track_id FROM requested r ' +
    'JOIN tracks t ON t.id = r.track_id ' +
    'LEFT JOIN likes l ON l.track_id = r.track_id AND l.user_uid = ? ' +
    'LEFT JOIN explore_like_overrides_157 o ON o.user_uid = ? AND o.track_id = r.track_id ' +
    "WHERE t.is_public = 1 AND t.status = 'published' " +
    'AND COALESCE(o.liked, CASE WHEN l.user_uid IS NULL THEN 0 ELSE 1 END) = 1'
  ).bind(...ids, normalized, normalized).all();`;
if (bounded.split(oldLegacyBranch).length !== 2) throw new Error('[082/172] bounded overlay branch changed');
const newLegacyBranch = `  if (cutover.mode === 'legacy') {
    return {
      likedIds: await readBoundedLegacyLikeMemberships161(env, normalized, ids),
      mode: 'legacy',
      cutoverToken: null,
    };
  }
  if (cutover.mode !== 'overlay157' && cutover.mode !== 'd1only171') {
    throw new Error('172 unknown like relation mode');
  }
  const values = ids.map(() => '(?)').join(',');
  const overlayTable = cutover.mode === 'd1only171'
    ? 'explore_like_overrides_171' : 'explore_like_overrides_157';
  const result = await env.DB.prepare(
    'WITH requested(track_id) AS (VALUES ' + values + ') ' +
    'SELECT r.track_id FROM requested r ' +
    'JOIN tracks t ON t.id = r.track_id ' +
    'LEFT JOIN likes l ON l.track_id = r.track_id AND l.user_uid = ? ' +
    'LEFT JOIN ' + overlayTable + ' o ON o.user_uid = ? AND o.track_id = r.track_id ' +
    "WHERE t.is_public = 1 AND t.status = 'published' " +
    'AND COALESCE(o.liked, CASE WHEN l.user_uid IS NULL THEN 0 ELSE 1 END) = 1'
  ).bind(...ids, normalized, normalized).all();`;
bounded = bounded.replace(oldLegacyBranch, newLegacyBranch);
bounded = bounded.replace(
  "  return { likedIds: new Set(liked), mode: 'overlay157', cutoverToken: cutover.cutoverToken };",
  "  return { likedIds: new Set(liked), mode: cutover.mode, cutoverToken: cutover.cutoverToken };"
);
source = source.slice(0, boundedStart) + bounded + source.slice(boundedEnd + 2);

// 5) Direct bodyless PUT/DELETE cannot safely invent a 171 revision. It fails
// closed after final cutover; the current app uses /v1/me/likes/batch.
const directStart2 = source.indexOf(directAnchor);
const directEnd2 = source.indexOf('\n}', directStart2);
let direct = source.slice(directStart2, directEnd2 + 2);
const directGuard = `  await enforceExploreLikeBatchEdgeRateLimit054(env, authContext.uid);
  await assertLegacyLikeIntakeOpen165(env);
  await assertLegacyLikeWriterOpen163(env, 'direct-like');`;
if (direct.split(directGuard).length !== 2) throw new Error('[082/172] direct legacy guards changed');
direct = direct.replace(directGuard, `  await enforceExploreLikeBatchEdgeRateLimit054(env, authContext.uid);
  const cutover172 = await readLikeCutoverState162(env);
  if (cutover172.mode === 'd1only171') {
    throwApi('LIKE_CLIENT_REFRESH_REQUIRED', '좋아요 저장 방식을 업데이트했습니다. 새로고침 후 다시 시도해 주세요.', 409);
  }
  if (cutover172.mode !== 'legacy') {
    throwApi('LIKE_CUTOVER_STATE_UNAVAILABLE', '좋아요 전환 상태를 확인 중입니다. 잠시 후 다시 시도해 주세요.', 503, { 'Retry-After': '30' });
  }
  await assertLegacyLikeIntakeOpen165(env);`);
source = source.slice(0, directStart2) + direct + source.slice(directEnd2 + 2);

// 6) Batch parses operationId/expectedRevision but legacy ignores them.
const batchStart = source.indexOf('async function handleLikeBatch034(request, env, cors) {');
const batchEnd = source.indexOf('\n}', batchStart);
if (batchStart < 0 || batchEnd <= batchStart) throw new Error('[082/172] batch handler missing');
let batch = source.slice(batchStart, batchEnd + 2);
const parseAnchor = `    const baseLiked = typeof row?.baseLiked === 'boolean' ? row.baseLiked : null;
    const likeCount = clampExploreSocialCount(row?.likeCount);
    byTrack.set(trackId, { trackId, liked: row.liked, baseLiked, mutationAt, likeCount });`;
if (batch.split(parseAnchor).length !== 2) throw new Error('[082/172] batch parse anchor changed');
batch = batch.replace(parseAnchor, `    const baseLiked = typeof row?.baseLiked === 'boolean' ? row.baseLiked : null;
    const likeCount = clampExploreSocialCount(row?.likeCount);
    const operationId = String(row?.operationId || '').trim();
    const rawExpectedRevision = Number(row?.expectedRevision);
    const expectedRevision = Number.isSafeInteger(rawExpectedRevision) && rawExpectedRevision >= 0
      ? rawExpectedRevision : null;
    byTrack.set(trackId, {
      trackId, liked: row.liked, baseLiked, mutationAt, likeCount,
      operationId, expectedRevision,
    });`);

const guardAnchor = `  const mutations = [...byTrack.values()];
  await enforceExploreLikeBatchEdgeRateLimit054(env, authContext.uid);
  await assertLegacyLikeIntakeOpen165(env);
  // SORIDRAW_BATCH_LIKE_FINAL_CUTOVER_FREEZE_169_20260921
  await assertLegacyLikeWriterOpen163(env, 'batch-like-intake');`;
if (batch.split(guardAnchor).length !== 2) throw new Error('[082/172] batch guard anchor changed');
batch = batch.replace(guardAnchor, `  const mutations = [...byTrack.values()];
  await enforceExploreLikeBatchEdgeRateLimit054(env, authContext.uid);
  const cutover172 = await readLikeCutoverState162(env);
  if (cutover172.mode === 'd1only171') {
    const canonical171 = createLikeD1OnlyCanonical171(env.DB, { cutoverVerified: true });
    const results171 = [];
    for (const mutation of mutations) {
      if (!mutation.operationId || mutation.operationId.length > 128 ||
          !Number.isSafeInteger(mutation.expectedRevision) || mutation.expectedRevision < 0) {
        throwApi('LIKE_CLIENT_REFRESH_REQUIRED', '좋아요 저장 방식을 업데이트했습니다. 새로고침 후 다시 시도해 주세요.', 409);
      }
      const settled = await canonical171.applyAtomically(
        authContext.uid,
        mutation.trackId,
        mutation.liked,
        {
          expectedRevision: mutation.expectedRevision,
          operationId: mutation.operationId,
          now: receivedAt,
        },
      );
      results171.push({
        trackId: mutation.trackId,
        liked: settled.liked,
        likeCount: settled.likeCount,
        revision: settled.revision,
        generation: settled.generation,
        operationId: settled.operationId || mutation.operationId,
        status: settled.status,
      });
    }
    return json({
      ok: true,
      data: {
        results: results171,
        queued: false,
        batchId: null,
        queue: 'd1only171',
        canonicalD1: 'settled',
        personalLikeSnapshot: 'pending',
      },
    }, 200, cors);
  }
  if (cutover172.mode !== 'legacy') {
    throwApi('LIKE_CUTOVER_STATE_UNAVAILABLE', '좋아요 전환 상태를 확인 중입니다. 잠시 후 다시 시도해 주세요.', 503, { 'Retry-After': '30' });
  }
  await assertLegacyLikeIntakeOpen165(env);
  // SORIDRAW_BATCH_LIKE_FINAL_CUTOVER_FREEZE_169_20260921
  // Final marker state was read above; only legacy mode reaches this queue.`);
source = source.slice(0, batchStart) + batch + source.slice(batchEnd + 2);

if (!source.includes(marker) ||
    !source.includes("queue: 'd1only171'") ||
    !source.includes("mode: 'd1only171'") ||
    !source.includes('explore_like_count_deltas_171')) {
  throw new Error('[082/172] expected route markers missing after patch');
}
writeFileSync(path, source, 'utf8');
console.log('[082/172] D1-only W2 route staged behind unarmed schema-v2 shared cutover manifest.');
