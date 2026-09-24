import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.env.SORIDRAW_REMOTE_WORKER_DIR;
if (!dir) throw new Error('SORIDRAW_REMOTE_WORKER_DIR is required');
const path = join(dir, 'worker.js');
let source = readFileSync(path, 'utf8');
const marker = 'SORIDRAW_PUBLIC_LIKE_DURABLE_RETRY_190_20260924';
if (source.includes(marker)) { console.log('[089/190] already applied'); process.exit(0); }
for (const required of ['async function processExploreLikeBatches035(', 'patchSharedFeedLikeCounts065', 'publicProjectionDetail?.changedItems']) {
  if (!source.includes(required)) throw new Error('[089/190] prerequisite missing: ' + required);
}
const start = source.indexOf('async function processExploreLikeBatches035(');
const end = source.indexOf('\n}', start);
if (start < 0 || end < 0) throw new Error('[089/190] aggregate wrapper missing');
const oldBody = source.slice(start, end + 2);
const expected = `async function processExploreLikeBatches035(env, scheduledTime = Date.now()) {
  const totals = await processExploreLikeBatches035Core065(env, scheduledTime);
  const changedItems = Array.isArray(totals?.publicProjectionDetail?.changedItems)
    ? totals.publicProjectionDetail.changedItems
    : [];
  if (!changedItems.length) return totals;
  try {
    totals.sharedLikePatch065 = await patchSharedFeedLikeCounts065(env, changedItems);
  } catch (error) {
    console.warn('[SORIDRAW 065] targeted shared like-count patch deferred:', String(error?.message || error || 'unknown'));
    totals.sharedLikePatch065 = { rows: changedItems.length, deferred: true };
  }
  return totals;
}`;
if (oldBody !== expected) throw new Error('[089/190] aggregate wrapper changed');
const helpers = `// ${marker}
const EXPLORE_PUBLIC_LIKE_RETRY_KEY_190 = 'internal/explore/public-like-retry-v190/pending.json';
const EXPLORE_PUBLIC_LIKE_RETRY_LIMIT_190 = 3;

async function readPublicLikeRetry190(bucket) {
  const object = await bucket.get(EXPLORE_PUBLIC_LIKE_RETRY_KEY_190);
  if (!object) return { object: null, rows: [] };
  let value = null;
  try { value = JSON.parse(await object.text()); } catch { value = null; }
  return { object, rows: normalizeSharedLikeRows065(value?.rows) };
}

async function mergePublicLikeRetry190(bucket, rows) {
  for (let attempt = 0; attempt < EXPLORE_PUBLIC_LIKE_RETRY_LIMIT_190; attempt += 1) {
    const current = await readPublicLikeRetry190(bucket);
    const merged = normalizeSharedLikeRows065([...(current.rows || []), ...(rows || [])]);
    if (!merged.length) return [];
    const saved = await bucket.put(EXPLORE_PUBLIC_LIKE_RETRY_KEY_190, JSON.stringify({ schemaVersion: 1, rows: merged, updatedAt: Date.now() }), {
      onlyIf: current.object?.etag ? { etagMatches: current.object.etag } : { etagDoesNotMatch: '*' },
      httpMetadata: { contentType: 'application/json; charset=utf-8' },
      customMetadata: { soridrawPublicLikeRetry: '190' },
    });
    if (saved) return merged;
  }
  throw new Error('public like retry ledger CAS contention');
}

async function drainPublicLikeRetry190(env) {
  const bucket = env?.PROFILE_MEDIA || null;
  if (!bucket) return { skipped: true, reason: 'binding' };
  for (let attempt = 0; attempt < EXPLORE_PUBLIC_LIKE_RETRY_LIMIT_190; attempt += 1) {
    const pending = await readPublicLikeRetry190(bucket);
    if (!pending.rows.length) return { drained: true, rows: 0 };
    try {
      const result = await patchSharedFeedLikeCounts065(env, pending.rows);
      await patchExploreVisibleProfiles056(env, pending.rows);
      await bucket.delete(EXPLORE_PUBLIC_LIKE_RETRY_KEY_190);
      return { drained: true, rows: pending.rows.length, result };
    } catch (error) {
      if (attempt + 1 >= EXPLORE_PUBLIC_LIKE_RETRY_LIMIT_190) {
        return { drained: false, rows: pending.rows.length, deferred: true, error: String(error?.message || error || 'unknown') };
      }
    }
  }
  return { drained: false, deferred: true };
}
`;
const replacement = `async function processExploreLikeBatches035(env, scheduledTime = Date.now()) {
  const totals = await processExploreLikeBatches035Core065(env, scheduledTime);
  const changedItems = Array.isArray(totals?.publicProjectionDetail?.changedItems)
    ? totals.publicProjectionDetail.changedItems
    : [];
  const bucket = env?.PROFILE_MEDIA || null;
  if (changedItems.length && bucket) {
    try { await mergePublicLikeRetry190(bucket, changedItems); }
    catch (error) {
      console.warn('[SORIDRAW 190] public like retry ledger deferred:', String(error?.message || error || 'unknown'));
      totals.sharedLikeRetry190 = { durable: false, rows: changedItems.length, deferred: true };
      return totals;
    }
  }
  try {
    totals.sharedLikeRetry190 = await drainPublicLikeRetry190(env);
  } catch (error) {
    console.warn('[SORIDRAW 190] public like projection retry deferred:', String(error?.message || error || 'unknown'));
    totals.sharedLikeRetry190 = { durable: Boolean(bucket), deferred: true };
  }
  return totals;
}`;
source = source.slice(0, start) + helpers + '\n' + replacement + source.slice(end + 2);
writeFileSync(path, source);
console.log('[089/190] changed public like rows persist in a bounded R2 retry ledger until shared surfaces converge.');
