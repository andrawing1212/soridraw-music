import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Stage418: exercise the actual compiled Worker aggregate, Durable Object
// scheduler, HTTP ACK handler, and RTDB receiver contract. No database writes.
const root = 'cloudflare/explore-worker/canonical/';
const compiled = readFileSync(root + 'preview-worker.js', 'utf8');
const entry = readFileSync(root + 'preview-entry.js', 'utf8');
const client = readFileSync('src/services/exploreLikeService.ts', 'utf8');
const sourceLock = readFileSync(root + 'source-sha256.txt', 'utf8').trim();
assert.equal(createHash('sha256').update(compiled).digest('hex'), sourceLock,
  '418 generated Worker must exactly match canonical SHA256 lock');
const stageSource = (text, begin, end) => {
  const start = text.indexOf(begin);
  const stop = text.indexOf(end, start + begin.length);
  assert.ok(start >= 0 && stop > start, 'missing 418 source range: ' + begin);
  return text.slice(start, stop);
};
const batchId = 'l069_1759999999999_' + 'a'.repeat(64);
const otherId = 'l069_1759999999998_' + 'b'.repeat(64);

const wave = stageSource(compiled,
  'async function processExploreLikeAggregateWave035(',
  '\n__name(processExploreLikeAggregateWave035');
const aggregate = stageSource(compiled,
  'async function processExploreLikeBatches035Core056(',
  '\n// SORIDRAW_SHARED_FEED_R2_PARITY_059');
assert.match(wave, /DELETE FROM explore_like_batches_069[^\u0060]+RETURNING batch_id/);
assert.match(wave, /const result = await env.DB.batch\(statements\)/);
assert.match(wave, /settledBatchIds418:/);
assert.match(aggregate, /totals.settledBatchIds418.push/);
assert.match(compiled, /async scheduled\(controller, env, ctx\) \{\s*return await processExploreLikeBatches035\(/);
assert.match(compiled, /batchInserted418: queued.inserted === true/);
assert.doesNotMatch(entry, /\/v1\/me\/likes-confirmed/);
assert.doesNotMatch(entry, /verifyQueuedLikeCanonical417/);

const computeWave = new Function(
  'selectExploreLikeAggregateBoundary039',
  'exploreLikeAggregateSnapshotCte039',
  'EXPLORE_LIKE_AGGREGATE_MAX_MUTATIONS_035',
  wave + '\nreturn processExploreLikeAggregateWave035;',
)(async () => ({ createdAt: 1, batchId, queueKind: '069' }), () => 'WITH x AS (SELECT 1) ', 50_000);
let statements418 = [];
const fakeEnv = { DB: {
  prepare(sql) { return { sql, bind(...values) { this.values = values; return this; } }; },
  async batch(statements) {
    statements418 = statements;
    return statements.map((statement, i) =>
      i === statements.length - 1
        ? { meta: { changes: 1 }, results: [{ batch_id: batchId }] }
        : { meta: { changes: i === 2 ? 1 : 0 }, results: [] });
  },
} };
const waveResult = await computeWave(fakeEnv, 100, 100, false, true);
assert.deepEqual(waveResult.settledBatchIds418, [batchId]);
assert.equal(waveResult.w1Processed, 1);
assert.match(statements418.at(-1).sql, /DELETE FROM explore_like_batches_069/);
assert.match(statements418.at(-1).sql, /RETURNING batch_id/);
assert.equal(statements418.length, 6);
console.log('418_ATOMIC_QUEUE_DELETE_RESULT=PASS');

const scheduleSource = stageSource(entry,
  'async function ensureQueuedLikeBatchScheduled103(',
  '// SORIDRAW_EXPLORE_LIKE_EVENT_BATCH_ACTIVE_RECOVERY_194_20260924');
const makeSchedule = (schedule) => new Function(
  'scheduleExploreLikeAggregate103',
  'EXPLORE_LIKE_BATCH_ROUTE_103',
  scheduleSource + '\nreturn ensureQueuedLikeBatchScheduled103;',
)(async (_env, requested) => {
  if (schedule.expected !== undefined) assert.equal(requested, schedule.expected);
  return schedule.result;
}, '/v1/me/likes/batch');
const testAck = async (config) => {
  const payload = {
    ok: true, data: {
      queued: true, canonicalD1: 'queued',
      personalLikeSnapshot: config.partial ? 'repair-needed' : 'changed-track-r2',
      batchId: config.duplicate ? otherId : batchId,
      batchInserted418: config.inserted !== false,
      queue: config.queue || '069',
      results: [{ trackId: 'song-1', liked: config.liked, status: 'legacy-queued' }],
    },
  };
  const run = makeSchedule({
    expected: config.inserted === false || config.partial || config.queue
      ? '' : config.duplicate ? otherId : batchId,
    result: config.schedule,
  });
  const request = new Request('https://preview.soridraw.com/v1/me/likes/batch', {
    method: 'POST',
  });
  const original = new Response(JSON.stringify(payload), {
    headers: { 'X-SORIDRAW-D1-Write': '1', 'X-SORIDRAW-D1-Read': '0' },
  });
  const response = await run(request, {}, original, {});
  const body = await response.json();
  assert.equal(Number(response.headers.get('X-SORIDRAW-D1-Write')), 1);
  assert.equal(Number(response.headers.get('X-SORIDRAW-D1-Read')), 0);
  return body.data;
};
const settled = { newlyScheduled: true, settled: true, settledBatchId418: batchId };
for(const liked of [true, false]) {
  const data = await testAck({ liked, schedule: settled });
  assert.equal(data.canonicalD1, 'settled');
  assert.equal(data.canonicalProof, 'atomic-drain-batch-418');
}
for (const [label, conf] of [
  ['OTHER_BATCH', { liked:true, schedule:{ ...settled, settledBatchId418:otherId } }],
  ['JOINED', { liked:true, schedule:{ ...settled, newlyScheduled:false } }],
  ['UNFINISHED', { liked:true, schedule:{ ...settled, settled:false } }],
  ['NO_RECEIPT', { liked:true, schedule:{ newlyScheduled:true,settled:true } }],
  ['DUPLICATE_INTAKE', { liked:true, inserted:false, schedule:settled }],
  ['R2_PARTIAL', { liked:true, partial:true, schedule:settled }],
  ['LEGACY_QUEUE', { liked:true, queue:'035', schedule:settled }],
]) {
  const data = await testAck(conf);
  assert.equal(data.canonicalD1, 'queued', label);
  assert.equal(data.canonicalProof, undefined, label);
}
console.log('418_LIKE_UNLIKE_NO_EXTRA_D1_QUERY=PASS');
console.log('418_QUEUED_AND_JOINED_FAIL_CLOSED=PASS');

const doSource = stageSource(entry,
  'export class ExploreLikeBatchScheduler103 extends DurableObject',
  '// SORIDRAW_BOUNDED_CANONICAL_PUBLIC_LIKE_CONVERGENCE_191');
class BaseDO {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }
}
const runDO = async ({ aggregate: result, requestId = batchId, pending = false, active = 0 }) => {
  let checked = 0;
  const fakeBaseWorker = { scheduled: async () => result };
  const Scheduler = new Function(
    'DurableObject',
    'baseWorker',
    'repairSharedPublicLikeCounts191',
    'EXPLORE_LIKE_ACTIVE_SCHEDULE_KEY_194',
    'EXPLORE_LIKE_ACTIVE_GRACE_MS_194',
    'EXPLORE_LIKE_ALARM_FALLBACK_MS_194',
    'EXPLORE_LIKE_EVENT_BATCH_DELAY_MS_105',
    'waitExploreLikeDelay194',
    doSource.replace(/^export class /, 'class ') + '\nreturn ExploreLikeBatchScheduler103;',
  )(BaseDO, fakeBaseWorker, async () => ({}),
    'active-scheduled-at-194', 20_000, 15_000, 5_000, async () => {});
  const storage = {
    async get() { return active; },
    async put() {},
    async delete() {},
    async setAlarm() {},
    async deleteAlarm() {},
  };
  const env = { DB: { prepare(query) {
    assert.match(query, /SELECT batch_id FROM explore_like_batches_069/);
    return { async first() { checked++; return pending ? {batch_id:otherId} : null; } };
  } } };
  const instance = new Scheduler({ storage }, env);
  const request = new Request('https://soridraw.internal/schedule', {
    method: 'POST', body: JSON.stringify({ expectedBatchId418: requestId }),
  });
  const response = await instance.fetch(request);
  assert.equal(response.status, 200);
  const value = await response.json();
  assert.ok(checked <= 1, '418 must not add a D1 query to DO scheduler');
  return value;
};
const canonicalAggregate = {
  w1Processed:1, processedBatches:1, oldProcessed:0, compactProcessed:0,
  processedUserWaves:0, userQueue:false, settledBatchIds418:[batchId],
};
const valid = await runDO({ aggregate:canonicalAggregate });
assert.equal(valid.settledBatchId418, batchId);
for (const [label, aggregate] of [
  ['WRONG_ACTOR', { ...canonicalAggregate, settledBatchIds418:[otherId] }],
  ['MULTIPLE_BATCHES', { ...canonicalAggregate, w1Processed:2, processedBatches:2,
    settledBatchIds418:[batchId,otherId] }],
  ['LEGACY_MIX', { ...canonicalAggregate, oldProcessed:1, processedBatches:2 }],
  ['USER_QUEUE_MIX', { ...canonicalAggregate, userQueue:true }],
  ['UNKNOWN_IDS', { ...canonicalAggregate, settledBatchIds418:[] }],
]) {
  const outcome = await runDO({ aggregate });
  assert.equal(outcome.settledBatchId418, '', label);
}
assert.equal((await runDO({ aggregate:canonicalAggregate, pending:true })).settledBatchId418, '');
assert.equal((await runDO({ aggregate:canonicalAggregate, active:Date.now() })).newlyScheduled,false);
console.log('418_DO_ATOMIC_BATCH_ID_AND_COLLISION_FENCES=PASS');

const rules = JSON.parse(readFileSync('database.rules.json','utf8'));
const likeRules = rules.rules.userSync.$uid.exploreLike;
assert.match(likeRules['.validate'], /hasChildren\(\['version','previousVersion','results'\]\)/);
assert.equal(likeRules.results.$index.canonicalSettled417['.validate'], 'newData.isBoolean()');
assert.equal(likeRules.results.$index.$other['.validate'], false);
const begin=client.indexOf('const normalizeLikeSignal127 = '),end=client.indexOf('const applyRemoteLikeSignal127 = ',begin);
assert.ok(begin>=0 && end>begin);
const js=ts.transpileModule(client.slice(begin,end),{ compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None,
}}).outputText;
const normalize=new Function('EXPLORE_LIKE_SIGNAL_MAX_127','clampLikeCount',js+'\nreturn normalizeLikeSignal127;')(
  50, x=>Math.max(0,Number(x)||0));
const baseRow={trackId:'song-1',ownerUid:'owner',liked:true,likeCount:1};
assert.equal(normalize({version:2,previousVersion:1,results:[baseRow]}).results[0].canonicalSettled417,undefined);
assert.equal(normalize({version:3,previousVersion:2,results:[{...baseRow,canonicalSettled417:true}]}).results[0].canonicalSettled417,true);
assert.match(client, /payload\?\.data\?\.canonicalProof === 'atomic-drain-batch-418'/);
const apply=stageSource(client,'const applyRemoteLikeSignal127 = ','let activeLikeSignalUid127');
assert.ok(apply.indexOf('if (pending[item.trackId]) continue;') <
  apply.indexOf('if (item.canonicalSettled417 === true && !needsRepair)'));
assert.ok(apply.indexOf('if (unresolvedChanged) writeSnapshotPending127') <
  apply.indexOf('acceptedForUi141.forEach(dispatchLikeSync)'));
console.log('418_EXISTING_RTDB_141_ORDERING_AND_LEGACY_COMPAT=PASS');
