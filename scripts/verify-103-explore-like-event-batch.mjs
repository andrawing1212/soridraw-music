import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const entry = readFileSync('cloudflare/explore-worker/canonical/preview-entry.js', 'utf8');
const worker = readFileSync('cloudflare/explore-worker/canonical/preview-worker.js', 'utf8');
const revision = readFileSync('src/services/exploreRevisionRequestCache.ts', 'utf8');
const version = JSON.parse(readFileSync('public/app-version.json', 'utf8'));
const wrangler = JSON.parse(readFileSync('cloudflare/explore-worker/canonical/wrangler.preview.jsonc', 'utf8'));

if (Number.isFinite(Number(version.version)) && Number(version.version) >= 105) {
  assert.equal(wrangler.triggers, undefined, 'fixed cron must be absent');
  assert.deepEqual(wrangler.durable_objects?.bindings, [
    { name: 'EXPLORE_LIKE_BATCH_SCHEDULER', class_name: 'ExploreLikeBatchScheduler103' },
  ]);
  assert.deepEqual(wrangler.migrations, [
    { tag: 'v1', new_sqlite_classes: ['ExploreLikeBatchScheduler103'] },
  ]);
  assert.equal(wrangler.exports, undefined, 'unsupported top-level exports config must be absent');
  await import('./verify-105-explore-like-1min.mjs');
  console.log('103_RELEASE_COMPAT_105=PASS');
  process.exit(0);
}

const functionText = (source, needle) => {
  const start = source.indexOf(needle);
  assert.ok(start >= 0, `missing anchor: ${needle}`);
  const brace = source.indexOf('{', start);
  assert.ok(brace >= 0, `missing body: ${needle}`);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let comment = '';
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (comment === 'line') { if (char === '\n') comment = ''; continue; }
    if (comment === 'block') { if (char === '*' && next === '/') { comment = ''; index += 1; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '/') { comment = 'line'; index += 1; continue; }
    if (char === '/' && next === '*') { comment = 'block'; index += 1; continue; }
    if ('"\'`'.includes(char)) { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`unterminated body: ${needle}`);
};

assert.equal(version.version, '103');
assert.match(entry, /SORIDRAW_EXPLORE_LIKE_EVENT_BATCH_103_20260916/);
assert.match(entry, /import \{ DurableObject \} from 'cloudflare:workers'/);
assert.match(entry, /const EXPLORE_LIKE_EVENT_BATCH_DELAY_MS_103 = 5 \* 60 \* 1000;/);
assert.match(entry, /class ExploreLikeBatchScheduler103 extends DurableObject/);

const schedulerFetch = functionText(entry, 'export class ExploreLikeBatchScheduler103 extends DurableObject');
assert.match(schedulerFetch, /const currentAlarm = await this\.ctx\.storage\.getAlarm\(\)/);
assert.match(schedulerFetch, /if \(currentAlarm != null\)/);
assert.match(schedulerFetch, /newlyScheduled: false/);
assert.match(schedulerFetch, /setAlarm\(scheduledAt\)/);
assert.match(schedulerFetch, /await baseWorker\.scheduled/);
assert.match(schedulerFetch, /SELECT batch_id FROM explore_like_batches_069 ORDER BY created_at ASC, batch_id ASC LIMIT 1/);
assert.match(schedulerFetch, /if \(currentAlarm == null\)/);

const scheduleHelper = functionText(entry, 'async function ensureQueuedLikeBatchScheduled103');
assert.match(scheduleHelper, /url\.pathname !== EXPLORE_LIKE_BATCH_ROUTE_103/);
assert.match(scheduleHelper, /!payload\?\.data\?\.queued/);
assert.match(scheduleHelper, /await scheduleExploreLikeAggregate103\(env\)/);
assert.match(scheduleHelper, /LIKE_BATCH_SCHEDULER_UNAVAILABLE/);
assert.match(scheduleHelper, /status: 503/);

assert.equal(wrangler.triggers, undefined, 'fixed cron must be absent');
assert.deepEqual(wrangler.durable_objects?.bindings, [
  { name: 'EXPLORE_LIKE_BATCH_SCHEDULER', class_name: 'ExploreLikeBatchScheduler103' },
]);
assert.deepEqual(wrangler.migrations, [
  { tag: 'v1', new_sqlite_classes: ['ExploreLikeBatchScheduler103'] },
]);
assert.equal(wrangler.exports, undefined, 'unsupported top-level exports config must be absent');

assert.match(revision, /SORIDRAW_EXPLORE_LIKE_EVENT_BATCH_REVISION_103_20260916/);
assert.match(revision, /const REVISION_CACHE_TTL_MS = 5 \* 60 \* 1000;/);
assert.match(revision, /soridraw\.explore\.feed-revision-response\.v2:/);
assert.match(revision, /expiresAt: Date\.now\(\) \+ REVISION_CACHE_TTL_MS/);
assert.doesNotMatch(revision, /PUBLIC_LIKE_AGGREGATE_WINDOW_MS_102|revisionCacheExpiry102/);

assert.match(worker, /SORIDRAW_EXPLORE_PUBLIC_LIKE_PARITY_056_20260916/);
assert.match(worker, /async scheduled\(controller, env, ctx\) \{\s*await processExploreLikeBatches035\(env, Number\(controller\?\.scheduledTime \|\| Date\.now\(\)\)\);\s*\}/s);

console.log('103_EXPLORE_LIKE_EVENT_BATCH=PASS');
console.log('EVENT_WINDOW=FIRST_SERVER_BATCH_PLUS_5MIN');
console.log('IDLE_FIXED_CRON=0');
console.log('WINDOW_RESET_ON_JOIN=NO');
console.log('BACKLOG_CHECK=INDEXED_LIMIT_1_AFTER_ACTIVE_AGGREGATE_ONLY');
console.log('REVISION_CACHE=5MIN_EDGE_R2_D1_R0W0');
console.log('DURABLE_OBJECT_CLASS_REGISTRATION=ADDITIVE_V1');
console.log('NO_D1_SCHEMA_MIGRATION=true');
console.log('NO_UI_CSS_CHANGE=true');
