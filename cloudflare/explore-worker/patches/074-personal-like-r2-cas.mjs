import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
// Compatible with PREVIEW/TEST/PRODUCTION intake and shared R2 key.
// The unrelated 072 personal revision endpoint is not required for a writer.
const dir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!dir) throw new Error('[074] Worker directory missing');
const path = join(dir, 'worker.js');
let source = readFileSync(path, 'utf8');
const marker = 'SORIDRAW_PERSONAL_LIKE_R2_CAS_074_20260920';
if (source.includes(marker)) { console.log('[074] already applied'); process.exit(0); }
for (const required of [
  'SORIDRAW_SERVER_ORDER_LIKE_QUEUE_073_20260920',
  'async function syncExploreLikeR2AfterBatch034(env, uid, results) {',
  'await syncExploreLikeR2AfterBatch034(env, authContext.uid, results);',
  'exploreSharedLikesKey061',
]) if (!source.includes(required)) throw new Error('[074] missing prerequisite '+required);
const anchor = 'async function syncExploreLikeR2AfterBatch034(env, uid, results) {';
const helper = "// SORIDRAW_PERSONAL_LIKE_R2_CAS_074_20260920\nconst EXPLORE_LIKE_R2_TRACK_ORDER_LIMIT_074 = 128;\nfunction compareLikeOrder074(a, b) {\n  const at = Number(a?.at || 0) - Number(b?.at || 0);\n  if (at) return at > 0 ? 1 : -1;\n  const left = String(a?.batchId || '');\n  const right = String(b?.batchId || '');\n  return left === right ? 0 : left > right ? 1 : -1;\n}\nasync function syncExploreLikeR2AfterBatch074(env, uid, results, acceptedAt, batchId) {\n  const bucket = env?.PROFILE_MEDIA;\n  if (!bucket) return { ok: false, repairNeeded: true, reason: 'shared_r2_unavailable' };\n  const key = exploreSharedLikesKey061(uid);\n  const incoming = { at: Math.floor(Number(acceptedAt || 0)), batchId: String(batchId || '') };\n  if (!Number.isSafeInteger(incoming.at) || incoming.at <= 0) {\n    return { ok: false, repairNeeded: true, reason: 'invalid_server_order' };\n  }\n  for (let attempt = 0; attempt < 12; attempt += 1) {\n    const object = await bucket.get(key);\n    if (!object) return { ok: false, repairNeeded: true, reason: 'shared_r2_cold_requires_canonical_rebuild' };\n    let previous = null;\n    try { previous = JSON.parse(await object.text()); } catch {}\n    if (Number(previous?.schemaVersion) !== 1 || !Array.isArray(previous?.likedTrackIds)) {\n      return { ok: false, repairNeeded: true, reason: 'invalid_shared_r2' };\n    }\n    if (previous.likedTrackIds.length >= 2000) return { ok: false, repairNeeded: true, reason: 'shared_r2_capacity_requires_canonical_rebuild' };\n    const liked = new Set(previous.likedTrackIds.map((id) => String(id || '').trim()).filter(Boolean));\n    const order = previous?.lastLikeOrders074 && typeof previous.lastLikeOrders074 === 'object'\n      ? { ...previous.lastLikeOrders074 } : {};\n    let changed = false;\n    let superseded = false;\n    for (const result of results) {\n      const id = String(result?.trackId || '').trim();\n      if (!id || id.length > 512) continue;\n      const current = order[id];\n      if (current && compareLikeOrder074(current, incoming) >= 0) {\n        // A late ACK may describe an earlier user intention. Never announce\n        // that stale response as the other device's confirmed membership.\n        if (compareLikeOrder074(current, incoming) > 0 || liked.has(id) !== Boolean(result.liked)) superseded = true;\n        continue;\n      }\n      if (result.liked) liked.add(id); else liked.delete(id);\n      order[id] = incoming;\n      changed = true;\n    }\n    if (!changed) return superseded\n      ? { ok: false, repairNeeded: true, reason: 'superseded_like_batch' }\n      : { ok: true, unchanged: true };\n    if (Object.keys(order).length > EXPLORE_LIKE_R2_TRACK_ORDER_LIMIT_074) return { ok: false, repairNeeded: true, reason: 'shared_r2_order_capacity_requires_canonical_rebuild' };\n    if (liked.size > 2000) return { ok: false, repairNeeded: true, reason: 'shared_r2_capacity_requires_canonical_rebuild' };\n    const body = {\n      ...previous, schemaVersion: 1, uid: String(uid || ''),\n      likedTrackIds: [...liked], lastLikeOrders074: order, updatedAt: Date.now(),\n    };\n    const stored = await bucket.put(key, JSON.stringify(body), {\n      onlyIf: { etagMatches: object.etag },\n      httpMetadata: { contentType: 'application/json; charset=utf-8' },\n      customMetadata: { soridrawSharedLikes: '114', updatedAt: String(Date.now()) },\n    });\n    if (stored) return superseded\n      ? { ok: false, repairNeeded: true, reason: 'partially_superseded_like_batch', attempts: attempt + 1 }\n      : { ok: true, attempts: attempt + 1 };\n  }\n  console.warn('[074] shared personal R2 contested; canonical queue retained', String(uid || ''));\n  return { ok: false, repairNeeded: true, reason: 'r2_cas_exhausted' };\n}\n";
if (source.split(anchor).length !== 2) throw new Error('[074] sync anchor ambiguous');
source = source.replace(anchor, helper + anchor);
const call = 'await syncExploreLikeR2AfterBatch034(env, authContext.uid, results);';
if (source.split(call).length !== 2) throw new Error('[074] intake call ambiguous');
// 138: queue ACK is NOT canonical D1 settlement. Never publish personal
// R2 membership before the corresponding likes relation is finalized.
// Existing CAS helper is preserved for a separately verified finalizer.
source = source.replace(call, [
  '// SORIDRAW_LIKE_PRECOMMIT_R2_BLOCK_138_20260921',
  "const personalR2 = { ok: false, repairNeeded: true, reason: 'awaiting_canonical_d1_settlement' };",
].join('\n  '));
const responseAnchor = "      queued: Boolean(effectiveMutations.length),";
if (source.split(responseAnchor).length !== 2) throw new Error('[074] batch response shape changed');
source = source.replace(responseAnchor, [
  "      // A queued D1 mutation and a materialized personal R2 snapshot are",
  "      // separate stages. Do not tell other devices that an R2 update worked",
  "      // when this worker has only accepted the server-side queue.",
  "      personalLikeSnapshot: 'pending',",
  responseAnchor,
].join('\n'));
if (!source.includes(marker) || source.includes(call)) throw new Error('[074] final source invalid');
writeFileSync(path, source, 'utf8');
console.log('[074/138] intake pending-only; finalizer and cross-environment writer cutover remain release-blocked.');
